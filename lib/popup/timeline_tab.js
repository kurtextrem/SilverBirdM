var TimelineTab = {
	getTabs() {
		if (this.$tabs !== undefined) return this.$tabs
		return (this.$tabs = $('#tabs'))
	},

	init() {
		this.getTabs().tabs({
			beforeActivate: (function(manager) {
				return function(event, ui) {
					manager.previousTimelineId = manager.currentTimelineId
					manager.currentTimelineId = ui.newTab.data('timelineId')
					TimelineTab.handleScroll(manager.previousTimelineId, false)
					Renderer.preClearance()
					prepareTimelines()
				}
			})(tweetManager),
			activate: (function(manager) {
				return function(event, ui) {
					TimelineTab.handleScroll(manager.currentTimelineId, true)
					loadTimeline()
					requestIdleCallback(() => ui.oldPanel.find('.inner_timeline').empty())
				}
			})(tweetManager),
		})
	},

	addNewTab(templateId, automaticallyAdded) {
		var createdTimelines = tweetManager.showTimelineTemplate(templateId)
		for (var i = 0, len = createdTimelines.length; i < len; ++i) {
			var timeline = createdTimelines[i]
			pos = tweetManager.getTimelinePosition(timeline.timelineId)
			if (pos == -1) {
				pos = undefined
			}
			switch (templateId) {
				case TimelineTemplate.SEARCH:
					SearchTab.addSearchTab(timeline.timelineId, pos, !automaticallyAdded)
					break
				case TimelineTemplate.LISTS:
					TimelineTab.addTab(timeline.timelineId, `<select id="${timeline.timelineId}-selector" data-timeline-id="${timeline.timelineId}"></select>`)
					Lists.update(timeline.timelineId)
					break
				default:
					TimelineTab.addTab(timeline.timelineId, timeline.template.timelineName, pos)
					break
			}
		}
		ThemeManager.handleWindowResizing()
		ThemeManager.updateTabsOrder()
		return createdTimelines
	},

	addNewSearchTab(searchQuery, isBackground) {
		var searchTimeline
		tweetManager.eachTimeline(function(timeline) {
			if (timeline.template.id == TimelineTemplate.SEARCH && timeline.getSearchQuery() == searchQuery) {
				searchTimeline = timeline
				return false
			}
			return true
		})
		if (!searchTimeline) {
			searchTimeline = TimelineTab.addNewTab(TimelineTemplate.SEARCH, true)[0]
		}
		if (searchQuery) {
			SearchTab.updateSearch(searchTimeline.timelineId, searchQuery, isBackground)
		}
	},

	addTab(timelineId, tabName, pos) {
		const insertTabEl = `
      <li id="tab_\#timeline-${timelineId}" data-timeline-id="${timelineId}" class="timeline_tab">
        <a href="\#timeline-${timelineId}">${tabName}</a>
      </li>
    `
		const panelEl = `
      <div class="timeline" id="timeline-${timelineId}">
        <div class="inner_timeline"></div>
      </div>
    `
		const tabDiv = this.getTabs()
		const tabUl = tabDiv.find('.ui-tabs-nav')
		if ($.isNumeric(pos) && pos > 0) {
			tabUl.find('.timeline_tab').eq(pos - 1).after(insertTabEl)
		} else {
			tabUl.append(insertTabEl)
		}
		tabDiv.append(panelEl)
		tabDiv.tabs('refresh')
		ThemeManager.initWindowResizing($(`#timeline-${timelineId}`))
		ContextMenu.initSingleTimeline(timelineId)
	},

	removeTab(timelineId) {
		if (timelineId == tweetManager.currentTimelineId && tweetManager.previousTimelineId) {
			this.select(tweetManager.previousTimelineId)
		}
		const tab = document.querySelector(`#tab_\\#timeline-${timelineId}`)
		if (tab) {
			tab.parentNode.removeChild(tab)
		}
		this.handleScroll(timelineId, false)
		const panel = document.querySelector(`#timeline-${timelineId}`)
		if (panel) {
			Renderer.preClearance(panel)
			panel.parentNode.removeChild(panel)
		}
		this.getTabs().tabs('refresh')
		tweetManager.hideTimeline(timelineId)
		tweetManager.updateAlert()
		ThemeManager.handleWindowResizing()
		ThemeManager.updateTabsOrder()
	},

	select(timelineId) {
		this.getTabs().tabs('option', 'active', $('#tab_\\#timeline-' + timelineId).index())
	},

	selectLeft(timelineId) {
		this.getTabs().tabs('option', 'active', $('#tab_\\#timeline-' + timelineId).index() - 1)
	},

	selectRight(timelineId) {
		var nextIndex = $('#tab_\\#timeline-' + timelineId).index() + 1
		if (nextIndex >= this.getTabs().find('.timeline_tab').length) nextIndex = 0
		this.getTabs().tabs('option', 'active', nextIndex)
	},

	scroll(scrollTo = null) {
		if (typeof scrollTo !== 'number') {
			return
		}
		document.querySelector(`#timeline-${tweetManager.currentTimelineId} .inner_timeline`).scrollTop = scrollTo
	},

	handleScroll(timelineId = tweetManager.currentTimelineId, doHandle = true) {
		const timeline = tweetManager.getTimeline(timelineId)
		const threshold = 2000
		const target = document.querySelector(`#timeline-${timelineId} .inner_timeline`)
		if (!target) return

		if (doHandle) {
			const clientHeight = target.clientHeight

			target._handler = throttle(event => {
				const scrollTop = target.scrollTop
				const maxScroll = target.scrollHeight - clientHeight
				timeline.currentScroll = scrollTop

				if (maxScroll - scrollTop < threshold) {
					if (!Paginator.needsMore) {
						// if loading is stuck, still request next page
						this.loadingDate = Date.now()
						Paginator.nextPage()
					}
				}
			})
			target.addEventListener('scroll', target._handler)
			target.addEventListener('wheel', e => Paginator.needsMore && e.preventDefault())
		} else if (target._handler !== undefined) {
			target.removeEventListener('scroll', target._handler)
			target._handler = undefined
		}
	},
}

function throttle(callback, wait) {
	var _time = Date.now(),
		_wait = wait !== undefined ? wait : 120

	return function throttle(event) {
		if (_time + _wait - Date.now() < 0) {
			callback(event)
			_time = Date.now()
		}
	}
}

function debounce(callback, leading, timeout) {
	var _leading = leading,
		debounceFn = function debounceFn() {
			_leading = leading
			callback(false)
		},
		_timeout = timeout !== undefined ? timeout : 200,
		_time = null

	return function debounce() {
		if (_leading) {
			// leading call
			callback(true)
			_leading = false
		}

		window.clearTimeout(_time)
		_time = window.setTimeout(debounceFn, _timeout)
	}
}
