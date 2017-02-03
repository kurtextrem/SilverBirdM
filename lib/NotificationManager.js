class NotificationManager {
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
            fetchedIcon: {
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
            }
        })
        chrome.notifications.onClicked.addListener((nId) => {
            chrome.tabs.create({
                url: this.notified.get(nId)
                    .originalUrl
            })
            chrome.notifications.clear(nId, (wasCleared) => {
                if (this.running > 0) {
                    clearTimeout(this.running)
                }
                this.__enqueue()
            })
        })
        chrome.notifications.onClosed.addListener((nId, byUser) => {
            if ((this.fetchedIcon.get(nId))) {
                URL.revokeObjectURL(this.fetchedIcon.get(nId))
                this.fetchedIcon.delete(nId)
            }
            if (byUser) {
                this.__enqueue()
            }
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

    static getInstance() {
        if (!this.hasOwnProperty('instance')) {
            Object.defineProperty(this, 'instance', {
                value: new NotificationManager()
            })
        }
        return this.instance
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
        if (this.running === 0) {
            this.__enqueue()
        }
    }

    clearList() {
        this.queue.splice(0)
        this.running = 0
        this.notified.clear()
        for (let url of this.fetchedIcon.values()) {
            URL.revokeObjectURL(url)
        }
        this.fetchedIcon.clear()
    }

    __enqueue() {
        if (!this.granted) {
            this.clearList()
            return null
        }
        if (this.running > 0) {
            clearTimeout(this.running)
            this.running = 0
        }
        if (this.queue.length > 0) {
            this.running = -1
            this.__notify(this.queue.shift())
                .catch((e) => {
                    this.__enqueue()
                })
        } else {
            this.running = 0
        }
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
            throw new TypeError('notification is already notified')
        }
        // create notification
        try {
            var [buttons, contextMessage, imageUrl, iconUrl] = await Promise.all([
              this.__getButtomsFromURLs(tweet),
              this.__getContextMessage(tweet),
              this.__getImage(tweet),
              this.__getIconUrl(nId, tweet.user.profile_image_url_https)
            ])
            const notifiedId = await this.__createNotification(nId, {
                type: imageUrl ? 'image' : 'basic',
                title: `${tweet.user.name} @${tweet.user.screen_name}` + (tweet.user.verified ? '✓' : '') + (tweet.user.protected ? '🔒' : ''),
                message: tweet.text,
                // expandedMessage: tweet.full_text,
                contextMessage,
                iconUrl,
                buttons,
                imageUrl,
                originalUrl: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`
            })
            const cleared = await this.__clearNotification(notifiedId)
            if (cleared) {
                this.__enqueue()
            }
        } catch (e) {
            console.error(e)
            this.__enqueue()
        }
    }

    async __normalize(tweet) {
        if (tweet.hasOwnProperty('direct_message')) {
            tweet = tweet.direct_message
        } else if (tweet.hasOwnProperty('retweeted_status')) {
            tweet = tweet.retweeted_status
        }
        if (tweet.hasOwnProperty('extended_tweet')) {
            tweet.entities = tweet.extended_tweet.entities
            tweet.full_text = tweet.extended_tweet.full_text
        }
        if (tweet.hasOwnProperty('full_text')) {
            tweet.text = tweet.full_text
        }
        if (!tweet.text)
            tweet.text = ''
        return tweet
    }

    async __validate(tweet) {
        tweet = await this.__normalize(tweet)
        if (!tweet.hasOwnProperty('id_str') || !tweet.id_str) {
            throw new TypeError('missing tweet.id_str')
        }
        if (!tweet.hasOwnProperty('user')) {
            throw new TypeError('missing tweet.user')
        }
        tweet.text = tweet.text.replace(/(https?:\/\/t\.co\/\w+[^\s])/ig, '')
            .replace(/\s+/g, ' ')
            .replace(/\r?\n+/g, '\n')
        return tweet
    }

    async __getIconUrl(nId, url = '/img/icon128.png') {
        if (!nId) {
            throw new SyntaxError('missing nId')
        }
        const fetchIconUrl = url.replace(/_(normal|bigger|mini)\.(png|jpe?g|gif)$/i, '.$2')
        try {
            const response = await fetch(fetchIconUrl)
            if (response.ok) {
                const iconBlob = await response.blob()
                this.fetchedIcon.set(nId, URL.createObjectURL(iconBlob))
                return this.fetchedIcon.get(nId)
            }
            throw new TypeError('fail to fetch original icon')

        } catch (e) {
            try {
                const fallbackResponse = await fetch(url)
                if (fallbackResponse.ok) {
                    const iconBlob = await fallbackResponse.blob()
                    this.fetchedIcon.set(nId, URL.createObjectURL(iconBlob))
                    return this.fetchedIcon.get(nId)
                }
                throw new TypeError('fail to fetch base icon')

            } catch (e) {
                return '/img/icon128.png'
            }
        }
    }

    __createNotification(nId, option) {
        if (!nId) {
            throw new SyntaxError('missing nId')
        }
        if (!option) {
            throw new SyntaxError('missing option')
        }
        return new Promise((resolve, reject) => {
            try {
                var originalUrl = option.originalUrl
                delete option.originalUrl // Chrome throws if options obj includes unexpected content
                chrome.notifications.create(nId, option, (nId) => {
                    option.originalUrl = originalUrl
                    this.notified.set(nId, option)
                    if ((this.fetchedIcon.get(nId))) {
                        URL.revokeObjectURL(this.fetchedIcon.get(nId))
                        this.fetchedIcon.delete(nId)
                    }
                    this.running = setTimeout(() => {
                        resolve(nId)
                    }, this.fadeTimeout)
                })
            } catch (e) {
                reject(e)
            }
        })
    }

    __clearNotification(nId) {
        if (!nId) {
            throw new SyntaxError('missing nId')
        }
        return new Promise((resolve, reject) => {
            try {
                chrome.notifications.clear(nId, (wasCleared) => {
                    if (this.fetchedIcon.get(nId)) {
                        URL.revokeObjectURL(this.fetchedIcon.get(nId))
                        this.fetchedIcon.delete(nId)
                    }
                    if (wasCleared) {
                        resolve(true)
                    }
                    resolve(false)
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
        var str = new Array()
        if (tweet.is_quote_status)
            str.push('“')
        if (tweet.in_reply_to_user_id)
            str.push(`↪ @${tweet.entities.user_mentions[0].screen_name} (${tweet.entities.user_mentions[0].name})`)
        if (tweet.retweet_count > 5)
            str.push(`🔃 ${tweet.retweet_count}`)
        if (tweet.favorite_count > 5)
            str.push(`❤ ${tweet.retweet_count}`)

        return str.join(' ')
    }

    async __getImage(tweet) {
        if (tweet.entities.media && tweet.entities.media.length)
            return tweet.entities.media[0].media_url_https
        return ''
    }
}
