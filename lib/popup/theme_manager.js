const ThemeManager = {
	timeoutAutoFit: 0,
	init() {
		ThemeManager.isPopup = silm.location.searchParams.get('window') === 'popup'
		ThemeManager.isDetached = silm.location.searchParams.get('window') === 'detached'
		const baseStyle = document.getElementById('base_stylesheet')
		if (baseStyle.sheet && baseStyle.sheet.cssRules) {
			const fontSize = OptionsBackend.get('font_size')
			for (const rule of baseStyle.sheet.cssRules) {
				if (rule.selectorText === '.tweet') {
					rule.style.fontSize = fontSize
					break
				}
			}
		}

		ThemeManager.detachedPos = tweetManager.detachedWindowPosition
		if (ThemeManager.isDetached) {
			$(document.head).append(`<base target="_blank">`)
			$('#detach_window').remove()
			// Listening to resize and move events
			$(window).on('resize', () => {
				ThemeManager.detachedPos.height = window.innerHeight
				ThemeManager.detachedPos.width = window.innerWidth
				tweetManager.detachedWindowPosition = ThemeManager.detachedPos
			})
			setInterval(() => {
				if (ThemeManager.detachedPos.left != window.screenLeft || ThemeManager.detachedPos.top != window.screenTop) {
					ThemeManager.detachedPos.left = window.screenLeft
					ThemeManager.detachedPos.top = window.screenTop
					tweetManager.detachedWindowPosition = ThemeManager.detachedPos
				}
			}, 1000)
		}
	},

	setPopupSize(width, height, autoFitWidth = false) {
		if (!ThemeManager.isPopup) {
			return
		}

		/* HACK: Magic numbers */
		const hackBordersWidth = 15
		const hackTabsAdditionalWidth = 40
		const hackHeaderHeight = 75
		const hackMinValidHeight = 400
		width = width || 490
		height = height || 400
		const minWidth = 450
		const maxWidth = 795
		if (width > maxWidth) {
			width = maxWidth
		}
		if (width < minWidth) {
			width = minWidth
		}

		if (autoFitWidth) {
			if (ThemeManager.timeoutAutoFit > 0) {
				clearTimeout(ThemeManager.timeoutAutoFit)
			}
			ThemeManager.timeoutAutoFit = setTimeout(function() {
				let tabsBarWidth = 0
				$('.timeline_tab').each(function() {
					tabsBarWidth += this.offsetWidth
				})
				tabsBarWidth += hackTabsAdditionalWidth
				if (tabsBarWidth > width) {
					ThemeManager.setPopupSize(tabsBarWidth, height)
				}
				ThemeManager.timeoutAutoFit = 0
			}, 0)
		}
		requestIdleCallback(() => {
			const timeline = document.querySelectorAll('.timeline')
			if (timeline) {
				for (let i = 0, len = timeline.length; i < len; i++) {
					const node = timeline[i]

					node.style.width = `${width}px`
					node.style.height = `${height}px`
				}
			}
		})
		requestIdleCallback(() => {
			const inner = document.querySelectorAll('.inner_timeline')
			if (inner) {
				for (let i = 0, len = inner.length; i < len; i++) {
					const node = inner[i]

					node.style.height = `${height}px`
				}
			}
		})
		requestIdleCallback(() => {
			if (window.innerHeight < hackMinValidHeight) {
				return
			}
			if (window.innerHeight < height + hackHeaderHeight) {
				const height = window.innerHeight - hackHeaderHeight
				ThemeManager.setPopupSize(width, height, autoFitWidth)
			}
		})
	},

	initWindowResizing(context) {
		ThemeManager.handleWindowResizing()
		const $tabs = $('#tabs')
		const divTl = context || $tabs.find('.timeline').not('.ui-resizable-handle')
		if (!ThemeManager.isPopup) {
			const resizeFunc = function() {
				const timelineHeight = `${window.innerHeight - 79}px`
				divTl.css('maxHeight', timelineHeight)
				$tabs.find('.inner_timeline').css('maxHeight', timelineHeight)
			}
			$(window).resize(resizeFunc)
			resizeFunc()
			return
		}
		divTl.resizable({
			handles: 'e, s, se',
			minWidth: 450,
			resize(event, ui) {
				ThemeManager.setPopupSize(this.offsetWidth, this.offsetHeight)
			},
			stop(event, ui) {
				tweetManager.popupWindowSize = [this.offsetWidth, this.offsetHeight]
			},
		})
		$tabs.find('.ui-resizable-handle').attr('title', chrome.i18n.getMessage('resetSize')).dblclick(function(e) {
			tweetManager.popupWindowSize = null
			ThemeManager.setPopupSize(null, null, true)
		})
	},

	handleWindowResizing() {
		const [sizeX, sizeY] = tweetManager.popupWindowSize || [null, null]
		ThemeManager.setPopupSize(sizeX || null, sizeY || null, true)
	},

	handleSortableTabs() {
		$('#tabs').find('.ui-tabs-nav').sortable({
			stop: ThemeManager.updateTabsOrder,
		})
	},

	updateTabsOrder() {
		const tabs = document.querySelectorAll('li[data-timeline-id]')
		if (tabs) {
			tweetManager.timelineOrder = Array.prototype.map.call(tabs, entry => entry.dataset.timelineId)
			$('#tabs').tabs('refresh')
		}
	},
}
