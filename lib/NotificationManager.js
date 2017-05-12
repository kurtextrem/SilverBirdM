'use strict'

class NotificationManager {
	static getInstance() {
		if (this.instance === undefined) {
			this.instance = new NotificationManager()
			window.NotificationManager = this.instance
		}
		return this.instance
	}

	constructor() {
		if (this.instance !== undefined)
			return this.instance

		this.queue = []
		this.notified = new Map()
		this.fetchedImg = new Map()
		this[Symbol.for('fadeTimeout')] = Symbol.for('fadeTimeout')
		this.granted = false

		var i18n = chrome.i18n.getMessage
		this.constantStrings = {
			justNow: i18n('justNow'),
			minuteAgo: i18n('minuteAgo'),
			retweetedByMe: i18n('retweetedByMe'),
			/*minute_singular: i18n('minute_singular'),
			minute_plural: i18n('minute_plural'),
			hour_singular: i18n('hour_singular'),
			hour_plural: i18n('hour_plural'),
			day_singular: i18n('day_singular'),
			day_plural: i18n('day_plural'),
			expand_quote: i18n('expand_quote_tweet'),
			retweetedBy_prefix: i18n('retweetedBy_prefix'),
			retweetedBy_suffix: i18n('retweetedBy_suffix'),
			sentTo_prefix: i18n('sentTo_prefix'),
			sentTo_suffix: i18n('sentTo_suffix'),
			footer_list: i18n('f_footer_list'),
			verified_account: i18n('verified_account'),
			protected_account: i18n('protected_account'),
			fromApp_prefix: i18n('fromApp_prefix'),
			fromApp_suffix: i18n('fromApp_suffix'),
			inReply_prefix: i18n('inReply_prefix'),
			inReply_suffix: i18n('inReply_suffix'),*/
			unmarkLike: i18n('unmarkLike'),
			markLike: i18n('markLike'),
			reply: i18n('Reply'),
			retweet: i18n('Retweet'),
			quoteTweet: i18n('quoteTweet'),
			deleteTweet: i18n('Delete'),
			deleteRT: i18n('deleteRT'),
			directMessage: i18n('directMessage')
			/*tweets_action: i18n('tweets_action'),
			profile_action: i18n('profile_action'),
			churn_action: i18n('ue_churn_action'),
			add_mention_action: i18n('add_mention_action'),
			follow_action: i18n('follow_action'),
			unfollow_action: i18n('unfollow_action'),
			mute_action: i18n('mute_action'),
			unmute_action: i18n('unmute_action'),
			block_action: i18n('block_action'),
			report_action: i18n('report_action'),
			expanding_url: i18n('expanding_url')*/
		}

		this.dummyNode = document.createElement('span')
		this.defaultIcon = 'img/icon128.png'
		this.avatarRegex = /_(?:normal|bigger|mini)\.(png|jpe?g|gif)$/i
		this.tcoRegex = /(?:https?:\/\/t\.co\/\w+[^\s])/ig
		this.whitespaceRegex = /\s+/g
		this.newlineRegex = /\r?\n+/g
		this.messageRegex = /^(?:@[^ ]+ ){1,}/

		this.setListener()
		this.checkGranted()
	}

	set fadeTimeout(num) {
		try {
			const parsedNum = parseInt(num, 10)
			if (parsedNum >= 1000 && parsedNum <= 10000) {
				this[Symbol.for('fadeTimeout')] = num
			}
		} catch (e) {
			this[Symbol.for('fadeTimeout')] = 6000
		}
	}

