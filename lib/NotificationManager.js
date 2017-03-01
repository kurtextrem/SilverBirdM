'use strict'

class NotificationManager {
	static getInstance() {
		if (!this.hasOwnProperty('instance')) {
			Object.defineProperty(this, 'instance', {
				value: new NotificationManager()
			})
		}
		return this.instance
	}

	constructor() {
		if (this.hasOwnProperty('instance')) {
			return this.instance
		}

		Object.defineProperties(this, {
			queue: {
				value: []
			},
			running: {
				value: 0,
				writable: true
			},
			notified: {
				value: new Map()
			},
			[Symbol.for('fadeTimeout')]: {
				value: 6000,
				writable: true
			},
			fadeTimeout: {
				get: () => this[Symbol.for('fadeTimeout')],
				set: (num = 6000) => {
					try {
						const parsedNum = parseInt(num, 10)
						if (parsedNum >= 1000 && parsedNum <= 8000) {
							this[Symbol.for('fadeTimeout')] = num
						}
					} catch (e) {
						this[Symbol.for('fadeTimeout')] = 6000
					}
				}
			},
			granted: {
				value: false,
				writable: true
			},
			constantStrings: {
				value: {
					justNow: chrome.i18n.getMessage('justNow'),
					minuteAgo: chrome.i18n.getMessage('minuteAgo'),
					minute_singular: chrome.i18n.getMessage('minute_singular'),
					minute_plural: chrome.i18n.getMessage('minute_plural'),
					hour_singular: chrome.i18n.getMessage('hour_singular'),
					hour_plural: chrome.i18n.getMessage('hour_plural'),
					day_singular: chrome.i18n.getMessage('day_singular'),
					day_plural: chrome.i18n.getMessage('day_plural'),
					expand_quote: chrome.i18n.getMessage('expand_quote_tweet'),
					retweetedByMe: chrome.i18n.getMessage('retweetedByMe'),
					retweetedBy_prefix: chrome.i18n.getMessage('retweetedBy_prefix'),
					retweetedBy_suffix: chrome.i18n.getMessage('retweetedBy_suffix'),
					sentTo_prefix: chrome.i18n.getMessage('sentTo_prefix'),
					sentTo_suffix: chrome.i18n.getMessage('sentTo_suffix'),
					footer_list: chrome.i18n.getMessage('f_footer_list'),
					verified_account: chrome.i18n.getMessage('verified_account'),
					protected_account: chrome.i18n.getMessage('protected_account'),
					fromApp_prefix: chrome.i18n.getMessage('fromApp_prefix'),
					fromApp_suffix: chrome.i18n.getMessage('fromApp_suffix'),
					inReply_prefix: chrome.i18n.getMessage('inReply_prefix'),
					inReply_suffix: chrome.i18n.getMessage('inReply_suffix'),
					unmarkLike: chrome.i18n.getMessage('unmarkLike'),
					markLike: chrome.i18n.getMessage('markLike'),
					reply: chrome.i18n.getMessage('Reply'),
					retweet: chrome.i18n.getMessage('Retweet'),
					quoteTweet: chrome.i18n.getMessage('quoteTweet'),
					deleteTweet: chrome.i18n.getMessage('Delete'),
					deleteRT: chrome.i18n.getMessage('deleteRT'),
					directMessage: chrome.i18n.getMessage('directMessage'),
					tweets_action: chrome.i18n.getMessage('tweets_action'),
					profile_action: chrome.i18n.getMessage('profile_action'),
					churn_action: chrome.i18n.getMessage('ue_churn_action'),
					add_mention_action: chrome.i18n.getMessage('add_mention_action'),
					follow_action: chrome.i18n.getMessage('follow_action'),
					unfollow_action: chrome.i18n.getMessage('unfollow_action'),
					mute_action: chrome.i18n.getMessage('mute_action'),
					unmute_action: chrome.i18n.getMessage('unmute_action'),
					block_action: chrome.i18n.getMessage('block_action'),
					report_action: chrome.i18n.getMessage('report_action'),
					expanding_url: chrome.i18n.getMessage('expanding_url')
				}
			},
			dummyNode: {
				value: document.createElement('span')
			}
		})

		chrome.notifications.onClicked.addListener((nId) => {
			chrome.tabs.create({
				url: this.notified.get(nId)
					.originalUrl
			})
			this.__clearNotification(nId)
		})

		chrome.notifications.onClosed.addListener((nId) => {
			if (this.notified.get(nId))
				this.notified.set(nId, undefined) // we still want to have the id included, but not the other data

			window.clearTimeout(this.running)
			this.running = 0
			this.__dequeue()
		})

		chrome.notifications.onButtonClicked.addListener((nId, buttonIndex) => {
			chrome.tabs.create({
				url: this.notified.get(nId)
					.buttons[buttonIndex].title
			})
		})

		chrome.notifications.onPermissionLevelChanged.addListener(() => {
			this.checkGranted()
		})
		chrome.notifications.onShowSettings.addListener(() => {
			this.checkGranted()
		})
		this.checkGranted()
	}

