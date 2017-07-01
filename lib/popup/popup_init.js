var currentTimelineTweetPositions = []
function showLoading() {
	window.dispatchEvent(
		new CustomEvent('loading', {
			detail: {
				state: true,
			},
		})
	)
}

function hideLoading() {
	window.dispatchEvent(
		new CustomEvent('loading', {
			detail: {
				state: false,
			},
		})
	)
}

function onTimelineRetrieved(tweets, timelineId) {
	hideLoading()
	const currentTimeline = tweetManager.getCurrentTimeline()
	if (timelineId !== currentTimeline.timelineId) {
		return
	}
	const timeline = tweetManager.getTimeline(timelineId)
	if (!timeline || !timeline.template.visible) {
		return
	}
	if (tweets) {
		if (tweets.length === 0) {
			tweets = [tweetManager.getDummyTweet()]
			tweets[0].text = chrome.i18n.getMessage('ue_updatingTweets_nofetched')
		}
		Paginator.needsMore = false
		Renderer.assemblyTweets(tweets, timelineId)
		if (OptionsBackend.get('use_keyboard_shortcuts') && timelineId == tweetManager.currentTimelineId) {
			requestIdleCallback(caliculateTweetPositions)
		}
		requestIdleCallback(() => {
			TimelineTab.scroll(currentTimeline.currentScroll)
		})
	} else {
		var baseErrorMsg = tweetManager.currentError() || chrome.i18n.getMessage('undefined_message')
		if (baseErrorMsg === '(This user is protected)') {
			tweets = [tweetManager.getDummyTweet()]
			tweets[0].text = chrome.i18n.getMessage('ue_unauthorized_user')
			window.dispatchEvent(
				new CustomEvent('timelineRetrieved', {
					tweets,
					timelineId,
				})
			)
			return
		}
		var errorMsg = ''
		if (baseErrorMsg === 504) {
			errorMsg = chrome.i18n.getMessage('ue_updatingTweets_timeout')
		} else if (baseErrorMsg === 500 || baseErrorMsg === 503) {
			errorMsg = chrome.i18n.getMessage('ue_twitter_is_now_unable')
		} else if (baseErrorMsg === 429) {
			errorMsg = chrome.i18n.getMessage('exceededAPIHits')
		} else if (baseErrorMsg === 401) {
			errorMsg = chrome.i18n.getMessage('ue_updatingTweets_noauthenticate')
		} else if (baseErrorMsg === 261) {
			errorMsg = chrome.i18n.getMessage('ue_restricted_write_action')
		} else {
			errorMsg = chrome.i18n.getMessage('ue_updatingTweets', baseErrorMsg)
		}
		Renderer.showError(errorMsg)
	}
	prepareTimelines()
}

function loadTimeline(force = false, forcedTimeline = undefined) {
	showLoading()
	if (force) {
		Paginator.needsMore = false
	}
	let cacheOnly = true
	if (Paginator.needsMore) {
		cacheOnly = false
	}
	tweetManager.giveMeTweets(forcedTimeline, force, cacheOnly)
}

function signout() {
	tweetManager.signout()
	window.close()
}

function suspend() {
	requestIdleCallback(() => {
		const suspendWidget = document.getElementById('suspend_status')
		if (tweetManager.suspend) {
			suspendWidget.classList.remove('glyphicon-play')
			suspendWidget.classList.add('glyphicon-stop')
			suspendWidget.setAttribute('title', chrome.i18n.getMessage('timeline_suspended'))
		} else {
			suspendWidget.classList.remove('glyphicon-stop')
			suspendWidget.classList.add('glyphicon-play')
			suspendWidget.setAttribute('title', chrome.i18n.getMessage('timeline_running'))
		}
	})
}

function newTweetsAvailable(count, timelineId) {
	requestIdleCallback(() => {
		const currentTimeline = tweetManager.currentTimelineId
		if (timelineId !== currentTimeline) {
			const updateTab = document.getElementById(`tab_\#timeline-${timelineId}`)
			if (updateTab) {
				if (count === 0) {
					updateTab.classList.remove('update_modifier')
				} else {
					updateTab.classList.add('update_modifier')
				}
			}
		} else {
			const updateTweets = document.querySelector('silm-updatetweets')
			if (count > 0) {
				updateTweets.show(count)
			} else {
				updateTweets.hide()
			}
		}
	})
}

function updateNotificationFunc(timelineId = tweetManager.currentTimelineId) {
	const count = tweetManager.getNewTweetsCount(timelineId)
	if (timelineId === tweetManager.currentTimelineId) {
		if (count > 0) {
			tweetManager.mergeNewTweets()
		}
		document.getElementById(`tab_#timeline-${timelineId}`).classList.remove('update_modifier')
	} else {
		newTweetsAvailable(count, timelineId)
	}
}

