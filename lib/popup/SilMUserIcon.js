;(function(customElements) {
	const matchTwitterDomain = /^(?:https?:\/\/(?:\w+\.?)twi(?:tter|mg?)\.com\/|\/img\/?)/iu
	const defaultProfileImageURL = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'
	const io = new IntersectionObserver(
		changes => {
			for (let i = 0; i < changes.length; ++i) {
				let target = changes[i].target
				fetchImage(target, target.getAttribute('src'))
				io.unobserve(target)
			}
		},
		{ rootMargin: '10% 0px' }
	)

	function handleError(event) {
		console.info(event)
		event.target.src = defaultProfileImageURL
	}

	function handleLoad(event) {
		event.target.removeEventListener('error', handleError)
	}

	function fetchImage(node, url = defaultProfileImageURL) {
		// @TODO use fetch
		let shadowIcon = node.shadowRoot.querySelector('img')
		shadowIcon.src = matchTwitterDomain.test(url) ? url : defaultProfileImageURL
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
				<img />
			`
		}
	}
	customElements.define('silm-usericon', SilMUserIcon)
})(customElements)
