class SilMShortener extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({mode: "open"});
    shadowRoot.innerHTML = `
      <style>
        @import "./css/silm_reset.css";
        :host {
          margin: 2px 0;
          padding: 0;
          flex: 0 1 auto; /* flex item from #compose_tweet_area */
        }
        #shortener_button {
          left: calc((100% - 150px) / 2);
          position: absolute;
          width: 150px;
          border-bottom-left-radius: 5px 5px;
          border-bottom-right-radius: 5px 5px;
          background-color: var(--main-bg-color);
          border: 1px solid var(--main-bd-color);
          border-top: 0px;
          text-align: center;
          cursor: pointer;

          transition-property: opacity, z-index;
          transition-duration: 200ms;
          transition-timing-function: ease-out;
          z-index: -1;
          opacity: 0;
        }
        #shortener_button.show {
          transition-property: opacity, z-index;
          transition-duration: 200ms;
          transition-timing-function: ease-out;
          z-index: 99999;
          opacity: 1;
        }
        #shortener_button.show:hover {
          background-color: var(--hover-bg-color);
        }
      </style>
      <slot></slot>
      <div id="shortener_button" class="i18n"></div>
    `;
    const idleStrings = chrome.i18n.getMessage("shortenerIdleString");
    Object.defineProperties(this, {
      "idleStrings": {
        get: () => {
          return idleStrings;
        }
      }
    });
  }
  connectedCallback() {
    this.clear();
    doLocalization(this.shadowRoot.querySelectorAll(".i18n"));
    const input = this.querySelector("#shortener_text");
    if(!!input) {
      // event binding
      input.handleInput = (event) => {
        this.checkShortenable();
      };
      input.addEventListener("input", input.handleInput);
      input.handleFocus = (event) => {
        const input = this.querySelector("#shortener_text");
        if(!!input) {
          input.classList.remove("idle");
          if(!(/^https?:\/\//i.test((input.value || "").trim()))) {
            input.value = "";
          }
          $(input).autocomplete("search", "http");
        }
      };
      input.addEventListener("focus", input.handleFocus);
      input.handleBlur = (event) => {
        this.checkShortenable(true);
      };
      input.addEventListener("blur", input.handleBlur);
      input.handleKeyDown = (event) => {
        if(!!event.isComposing
        || !!event.defaultPrevented
        || (event.key !== "Enter" && event.key !== "Escape")) {
          return;
        }
        event.preventDefault();
        if(event.key === "Enter") {
          Shortener.shortenIt();
        } else if(event.key === "Escape") {
          this.blur();
        }
      };
      input.addEventListener("keydown", input.handleKeyDown);
    }
    const button = this.shadowRoot.querySelector("#shortener_button");
    if(!!button) {
      button.handleClick = (event) => {
        Shortener.shortenIt();
        this.clear();
      };
      button.addEventListener("click", button.handleClick);
    }
  }
  disconnectedCallback() {
    // event unbinding
    const input = this.querySelector("#shortener_text");
    if(!!input) {
      input.removeEventListener("input", input.handleInput);
      input.removeEventListener("focus", input.handleFocus);
      input.removeEventListener("blur", input.handleBlur);
      input.removeEventListener("keydown", input.handleKeyDown);
    }
    const button = this.shadowRoot.querySelector("#shortener_button");
    if(!!button) {
      button.removeEventListener("click", button.handleClick);
    }
  }
  static get observedAttributes() {
    return [""];
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
  checkShortenable(isClear = false) {
    const input = this.querySelector("#shortener_text");
    if(!!input) {
      const text = (input.value || "").trim();
      const button = this.shadowRoot.querySelector("#shortener_button");
      if(/https?:\/\//i.test(text)) {
        input.classList.remove("idle");
        button.classList.add("show");
      } else {
        input.classList.add("idle");
        button.classList.remove("show");
        if(isClear) {
          this.clear();
        }
      }
    }
  }
  clear() {
    const input = this.querySelector("#shortener_text");
    if(!!input) {
      input.classList.add("idle");
      input.value = this.idleStrings;
    }
    const button = this.shadowRoot.querySelector("#shortener_button");
    if(!!button) {
      button.classList.remove("show");
    }
  }
}
customElements.define("silm-shortener", SilMShortener);