function loadNewTweets() {
	Paginator.needsMore = false
	$('#tab_\\#timeline-' + tweetManager.currentTimelineId).removeClass('update_modifier')

	prepareAndLoadTimeline()
	TimelineTab.scroll(0)
}

function loadTrends() {
	var trendingTopicsButton = $('#trending_topics')
	var userData = tweetManager.cachedTrendingTopics || {}
	var actions = []

	if (userData.trends && Array.isArray(userData.trends) && userData.trends.length > 0) {
		actions = userData.trends.slice(0, 10).map(function(entry) {
			return {
				name: entry.name,
				action(event) {
					TimelineTab.addNewSearchTab(entry.name, event.isAlternateClick)
				},
			}
		})
	} else {
		actions = [
			{
				name: chrome.i18n.getMessage('ue_wait_fetch_trends'),
				action(event) {
					loadTrends()
				},
			},
		]
	}

	trendingTopicsButton.actionMenu({
		parentContainer: '#workspace',
		actions,
	})
	trendingTopicsButton = null
}

function loadSavedSearches() {
	var savedSearchedButton = $('#saved_searches')
	var userData = tweetManager.cachedSavedSearches || []
	var actions = []

	if (Array.isArray(userData) && userData.length > 0) {
		actions = userData.map(function(entry) {
			return {
				name: entry.query.length > 10 ? entry.query.substring(0, 10) + '...' : entry.query,
				action(event) {
					TimelineTab.addNewSearchTab(entry.query, event.isAlternateClick)
				},
			}
		})
		savedSearchedButton.show().actionMenu({
			parentContainer: '#workspace',
			actions,
		})
	} else {
		savedSearchedButton.hide()
	}
	savedSearchedButton = null
}

function prepareTimelines() {
	document.querySelector('silm-updatetweets').hide()

	updateNotificationFunc(tweetManager.currentTimelineId)
	tweetManager.eachTimeline(timeline => {
		if (timeline.timelineId !== tweetManager.currentTimelineId) {
			updateNotificationFunc(timeline.timelineId)
		}
	})
}

function prepareAndLoadTimeline() {
	prepareTimelines()
	loadTimeline()
}

function handleKeyboardShortcuts(event) {
	var through = false
	if (document.activeElement.tagName.toLowerCase() == 'input' || document.activeElement.tagName.toLowerCase() == 'textarea' || /^silm-/i.test(document.activeElement.tagName)) {
		through = true
	}
	if (event.altKey && event.shiftKey) {
		switch (event.keyCode) {
			case 67: // c
				Composer.showComposeArea()
				break
			case 82: // r
				chrome.runtime.reload()
				break
			default:
				break
		}
	} else if (event.ctrlKey) {
		switch (event.keyCode) {
			case 81: // q
				window.close()
				break
			default:
				break
		}
	} else if (!through) {
		switch (event.keyCode) {
			case 65: // a
				TimelineTab.selectLeft(tweetManager.currentTimelineId)
				break
			case 72: // h
				TimelineTab.selectLeft(tweetManager.currentTimelineId)
				break
			case 74: // j
				TimelineTab.scroll(scrollNextTweet())
				break
			case 75: // k
				TimelineTab.scroll(scrollPrevTweet())
				break
			case 76: // l
				TimelineTab.selectRight(tweetManager.currentTimelineId)
				break
			case 82: // r
				if ($('#update_tweets').css('display') !== 'none') {
					loadNewTweets()
				} else {
					Composer.refreshNew()
				}
				break
			case 83: // s
				TimelineTab.selectRight(tweetManager.currentTimelineId)
				break
			case 84: // t
				TimelineTab.scroll(0)
				break
			case 85: // u
				TimelineTab.select(TimelineTemplate.UNIFIED)
				break
			default:
				break
		}
	}
}

function caliculateTweetPositions() {
	const tweetsInnerTimeline = document.querySelectorAll('.tweet_space')
	currentTimelineTweetPositions = []
	if (tweetsInnerTimeline) {
		currentTimelineTweetPositions = [...tweetsInnerTimeline].map(e => e.offsetTop)
	}
}

function scrollNextTweet() {
	var twtPositions = currentTimelineTweetPositions,
		twtPosLength = twtPositions.length
	if (twtPosLength > 0) {
		var currentScrollOverTweet = 0
		var currentTimelineScrolled = tweetManager.getCurrentTimeline().currentScroll
		for (var i = 1; i < twtPosLength; i++) {
			if (currentTimelineScrolled > twtPositions[i]) {
				currentScrollOverTweet = i
				continue
			} else {
				break
			}
		}
		if (currentScrollOverTweet < twtPosLength - 1) {
			return twtPositions[currentScrollOverTweet + 1] + 1
		}
		return twtPositions[twtPosLength - 1]
	}
	return 0
}