	checkGranted() {
		chrome.notifications.getPermissionLevel((level) => {
			if (level === 'granted') {
				this.granted = true
			} else {
				this.granted = false
				this.clearList()
			}
		})
	}

	addListForNotify(list = []) {
		if (!Array.isArray(list)) {
			list = [list]
		}
		this.queue.push(...list)

		this.__dequeue()
	}

	clearList() {
		this.queue.length = 0
		this.running = 0
		this.notified.clear()
	}

	__dequeue(skipCheck = false) {
		if (!this.granted || !this.queue.length || (this.running !== 0 && !skipCheck)) return false

		this.__notify(this.queue.shift())
			.catch((e) => {
				this.__dequeue(true)
			})

		return true
	}

	async __notify(tweet = { id_str: null }) {
		try {
			tweet = await this.__validate(tweet)
		} catch (e) {
			throw new TypeError('tweet is not valid')
		}
		// check notified
		const nId = `Silm__${tweet.id_str}`
		if (this.notified.has(nId)) {
			throw new Error('notification is already notified')
		}
		// create notification
		try {
			var [buttons, contextMessage, imageUrl] = await Promise.all([
				this.__getButtomsFromURLs(tweet),
				this.__getContextMessage(tweet),
				this.__getImage(tweet)
			])
			this.__createNotification(nId, {
				type: imageUrl ? 'image' : 'basic',
				title: `${tweet.user.name} @${tweet.user.screen_name}` + (tweet.user.verified ? ' ✓' : '') + (tweet.user.protected ? ' 🔒' : ''),
				message: tweet.text,
				iconUrl: tweet.user.profile_image_url_https, // .replace('normal', 'bigger')
				originalUrl: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
				// expandedMessage: tweet.full_text,
				contextMessage,
				buttons,
				imageUrl
			})
		} catch (e) {
			console.error(e)
			throw e
		}
	}

	async __normalize(tweet) {
		var oldScreenName = tweet.user.screen_name,
			oldName = tweet.user.name

		if (tweet.direct_message) {
			console.log('dm', tweet)
			tweet = tweet.direct_message
		} else if (tweet.retweeted_status) {
			tweet = tweet.retweeted_status
			tweet.retweeted_screen_name = oldScreenName
			tweet.retweeted_name = oldName
		} else if (tweet.quote_status) {
			var oldText = tweet.text
			tweet = tweet.quote_status
			tweet.quoted_status_text = oldText
			tweet.quoted_name = oldName
		}

		if (tweet.extended_tweet) {
			tweet.entities = tweet.extended_tweet.entities
			tweet.full_text = tweet.extended_tweet.full_text
		}

		tweet.text = (tweet.text || tweet.full_text || '')
			.trim()

		this.dummyNode.innerHTML = tweet.text
		tweet.text = this.dummyNode.textContent // display html entities correctly
		this.dummyNode.textContent = ''

		return tweet
	}

	async __validate(tweet) {
		tweet = await this.__normalize(tweet)
		if (!tweet.id_str) {
			throw new TypeError('missing tweet.id_str')
		}
		if (!tweet.user) {
			throw new TypeError('missing tweet.user')
		}
		tweet.text = tweet.text.replace(/(https?:\/\/t\.co\/\w+[^\s])/ig, '')
			.replace(/\s+/g, ' ')
			.replace(/\r?\n+/g, '\n')
		return tweet
	}

