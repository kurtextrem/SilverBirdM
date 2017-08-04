;(function(customElements) {
	const matchTwitterDomain = /^(?:https?:\/\/(?:\w+\.?)twi(?:tter|mg?)\.com\/|\/img\/?)/iu
	const defaultProfileImageURL = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'
	const io = new IntersectionObserver(
		changes => {
			for (let i = 0; i < changes.length; ++i) {
				const target = changes[i].target
				fetchImage(target, target.getAttribute('src'))
				io.unobserve(target)
			}
		},
		{ rootMargin: '10% 0px' }
	)

	function handleError(event) {
		console.warn(event)
		this.src = defaultProfileImageURL
	}

	function handleResponse(response) {
		if (response.ok) return response.blob()

		handleError(response.statusText)
		return Promise.reject(response.statusText)
	}

	function showImg(url) {
		this.src = url
	}

	function fetchImage(node, url = defaultProfileImageURL) {
		const root = node.shadowRoot.querySelector('img')
		fetch(matchTwitterDomain.test(url) ? url : defaultProfileImageURL)
			.then(handleResponse)
			.then(URL.createObjectURL)
			.then(showImg.bind(root))
			.catch(handleError.bind(root))
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
