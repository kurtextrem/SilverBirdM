class SilMComposer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.__composeText = chrome.i18n.getMessage("composeText");
    this.__closeComposeTweet = chrome.i18n.getMessage("closeComposeTweet");
    this.handleTransitionend = (event) => {
      if(event.propertyName !== "transform") {
        return;
      }
      const composed = this.getAttribute("composed");
      const composeText = this.shadowRoot.querySelector("#composeText");
      const composeIcon = this.shadowRoot.querySelector("#compose_tweet > .glyphicon").classList;
      if(composed === "true") {
        composeText.textContent = this.__closeComposeTweet;
        composeIcon.remove("glyphicon-menu-down");
        composeIcon.add("glyphicon-menu-up");
      } else if(composed === "false") {
        composeText.textContent = this.__composeText;
        composeIcon.remove("glyphicon-menu-up");
        composeIcon.add("glyphicon-menu-down");
        document.activeElement.blur();
      } else {
        throw new TypeError("uncaught state");
      }
    };
    this.handleClick = (event) => {
      const composed = this.getAttribute("composed");
      if(composed !== "true") {
        this.setAttribute("composed", "true");
        window.dispatchEvent(new CustomEvent("silmMessage", {
          detail: {
            type: "opend", 
            target: "composer"
          }
        }));
        this.moveCaret();
      } else {
        this.setAttribute("composed", "false");
        window.dispatchEvent(new CustomEvent("silmMessage", {
          detail: {
            type: "closed", 
            target: "composer"
          }
        }));
      }
    };
    this.handleRequest = (event = {detail: null}) => {
      if(!event.detail || !event.detail.type || event.detail.target !== "composer") {
        return;
      }
      const composed = this.getAttribute("composed");
      switch(true) {
        case event.detail.type === "requestOpen" && composed !== "true":
          this.handleClick();
          // no break
        case event.detail.type === "requestOpen":
          this.moveCaret();
          break;
        case event.detail.type === "requestClose" && composed === "true":
          this.handleClick();
          break;
        default:
          break;
      }
    };
    return Object.seal(this);
  }
  connectedCallback() {
    this.render();
    // event binding
    window.addEventListener("silmMessage", this.handleRequest);
    this.addEventListener("transitionend", this.handleTransitionend);
    this.shadowRoot.querySelector("#compose_tweet").addEventListener("click", this.handleClick);
  }
  disconnectedCallback() {
    // event unbinding
    window.removeEventListener("silmMessage", this.handleRequest);
    this.removeEventListener("transitionend", this.handleTransitionend);
    this.shadowRoot.querySelector("#compose_tweet").removeEventListener("click", this.handleClick);
  }
  static get observedAttributes() {
    return [];
  }
  attributeChangedCallback(attrName, oldVal, newVal) {
    if(!window || !this.isConnected) {
      return;
    }
    switch(attrName) {
      default:
        break;
    }
  }
  adoptedCallback() {
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
          height: 226px;
          overflow: hidden;
          z-index: 15000;

          display: flex;
          flex-flow: column nowrap;
          justify-content: flex-end;

          background-color: white;
          transition-property: transform, box-shadow;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          transform: translateY(-200px);
          box-shadow: 0px 0px 0px 0px rgba(0,0,0,0);
        }
        :host([composed="true"]) {
          transition-property: transform, box-shadow;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          transform: translateY(0px);
          box-shadow: 0px 5px 3px -1px rgba(0, 0, 0, calc(1.0 / 3));
        }
        #compose_tweet {
          flex: 0 1 auto; /* flex item from silm-composer */
          font-size: 9pt;
          font-weight: bold;
          margin: 0;
          padding: 0;
          text-align: center;
          cursor: pointer;
          color: #555;
          background-color: var(--main-bg-color);
          border: 1px solid var(--main-bd-color);
          padding: 3px;
        }
        #composeText {
          margin-left: 1em;
        }
      </style>
      <slot></slot>
      <div id="compose_tweet">
        <span class="glyphicon glyphicon-menu-down"></span><span id="composeText">${this.__composeText}</span>
      </div>
    `;
  }
  moveCaret() {
    requestIdleCallback(() => {
      const textarea = this.querySelector("#tweet_text");
      if(textarea) {
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        textarea.focus();
      }
    });
  }
}
customElements.define("silm-composer", SilMComposer);
