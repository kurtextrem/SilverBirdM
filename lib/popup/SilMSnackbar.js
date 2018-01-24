class SilMSnackbar extends HTMLElement {
	constructor() {
		super()
		this.attachShadow({ mode: 'open' })
		this.timer = 0
		this.queue = []
		this.handleClickForClose = event => {
			this.classList.remove('visible')
			this.clearTimer()
		}
		this.handleClickForHold = event => {
			this.addEventListener('click', this.handleClickForClose, { once: true })
			this.clearTimer()
		}
		this.handleTransitionend = event => {
			if (event.propertyName === 'transform') {
				if (this.classList.contains('visible')) {
					if (this.timer > 0) {
						this.clearTimer()
					}
					this.timer = setTimeout(() => {
						this.removeEventListener('click', this.handleClickForHold, { once: true })
						this.removeEventListener('click', this.handleClickForClose, { once: true })
						this.classList.remove('visible')
						this.clearTimer()
					}, 4000)
					this.addEventListener('click', this.handleClickForHold, { once: true })
				} else {
					this.removeEventListener('click', this.handleClickForHold, { once: true })
					this.removeEventListener('click', this.handleClickForClose, { once: true })
					this.setAttribute('class', 'info')
					this.shadowRoot.querySelector('#snackbar_message').textContent = ''
					this.clearTimer()
					this.dequeue()
				}
			}
		}
		return Object.seal(this)
	}

	connectedCallback() {
		this.render()
		// event binding
		this.addEventListener('transitionend', this.handleTransitionend)
	}

	disconnectedCallback() {
		// event unbinding
		this.removeEventListener('transitionend', this.handleTransitionend)
	}

	static get observedAttributes() {
		return ['']
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

	dequeue() {
		if (this.queue.length > 0 && this.timer === 0) {
			const entry = this.queue.shift()
			const message = (entry.message || '').trim()
			if (!message || message === '') {
				return this.dequeue()
			}
			this.display(message, entry.type)
		}
	}

	enqueue(entry) {
		if (!entry) {
			return
		}
		this.queue.push(entry)
		if (!this.classList.contains('visible')) {
			this.dequeue()
		}
	}

	clearTimer() {
		clearTimeout(this.timer)
		this.timer = 0
	}

	render() {
		this.shadowRoot.innerHTML = `
      <style>
        @import "./css/silm_reset.css";
        :host {
          position: absolute;
          top: 0;
          left: 0;
          width: calc(100% - 2px);
          max-height: 50%;
          overflow: visible;
          contain: paint;
          z-index: 20000;
          display: flex;
          flex-flow: column nowrap;
          justify-content: center;
          background-color: #9999ff;

          transition-property: transform, opacity;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          transform: translateY(-40px);
          opacity: 0;
          will-change: opacity, transform;
        }
        :host > #snackbar_message {
          line-height: 0.9;
          max-height: max-content;
          margin: 12px;
          overflow: visible;
          contain: paint;
          flex: 0 10 auto;
        }
        :host(.visible) {
          transition-property: transform, opacity;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          transform: translateY(0px);
          opacity: 1;
        }
        :host(.info) {
          background-color: #99ff99;
        }
        :host(.info) > #snackbar_message {
          color: var(--main-font-color);
          text-shadow: 1px 1px 0 white, -1px -1px white;
        }
        :host(.warning) {
          background-color: #eeee55;
        }
        :host(.warning) > #snackbar_message {
          color: var(--main-font-color);
          text-shadow: 1px 1px 0 white, -1px -1px white;
        }
        :host(.error) {
          background-color: #ff3333;
        }
        :host(.error) > #snackbar_message {
          color: white;
          text-shadow: 1px 1px 0 #993333, -1px -1px #993333;
        }
      </style>
      <p id="snackbar_message"></p>
    `
	}

	display(message = '', type = 'info') {
		this.timer = -1
		this.shadowRoot.querySelector('#snackbar_message').textContent = message
		requestIdleCallback(() => {
			const styles = this.shadowRoot.querySelector('style')
			for (const rule of styles.sheet.cssRules) {
				if (rule.selectorText === ':host(.visible)') {
					rule.style.transform = `translateY(-${this.offsetHeight}px)`
				}
			}
			this.setAttribute('class', `${type} visible`)
		})
	}
}
customElements.define('silm-snackbar', SilMSnackbar)