function scrollPrevTweet() {
	var twtPositions = currentTimelineTweetPositions,
		twtPosLength = twtPositions.length
	if (twtPosLength > 0) {
		var currentScrollOverTweet = 0
		var currentTimelineScrolled = tweetManager.getCurrentTimeline().currentScroll
		for (var i = twtPosLength - 1; i > 0; i--) {
			if (currentTimelineScrolled <= twtPositions[i] + 1) {
				currentScrollOverTweet = i
				continue
			} else {
				break
			}
		}
		if (currentScrollOverTweet > 0) {
			var ret = twtPositions[currentScrollOverTweet - 1]
			return ret > 0 ? ret + 1 : 0
		}
	}
	return 0
}

function chromeContextMenusInit() {
	chrome.contextMenus.remove('searchInSilverbirdM', function() {
		chrome.contextMenus.create(
			{
				type: 'normal',
				id: 'searchInSilverbirdM',
				title: chrome.i18n.getMessage('c_search_on_silverbird_m'),
				contexts: ['selection'],
				onclick(info, tab) {
					if (info.selectionText && info.selectionText.length > 0) {
						TimelineTab.addNewSearchTab(info.selectionText)
					}
				},
				documentUrlPatterns: ['chrome-extension://' + chrome.runtime.id + '/*'],
			},
			function() {
				// no behavior
			}
		)
	})
}

function displayStreamingStatus() {
	const state = tweetManager.userstream ? tweetManager.userstream.state || false : false
	if (!OptionsBackend.get('use_streaming_api')) {
		$('#stream_status').remove()
		return
	}
	requestIdleCallback(() => {
		const streamWidget = document.getElementById('stream_status')
		if (state) {
			streamWidget.classList.remove('glyphicon-pause')
			streamWidget.classList.add('glyphicon-forward')
			streamWidget.setAttribute('title', chrome.i18n.getMessage('stream_connected'))
			streamWidget.dataset.status = 'connected'
		} else {
			streamWidget.classList.remove('glyphicon-forward')
			streamWidget.classList.add('glyphicon-pause')
			streamWidget.setAttribute('title', chrome.i18n.getMessage('stream_disconnected'))
			streamWidget.dataset.status = state
		}
	})
}

function initializeWorkspace() {
	$('#workspace').show()
	ThemeManager.init()
	bindEvents()
	TimelineTab.init()
	tweetManager.orderedEachTimeline(function(timeline) {
		switch (timeline.template.id) {
			case TimelineTemplate.SEARCH:
				SearchTab.addSearchTab(timeline.timelineId)
				break
			case TimelineTemplate.LISTS:
				TimelineTab.addTab(timeline.timelineId, '<select id="' + timeline.timelineId + '-selector"></select>')
				break
			default:
				TimelineTab.addTab(timeline.timelineId, timeline.template.timelineName)
				break
		}
	})
	Lists.update()
	ThemeManager.handleSortableTabs()
	requestIdleCallback(() => {
		suspend(tweetManager.suspend)
		ThemeManager.handleWindowResizing()
		ContextMenu.init()
		ConfirmDialog.init()
		Composer.init()
		Autocomplete.init()
		chromeContextMenusInit()
		loadTrends()
		loadSavedSearches()
		displayStreamingStatus()
	})
	TimelineTab.select(tweetManager.currentTimelineId)
}

