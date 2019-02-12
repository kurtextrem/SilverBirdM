;(function(customElements) {
	const matchTwitterDomain = /^(?:https?:\/\/(?:\w+\.?)twi(?:tter|mg?)\.com\/|\/img\/?)/iu
	const matchReplaceUrl = /_(mini|normal|bigger?)\./iu
	const defaultProfileImageURL =
		'https://abs.twimg.com/sticky/default_profile_images/default_profile.png'
	const iconStyleTable = new Map([
		['retweeter', '_mini.'],
		['icon_small', '_mini.'],
		['icon_normal', '_normal.'],
		['icon_large', '_bigger.'],
		['icon_max', '.'],
	])
	/*const worker = window.getWorker()
	const listener = new Map()
	worker.onmessage = function(message) {
		if (message.data !== undefined && listener.has(message.data)) {
			const url = message.data
			listener.get(url)()
			listener.delete(url)
		}
	}*/
	const io = new IntersectionObserver(
		changes => {
			for (let i = 0; i < changes.length; ++i) {
				const target = changes[i].target,
					iconUrl = (target.getAttribute('src') || '').replace(
						matchReplaceUrl,
						iconStyleTable.get(target.getAttribute('icon')) || '_normal.'
					)
				fetchImage(target, iconUrl)
				io.unobserve(target)
			}
		},
		{ rootMargin: '10% 0px' }
	)

	function handleError(event) {
		console.warn(event)
		this.src = defaultProfileImageURL
	}

	function handleLoad(event) {
		event.target.removeEventListener('error', handleError)
	}

	function fetchImage(node, url = defaultProfileImageURL) {
		const shadowIcon = node.shadowRoot.querySelector('img'),
			src = matchTwitterDomain.test(url) ? url : defaultProfileImageURL

		//listener.set(src, showImage.bind(undefined, shadowIcon, src))
		//worker.postMessage(src)
		window.requestIdleCallback(showImage.bind(undefined, shadowIcon, src))
	}

	function showImage(shadowIcon, src) {
		shadowIcon.src = src
		shadowIcon.addEventListener('error', handleError, { once: true })
		shadowIcon.addEventListener('load', handleLoad, { once: true })
	}

	class SilMUserIcon extends HTMLElement {
		static get observedAttributes() {
			return []
		}

		constructor() {
			super()
			this.attachShadow({ mode: 'open' })
		}

		connectedCallback() {
			this.render()
			io.observe(this)
		}

		disconnectedCallback() {
			io.unobserve(this)
		}

		attributeChangedCallback(attrName, oldVal, newVal) {
			if (!window || !this.isConnected) {
				return
			}
			switch (attrName) {
				default:
					break
			}
		}

		adoptedCallback() {}

		render() {
			this.shadowRoot.innerHTML = `
				<style>
					:host {
						display: inline-flex;
					}
					:host,
					:host img {
						width: 48px;
						height: 48px;
						margin: 0;
						border: none;
						padding: 0;
						border-radius: 5px;
					}
					:host(.retweeter),
					:host(.retweeter) img {
						width: 1.5em;
						height: 1.5em;
					}
					:host(.icon_small),
					:host(.icon_small) img {
						width: 24px;
						height: 24px;
					}
					:host(.icon_normal),
					:host(.icon_normal) img {
						width: 48px;
						height: 48px;
					}
					:host(.icon_large),
					:host(.icon_large) img {
						width: 73px;
						height: 73px;
					}
					:host(.icon_max),
					:host(.icon_max) img {
						width: 128px;
						height: 128px;
					}
				</style>
				<img decoding="async" intrinsicsize="48x48" lazyload>
			`
		}
	}
	customElements.define('silm-usericon', SilMUserIcon)
})(customElements)
