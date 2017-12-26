class SilMAttachUrl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: "open"});
    this.__idleString = chrome.i18n.getMessage("attach_url_idle");
    this.__attachString = chrome.i18n.getMessage("attach_url_button");
    this.context = null;
    this.autocompleteVisible = false;
    this.handleSilmMessage = (event = {detail: null}) => {
      if(!event.detail || event.detail.type !== "updateStatus" || !event.detail.target) {
        return;
      }
      Object.entries(event.detail.target).forEach(([key, value], index) => {
        switch(key) {
          case "composerOpend":
          case "composerClosed":
            this.clear();
            break;
        }
      });
    };
    this.handleVisible = (event) => {
      event.stopPropagation();
      const input = this.shadowRoot.querySelector("input");
      if(event.type === "mouseenter") {
        this.classList.add("visible");
      } else if(event.type === "mouseleave" && !this.autocompleteVisible) {
        if(!this.checkUrl()) {
          this.clear();
        }
      }
    };
    this.handleFocusEvent = (event) => {
      const input = this.shadowRoot.querySelector("input");
      switch(true) {
        case event.type === "mousedown" && !this.autocompleteVisible:
          event.stopPropagation();
          // no break
        case event.type === "focus":
          $(input).autocomplete("search", "http");
          break;
        case event.type === "mousedown" && !!this.autocompleteVisible && input.value.length === 0:
          event.stopPropagation();
          $(input).autocomplete("close");
          break;
        case event.type === "blur":
          $(input).autocomplete("close");
          this.handleVisible(new MouseEvent("mouseleave"));
          break;
      }
    };
    this.handleKeyup = (event) => {
      if(!!event.isComposing
      || !!event.defaultPrevented
      || (event.key !== "Enter" && event.key !== "Escape")) {
        this.checkUrl();
        return;
      }
      event.preventDefault();
      if(event.key === "Enter") {
        this.attach(event.ctrlKey || event.metaKey);
      } else if(event.key === "Escape") {
        this.clear();
      }
    };
    this.handleAttach = (event) => {
      this.checkUrl();
      const input = this.shadowRoot.querySelector("input");
      if(input.classList.contains("attachable")) {
        this.attach();
      } else if(!this.classList.contains("visible")) {
        this.classList.add("visible");
      } else {
        this.clear();
      }
    };
  }
  connectedCallback() {
    this.render();
    // event binding
    this.addEventListener("mouseenter", this.handleVisible, {capture: true});
    this.addEventListener("mouseleave", this.handleVisible, {capture: true});
    const input = this.shadowRoot.querySelector("input");
    input.addEventListener("keyup", this.handleKeyup);
    input.addEventListener("mousedown", this.handleFocusEvent, {capture: true});
    input.addEventListener("focus", this.handleFocusEvent);
    input.addEventListener("blur", this.handleFocusEvent);
    const button = this.shadowRoot.querySelector("button");
    button.addEventListener("focus", this.handleAttach);
    button.addEventListener("click", this.handleAttach);
    window.addEventListener("silmMessage", this.handleSilmMessage);
    // initialize autocomplete
    $(this.shadowRoot.querySelector("input")).autocomplete({
      create: (event, ui) => {
        $(event.target).data("ui-autocomplete").liveRegion.remove();
      },
      source: (request, response) => {
        chrome.tabs.query({
            status: "complete",
            windowType: "normal"
          }, (tabs) => {
          this.context = tabs.filter((entry) => /^https?:\/\//i.test(entry.url));
          response(this.context.map((entry)  => entry.url));
        });
      },
      close: (event, ui) => {
        this.autocompleteVisible = false;
        this.checkUrl();
      },
      open: (event, ui) => {
        this.autocompleteVisible = true;
        $(".ui-autocomplete").css({
          overflowX: "hidden",
          overflowY: "auto",
          maxHeight: "200px",
          maxWidth: `${this.offsetWidth}px`
        });
      }
    });
  }
  disconnectedCallback() {
    // event unbinding
    this.removeEventListener("mouseenter", this.handleVisible, {capture: true});
    this.removeEventListener("mouseleave", this.handleVisible, {capture: true});
    const input = this.shadowRoot.querySelector("input");
    input.removeEventListener("keyup", this.handleKeyup);
    input.removeEventListener("mousedown", this.handleFocusEvent, {capture: true});
    input.removeEventListener("focus", this.handleFocusEvent);
    input.removeEventListener("blur", this.handleFocusEvent);
    const button = this.shadowRoot.querySelector("button");
    button.removeEventListener("focus", this.handleAttach);
    button.removeEventListener("click", this.handleAttach);
    window.removeEventListener("silmMessage", this.handleSilmMessage);
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
  checkUrl() {
    const input = this.shadowRoot.querySelector("input");
    const button = this.shadowRoot.querySelector("button");
    const url = (input.value || "").trim();
    if(/^https?:\/\//.test(url)) {
      input.classList.add("attachable");
      button.textContent = "publish";
      button.setAttribute("title", this.__attachString);
      return true;
    } else {
      input.classList.remove("attachable");
      button.textContent = "insert_link";
      button.setAttribute("title", this.__idleString);
      return false;
    }
  }
  clear() {
    const input = this.shadowRoot.querySelector("input");
    input.value = "";
    this.classList.remove("visible");
    const button = this.shadowRoot.querySelector("button");
    button.textContent = "insert_link";
    button.setAttribute("title", this.__idleString);
  }
  attach(withoutQuery = false) {
    const input = this.shadowRoot.querySelector("input");
    if(!input.classList.contains("attachable")) {
      return;
    }
    let url = (input.value || "").trim();
    if(withoutQuery) {
      url = url.split('?')[0];
    }
    if(OptionsBackend.get("share_include_title")) {
      url = this.context.reduce((prev, current) => {
        if(!!prev) {
          return prev;
        }
        if(current.url.includes(url)) {
          return `${current.title} - ${url}`;
        } else {
          return null;
        }
      }, null);
    }
    Composer.addText(url);
    this.clear();
  }
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import "./css/silm_reset.css";
        :host {
          flex: 0 1 auto; /* flex item from #composer_widget_area_left */
          display: flex;
          flex-flow: row nowrap;
          align-items: center;
          height: 26px;
          width: auto;
        }
        :host > button {
          border: solid 1px var(--main-bd-color);
          border-radius: 13px;
          height: 26px;
        }
        :host > input,
        :host(:not(:hover)) > input,
        :host(:not(:focus)) > input {
          transition-property: width, padding;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          width: 0;
          padding: 0;
          border: none;
        }
        :host(.visible) {
          flex: 10 1 auto; /* flex item from #composer_widget_area_left */
        }
        :host(.visible) > input {
          transition-property: width;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          width: 100%;
          padding: 0 10px;
          border: solid 1px var(--main-bd-color);
          border-radius: 13px;
          color: gray;
        }
        input.attachable {
          color: black !important;
        }
        input:focus,
        button:focus {
          outline: none;
        }
      </style>
      <button class="material-icons" title="${this.__idleString}">insert_link</button>
      <input class="" type="text" value=""></input>
    `;
  }
}
customElements.define("silm-attachurl", SilMAttachUrl);
