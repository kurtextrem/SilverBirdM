class SilMPopup {
	constructor() {
		if (!this.appId || (Boolean(this.appId) && Boolean(SilMPopup.instance))) {
			throw new TypeError(`needs SilMPopup.getInstance()`)
		} else {
			this.__init()
		}
	}
	static getInstance() {
		if (!this.prototype.appId) {
			Object.defineProperties(this.prototype, {
				appId: {
					value: chrome.runtime.id,
				},
			})
			this.instance = new SilMPopup()
			Object.freeze(this)
		}
		return this.instance
	}
	__init() {
		if (!window) {
			throw new TypeError('missing window')
		}
		window.addEventListener('silmMessage', this.handlerSilMEvents)
		this.sendAction({ action: 'requestStatus', detail: {} })
	}
	sendAction(action = { action: 'echo' }) {
		chrome.runtime.sendMessage(this.appId, action, {}, response => {
			console.info(`sendAction: %s`, response)
		})
	}
	handlerSilMEvents(event, self = SilMPopup.getInstance()) {
		if (!event.detail || !event.detail.type || !event.detail.target) {
			return
		}
		switch (event.detail.type) {
			case 'updateStatus':
				self.handlerUpdate(event.detail.target)
				break
			case 'echo':
			default:
				break
		}
	}
	handlerUpdate(detail) {
		Object.entries(detail).forEach(([key, value], index) => {
			switch (key) {
				case 'suspended':
					suspend(value)
					break
				case 'trendingTopics':
					loadTrends(value)
					break
				case 'savedSearches':
					loadSavedSearches(value)
					break
				case 'userstreamConnected':
					userstreamConnected(value)
					break
				case 'userstreamEnabled':
					userstreamEnabled(value)
					break
				case 'twitterConfiguration':
					break
				default:
					console.info(`%s: %o`, key, value)
					break
			}
		})
	}
	localize(nodes = document.querySelectorAll('i18n')) {
		if (!nodes[Symbol.iterator]) {
			nodes = [nodes]
		}
		nodes.forEach(node => {
			const currentText = node.textContent || ''
			const converted = chrome.i18n.getMessage(node.id) || currentText
			switch (true) {
				case Boolean(node.title):
					node.setAttribute('title', converted)
					break
				case Boolean(node.value) && node.tagName !== 'OPTION':
					node.setAttribute('value', converted)
					break
				default:
					node.textContent = converted
					break
			}
			node.classList.remove('i18n')
		})
	}
}
const popup = SilMPopup.getInstance()

function loadTrends(userData = { trends: [] }) {
	requestIdleCallback(() => {
		let actions = []
		if (Boolean(userData.trends) && Array.isArray(userData.trends) && userData.trends.length > 0) {
			actions = userData.trends.slice(0, 10).map(entry => {
				return {
					name: entry.name,
					action: event => {
						TimelineTab.addNewSearchTab(entry.name, event.isAlternateClick)
					},
				}
			})
		} else {
			actions = [
				{
					name: chrome.i18n.getMessage('ue_wait_fetch_trends'),
					action: event => {
						popup.sendAction({ action: 'requestStatus', detail: {} })
					},
				},
			]
		}
		$('#trending_topics').actionMenu({
			parentContainer: '#workspace',
			actions,
		})
	})
}

function loadSavedSearches(userData = []) {
	requestIdleCallback(() => {
		const savedSearchedButton = $('#saved_searches')
		let actions = []
		if (Array.isArray(userData) && userData.length > 0) {
			actions = userData.map(entry => {
				return {
					name: entry.query.length > 10 ? `${entry.query.substring(0, 10)}...` : entry.query,
					action: event => {
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
	})
}

function suspend(bool = false) {
	requestIdleCallback(() => {
		const suspendWidget = document.getElementById('suspend_status')
		if (bool) {
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

function userstreamEnabled(bool = false) {
	requestIdleCallback(() => {
		const streamWidget = document.getElementById('stream_status')
		if (bool === true) {
			streamWidget.style.display = 'block'
		} else {
			streamWidget.style.display = 'none'
		}
	})
}

function userstreamConnected(bool = false) {
	requestIdleCallback(() => {
		const streamWidget = document.getElementById('stream_status')
		if (bool === true) {
			streamWidget.classList.remove('glyphicon-pause')
			streamWidget.classList.add('glyphicon-forward')
			streamWidget.setAttribute('title', chrome.i18n.getMessage('stream_connected'))
		} else {
			streamWidget.classList.remove('glyphicon-forward')
			streamWidget.classList.add('glyphicon-pause')
			streamWidget.setAttribute('title', chrome.i18n.getMessage('stream_disconnected'))
		}
	})
}
