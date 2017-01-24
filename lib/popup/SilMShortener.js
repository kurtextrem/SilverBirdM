class SilMShortener extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({mode: "open"});
    shadowRoot.innerHTML = `
      <style>@import "./css/silm_shortener.css";</style>
      <input type="text" name="shortener_text" id="shortener_text" value=""></input>
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
    doLocalization(this.shadowRoot.querySelectorAll(".i18n"));
    this.checkShortenerText();
    // event binding
    const shortenerText = this.shadowRoot.querySelector("#shortener_text");
    if(!!shortenerText) {
      shortenerText.handleInput = (event) => {
        this.checkShortenerText(shortenerText.value);
      };
      shortenerText.addEventListener("input", shortenerText.handleInput);
      shortenerText.handleFocus = (event) => {
        const shortenerText = this.shadowRoot.querySelector("#shortener_text");
        if(shortenerText.value === this.idleStrings) {
          shortenerText.value = "";
        }
      };
      shortenerText.addEventListener("focus", shortenerText.handleFocus);
      shortenerText.handleBlur = (event) => {
        const shortenerText = this.shadowRoot.querySelector("#shortener_text");
        if(!shortenerText.value || !(/^https?:\/\//i.test(shortenerText.value))) {
          shortenerText.value = this.idleStrings;
        }
      };
      shortenerText.addEventListener("blur", shortenerText.handleBlur);
      shortenerText.handleKeyDown = (event) => {
        if(!!event.isComposing || !!event.defaultPrevented || (event.key !== "Enter" && event.key !== "Escape")) {
          return;
        }
        event.preventDefault();
        if(event.key === "Enter") {
          const shortenerButton = this.shadowRoot.querySelector("#shortener_button");
          if(shortenerButton.style.display !== "none") {
            shortenerButton.dispatchEvent(new MouseEvent("click"));
          }
        } else if(event.key === "Escape") {
          this.blur();
        }
      };
      shortenerText.addEventListener("keydown", shortenerText.handleKeyDown);
    }
    const shortenerButton = this.shadowRoot.querySelector("#shortener_button");
    if(!!shortenerButton) {
      shortenerButton.handleClick = (event) => {
        //TODO shorten
        const shortenerText = this.shadowRoot.querySelector("#shortener_text");
        shortenerText.value = this.idleStrings;
        shortenerText.setAttribute("value", "");
        this.blur();
      };
      shortenerButton.addEventListener("click", shortenerButton.handleClick);
    }
  }
  disconnectedCallback() {
    // event unbinding
    const shortenerText = this.shadowRoot.querySelector("#shortener_text");
    if(!!shortenerText) {
      shortenerText.removeEventListener("input", shortenerText.handleInput);
      shortenerText.removeEventListener("focus", shortenerText.handleFocus);
      shortenerText.removeEventListener("blur", shortenerText.handleBlur);
      shortenerText.removeEventListener("keydown", shortenerText.handleKeyDown);
    }
    const shortenerButton = this.shadowRoot.querySelector("#shortener_button");
    if(!!shortenerButton) {
      shortenerButton.removeEventListener("click", shortenerButton.handleClick);
    }
  }
  static get observedAttributes() {
    return ["shortenerText"];
  }
  attributeChangedCallback(attrName, oldVal, newVal) {
    if(!window || !this.isConnected) {
      return;
    }
    switch(attrName) {
      case "shortenerText":
        checkShortenerText();
        break;
      default:
        break;
    }
  }
  adoptedCallback() {
  }
  checkShortenerText(value = this.getAttribute("shortenerText") || "") {
    if(!value || value === "") {
      value = this.idleStrings;
    }
    this.shadowRoot.querySelector("#shortener_text").setAttribute("value", value);
  }
}
customElements.define("silm-shortener", SilMShortener);