function bindEvents() {
	if (OptionsBackend.get('use_keyboard_shortcuts')) {
		$(window).on('keyup.popup', function(event) {
			handleKeyboardShortcuts(event)
		})
	}
	$(window).on({
		sendQueue(event) {
			if (event.originalEvent) {
				event = event.originalEvent
			}
			switch (event.detail.type) {
				case 'empty':
					const lastSent = event.detail.lastSent
					if (OptionsBackend.get('use_streaming_api')) {
						loadNewTweets()
					} else {
						let updateTimelineId = TimelineTemplate.HOME
						if (lastSent && lastSent.isDM) {
							updateTimelineId = TimelineTemplate.SENT_DMS
						}
						loadTimeline(true, updateTimelineId)
					}
					break
				case 'enqueue':
				case 'tweetSent':
					// no behavior
					break
				case 'sendFailed':
					const status = event.detail.status
					const abortedQueue = event.detail.aborted
					if (!abortedQueue || abortedQueue.length === 0) {
						return
					}
					// If we're here that's because something went wrong
					if (!Composer.isVisible()) {
						// For now let's just show the first enqueued message
						const topMessage = abortedQueue[0]
						let replyTargetUrl
						if (topMessage.isDM) {
							topMessage.message = `d ${topMessage.replyUser} ${topMessage.message}`
						} else if (Boolean(topMessage.replyUser) && Boolean(topMessage.replyId)) {
							replyTargetUrl = `https://twitter.com/${topMessage.replyUser}/status/${topMessage.replyId}`
						}
						Composer.initMessage(topMessage.message, replyTargetUrl, topMessage.attachmentUrl, topMessage.mediaIds)
					}
					if (status === 500 || status === 503 || status === 504) {
						Renderer.showError(chrome.i18n.getMessage('ue_twitter_is_now_unable'))
					} else if (status === 261) {
						Renderer.showError(chrome.i18n.getMessage('ue_restricted_write_action'))
					} else if (status === 354) {
						Renderer.showError(chrome.i18n.getMessage('ue_over_dm_character_limit'))
					} else {
						Renderer.showError(chrome.i18n.getMessage('tweet_send_error'))
					}
					break
				default:
					console.info(event)
					break
			}
		},
		timelineRetrieved(event) {
			if (event.originalEvent) {
				event = event.originalEvent
			}
			onTimelineRetrieved(event.detail.tweets, event.detail.timelineId)
		},
		updateTimeline(event) {
			if (event.originalEvent) {
				event = event.originalEvent
			}
			newTweetsAvailable(event.detail.count, event.detail.timelineId)
		},
		updateTrendingTopics(event) {
			loadTrends()
		},
		updateLists(event) {
			Lists.update()
		},
		updateSavedSearches(event) {
			loadSavedSearches()
		},
		updateStreamingStatus(event) {
			displayStreamingStatus()
		},
		updateSilmMessage(event) {
			if (event.originalEvent) {
				event = event.originalEvent
			}
			if (event.detail) {
				Renderer.showMessage(event.detail)
			}
		},
		updateSuspend(event) {
			if (event.originalEvent) {
				event = event.originalEvent
			}
			suspend()
		},
		updateVisibility(event) {
			if (event.originalEvent) {
				event = event.originalEvent
			}
			if (event.detail && event.detail !== '') {
				const removeTarget = document.querySelector(`[tweetid="${event.detail}"]`)
				if (removeTarget) {
					removeTarget.parentNode.addEventListener(
						'transitionend',
						event => {
							Renderer.preClearance(event.target)
							event.target.parentNode.removeChild(event.target)
						},
						{ once: true }
					)
					removeTarget.parentNode.classList.add('blindOut')
				}
			}
		},
	})
	$('#refresh_trigger').on('click.popup', function(event) {
		event.preventDefault()
		Composer.refreshNew()
	})
	$('#suspend_status').on('click.popup', function(event) {
		event.preventDefault()
		tweetManager.suspend = !tweetManager.suspend
	})
	$('#stream_status').on('click.popup', function(event) {
		event.preventDefault()
		const state = tweetManager.userstream ? tweetManager.userstream.state || false : false
		if (state) {
			tweetManager.disconnectStreaming()
		} else {
			tweetManager.connectStreaming()
		}
	})
	const signoutButton = document.getElementById('signout')
	if (signoutButton) {
		signoutButton.addEventListener(
			'click',
			() => {
				signout()
				// close window
			},
			{
				once: true,
			}
		)
	}
	const optionButton = document.getElementById('options_page_link')
	if (optionButton) {
		optionButton.addEventListener(
			'click',
			() => {
				chrome.runtime.openOptionsPage(event => {
					if (window) {
						window.close()
					}
				})
			},
			{
				once: true,
			}
		)
	}
	const detachButton = document.getElementById('detach_window')
	if (detachButton) {
		detachButton.addEventListener(
			'click',
			() => {
				Renderer.detach()
				// close window
			},
			{
				once: true,
			}
		)
	}
	const twitterButton = document.getElementById('twitter_link')
	if (twitterButton) {
		twitterButton.addEventListener(
			'click',
			() => {
				chrome.tabs.create({
					url: `https://twitter.com/`,
					active: true,
				})
				window.close()
			},
			{
				once: true,
			}
		)
	}
	Composer.bindEvents()
}

$(function() {
	if (!backgroundPage.SecretKeys.hasValidKeys()) {
		Renderer.showError(chrome.i18n.getMessage('invalid_keys'))
		$('#workspace').show().height(300)
		ThemeManager.init()
		return
	}
	if (!twitterBackend.isAuthenticated()) {
		if (twitterBackend.isTokenRequested()) {
			$(document.head).append('<link rel="import" id="importEnterPin" href="./template/enterpin.html" />')
		}
		return
	}
	if (tweetManager.ready) {
		doLocalization()
		initializeWorkspace()
	} else {
		alert(chrome.i18n.getMessage('a_initialization_is_not_finished'))
		window.close()
	}
})