	setListener() {
		chrome.notifications.onClicked.addListener((nId) => {
			chrome.tabs.create({
				url: this.notified.get(nId)
					.originalUrl
			})
			this.clearNotification(nId)
		})

		chrome.notifications.onClosed.addListener((nId) => {
			if (this.notified.has(nId))
				this.notified.set(nId, undefined) // we still want to have the id included, but not the other data

			this.fetchedImg.forEach((value, index) => {
				if (index === nId || index === nId + '_image' || index.indexOf(nId + '_favicon') !== -1) {
					URL.revokeObjectURL(value)
					this.fetchedImg.delete(index)
				}
			})

			this.dequeue()
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

		this.dequeue()
	}

	clearList() {
		this.queue.length = 0
		this.notified.clear()
	}

	async dequeue() {
		if (!this.granted || this.queue.length === 0) return false

		return this.notify(this.queue.shift())
			.catch((e) => {
				if (typeof e !== 'string')
					console.error(e)
				this.dequeue()
			})
	}

	async notify(tweet) {
		await this.validate(tweet)

		// check notified
		const nId = `Silm_${tweet.id_str}`
		if (this.notified.has(nId)) {
			return Promise.reject('Notification has already been sent')
		}

		tweet = await this.normalize(tweet)
		const [buttons, contextMessage, imageUrl, iconUrl] = await Promise.all([
			this.getButtomsFromURLs(nId, tweet),
			this.getContextMessage(tweet),
			this.getImage(nId, tweet),
			this.getBlobUrl(nId, tweet.user.profile_image_url_https.replace(this.avatarRegex, '.$1'), tweet.user.profile_image_url_https)
		])

		return this.createNotification(nId, {
			type: imageUrl ? 'image' : 'basic',
			title: `${tweet.user.name} @${tweet.user.screen_name}` + (tweet.user.verified ? '✓' : '') + (tweet.user.protected ? '🔒' : ''),
			message: tweet.text.replace(this.tcoRegex, '').replace(this.messageRegex, ''), // replace all @'s - the new twitter feature
			iconUrl, //tweet.user.profile_image_url_https, // .replace('normal', 'bigger')
			originalUrl: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
			// expandedMessage: tweet.full_text,
			contextMessage,
			buttons,
			imageUrl
		})
	}

	async validate(tweet) {
		if (tweet === undefined) throw new TypeError('Missing tweet')
		if (tweet.id_str === undefined) throw new TypeError('Missing tweet.id_str')
		if (tweet.user === undefined) throw new TypeError('Missing tweet.user')
		return true
	}

	async normalize(tweet) {
		console.log(tweet)

		if (tweet.event !== undefined && tweet.event === 'quoted_tweet')
			tweet = tweet.target_object

		var oldScreenName = tweet.user.screen_name,
			oldName = tweet.user.name

		if (tweet.direct_message !== undefined) {
			console.log('dm', tweet)
			tweet = tweet.direct_message
		} else if (tweet.retweeted_status !== undefined) {
			tweet = tweet.retweeted_status
			tweet.retweeted_screen_name = oldScreenName
			tweet.retweeted_name = oldName
		} else if (tweet.is_quote_status) {
			var oldText = tweet.text
			tweet = tweet.quoted_status
			tweet.quoted_status_text = oldText
			tweet.quoted_screen_name = oldScreenName
			tweet.quoted_name = oldName
		}

		if (tweet.extended_tweet !== undefined) {
			tweet.entities = tweet.extended_tweet.entities
			tweet.full_text = tweet.extended_tweet.full_text
		}

		tweet.text = (tweet.text || tweet.full_text || '')
			.trim()

		this.dummyNode.innerHTML = tweet.text
		tweet.text = this.dummyNode.textContent // display html entities correctly
		this.dummyNode.nodeValue = ''

		tweet.text = tweet.text.replace(this.whitespaceRegex, ' ').replace(this.newlineRegex, '\n')

		return tweet
	}

	async getButtomsFromURLs(nId, tweet) {
		if (nId === undefined) throw new SyntaxError('Missing nId')

		var arr = [],
			match = null
		if (tweet.entities.urls.length !== 0) {
			match = tweet.entities.urls
		} else {
			return []
		}

		var url = ''
		for (var i = 0; i < match.length; ++i) {
			url = typeof match[i] === 'object' ? match[i].expanded_url : match[i]
			arr.push({
				title: url,
				iconUrl: await this.getBlobUrl(nId + '_favicon' + i, 'https://www.google.com/s2/favicons?domain_url=' + url)
			})
		}

		return arr
	}

	async getBlobUrl(nId, url, fallbackUrl = this.defaultIcon) {
		if (nId === undefined) throw new SyntaxError('Missing nId')
		if (url === undefined || url === this.defaultIcon) return this.defaultIcon

		try {
			const response = await window.fetch(url)
			console.log(response)
			if (response.ok) {
				const iconBlob = await response.blob(),
					objUrl = URL.createObjectURL(iconBlob)
				this.fetchedImg.set(nId, objUrl)
				return objUrl
			}
			throw new Error('Failed to fetch original icon, using fallback')
		} catch (e) {
			if (fallbackUrl === '') return ''
			return await this.getBlobUrl(nId, fallbackUrl)
		}
	}

	async getContextMessage(tweet) {
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
			const regularName = tweet.entities.user_mentions.length ? ` (${tweet.entities.user_mentions[0].name})` : ''
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
			const text = await this.getTimestampText(new Date(tweet.timestamp_ms))
			str.push(`🕒 ${text}`)
		}

		return str.join(' ')
	}

	async getImage(nId, tweet) {
		if (nId === undefined) throw new SyntaxError('Missing nId')

		if (tweet.entities.media && tweet.entities.media.length) {
			const url = await this.getBlobUrl(nId + '_image', tweet.entities.media[0].media_url_https, '')
			console.log(url, tweet.entities.media[0].media_url_https)
			return url
		}
		return ''
	}

	async getTimestampText(inputTimestamp, now = Date.now()) {
		if (!(inputTimestamp instanceof Date)) throw new TypeError('inputTimestamp is not Date object')
		const diff = (now - Number(inputTimestamp)) * 0.001 | 0

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

	createNotification(nId, option) {
		if (nId === undefined) throw new SyntaxError('Missing nId')
		if (option === undefined) throw new SyntaxError('Missing option')

		return new Promise((resolve, reject) => {
			const originalUrl = option.originalUrl
			delete option.originalUrl // Chrome throws if options obj includes unexpected content

			chrome.notifications.create(nId, option, (_nId) => {
				if (chrome.runtime.lastError)
					reject(chrome.runtime.lastError)

				option.originalUrl = originalUrl
				this.notified.set(_nId, option)

				window.setTimeout(function timeout() {
					resolve(_nId)
				}, this.fadeTimeout)

				window.setTimeout(() => {
					this.dequeue() // show more notifications
				}, this.fadeTimeout / 2)
			})
		})
	}

	clearNotification(nId) {
		if (nId === undefined) throw new SyntaxError('Missing nId')

		return new Promise((resolve, reject) => {
			chrome.notifications.clear(nId, (wasCleared) => {
				if (wasCleared && !chrome.runtime.lastError) {
					resolve(true)
				} else {
					reject(chrome.runtime.lastError || false)
				}
			})
		})
	}
}