	__createNotification(nId, option) {
		if (!nId) throw new SyntaxError('missing nId')
		if (!option) throw new SyntaxError('missing option')

		return new Promise((resolve, reject) => {
			try {
				var originalUrl = option.originalUrl
				delete option.originalUrl // Chrome throws if options obj includes unexpected content

				chrome.notifications.create(nId, option, (nId) => {
					option.originalUrl = originalUrl
					this.notified.set(nId, option)

					this.running = window.setTimeout(function() {
						resolve(nId)
					}, this.fadeTimeout)

					window.setTimeout(() => {
						this.__dequeue(true) // show more notifications if possible
					}, this.fadeTimeout / 2)
				})
			} catch (e) {
				reject(e)
			}
		})
	}

	__clearNotification(nId) {
		if (!nId) throw new SyntaxError('missing nId')

		return new Promise((resolve, reject) => {
			try {
				chrome.notifications.clear(nId, (wasCleared) => {
					if (wasCleared) {
						resolve(true)
					} else {
						resolve(false)
					}
				})
			} catch (e) {
				reject(e)
			}
		})
	}

	async __getButtomsFromURLs(tweet) {
		var arr = [],
			match = null
		if (tweet.entities.urls.length) {
			match = tweet.entities.urls
		} else {
			match = tweet.text.match(/(https?:\/\/t\.co\/\w+[^\s])/ig) || []
		}

		var url = ''
		for (var i = 0; i < match.length; i++) {
			url = typeof match[i] === 'object' ? match[i].expanded_url : match[i]
			arr.push({
				title: url,
				iconUrl: 'https://www.google.com/s2/favicons?domain_url=' + url
			})
		}

		return arr
	}

	async __getContextMessage(tweet) {
		var str = new Array(),
			addTimeAgo = false

		if (tweet.quoted_status_text) {
			addTimeAgo = true
			str.push(tweet.quoted_status_text + ` - ${tweet.quoted_screen_name} (${tweet.quoted_name})`)
		}
		if (tweet.retweeted_name) {
			addTimeAgo = true
			str.push(`🔃 ${tweet.retweeted_screen_name} (${tweet.retweeted_name})`)
		}
		if (tweet.in_reply_to_user_id) {
			var regularName = tweet.entities.user_mentions.length ? ` (${tweet.entities.user_mentions[0].name})` : ''
			str.push('↪ @' + tweet.in_reply_to_screen_name + regularName)
			tweet.text = tweet.text.replace(`@${tweet.in_reply_to_screen_name} `, '')
		}

		if (tweet.retweet_count > 5) {
			addTimeAgo = true
			str.push(`🔃 ${tweet.retweet_count}`)
		}
		if (tweet.favorite_count > 5) {
			addTimeAgo = true
			str.push(`❤️️${tweet.retweet_count}`)
		}

		if (addTimeAgo) { // don't display anything if there is nothing else - probably a most recent tweet anyway
			var text = await this.getTimestampText(new Date(tweet.timestamp_ms))
			str.push(`🕒 ${text}`)
		}

		return str.join(' ')
	}

	async __getImage(tweet) {
		if (tweet.entities.media && tweet.entities.media.length)
			return tweet.entities.media[0].media_url_https
		return ''
	}

	async getTimestampText(inputTimestamp, now = Date.now()) {
		if (!(inputTimestamp instanceof Date)) {
			throw new TypeError('inputTimestamp is not Date object')
		}
		const diff = (now - inputTimestamp) * 0.001 | 0

		if (diff < 15) {
			return this.constantStrings.justNow
		} else if (diff < 60) {
			return this.constantStrings.minuteAgo
		} else if (diff < 60 * 60) {
			const minutes = diff / 60 | 0
			const minute_string = minutes > 1 ? 'minute_plural' : 'minute_singular'
			return chrome.i18n.getMessage('minutes', [
				minutes,
				this.constantStrings[minute_string]
			])
		} else if (diff < 60 * 60 * 24) {
			const hours = diff / (60 * 60) | 0
			const hour_string = hours > 1 ? 'hour_plural' : 'hour_singular'
			return chrome.i18n.getMessage('timeAgo', [
				hours,
				this.constantStrings[hour_string]
			])
		} else if (diff < 60 * 60 * 24 * 7) {
			const days = diff / (60 * 60 * 24) | 0
			const day_string = days > 1 ? 'day_plural' : 'day_singular'
			return chrome.i18n.getMessage('timeAgo', [
				days,
				this.constantStrings[day_string]
			])
		}
		return inputTimestamp.toLocaleString()
	}
}
