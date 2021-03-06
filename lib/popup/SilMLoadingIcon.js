class SilMLoadingIcon extends HTMLElement {
	constructor() {
		super()
		this.attachShadow({ mode: 'open' })
		this.handleLoading = (event) => {
			requestIdleCallback(() => {
				this.display(event.detail.state)
			})
		}
		return Object.seal(this)
	}

	connectedCallback() {
		this.render()
		// event binding
		if(window) {
			window.addEventListener("loading", this.handleLoading)
		}
	}

	disconnectedCallback() {
		// event unbinding
		if(window) {
			window.removeEventListener("loading", this.handleLoading)
		}
	}

	static get observedAttributes() {
		return [""]
	}

	attributeChangedCallback(attrName, oldVal, newVal) {
		if(!window || !this.isConnected) {
			return
		}
		switch(attrName) {
			default:
				break
		}
	}

	adoptedCallback() {
	}

	get visible() {
		if(!!this.icon && this.icon.classList) {
			return this.icon.classList.contains("visible") || false
		}
			throw new TypeError("missing icon")

	}

	get icon() {
		if(!this.isConnected) {
			throw new TypeError("it is not connected yet")
		}
		return this.shadowRoot.querySelector("#loading")
	}

	render() {
		this.shadowRoot.innerHTML = `
      <style>
        @import "./css/silm_reset.css";
        :host {
					width: 14px;
					height: 14px;
        }
        #loading {
					width: 14px;
					height: 14px;
          display: none;
          animation: rotate 2000ms infinite linear;
          contain: strict;
          position: absolute;
	        text-rendering: optimizeLegibility;
        }
        #loading.visible {
          display: block;
        }
        @keyframes rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(359deg); }
        }
      </style>
      <span id="loading" class="material-icons">refresh</span>
    `
	}

	display(state) {
		if(!!this.icon && this.icon.classList) {
			if(state === true) {
				this.icon.classList.add("visible")
			} else if(state === false) {
				this.icon.classList.remove("visible")
			} else {
				throw new TypeError("uncaught state")
			}
		} else {
			throw new TypeError("missing icon")
		}
	}
}
customElements.define("silm-loadingicon", SilMLoadingIcon)
