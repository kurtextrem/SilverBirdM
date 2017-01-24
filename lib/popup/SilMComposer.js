class SilMComposer extends HTMLElement {
  constructor() {
    super();
    this.background = null;
    const shadowRoot = this.attachShadow({mode: "open"});
    shadowRoot.innerHTML = `
      <style>@import "./css/silm_composer.css";</style>
  <textarea rows="4" id="tweet_text"></textarea>
  <div id="quote_tweet_url">
    <span class="glyphicon glyphicon-remove-circle" id="quote_tweet_dismiss"></span>
    <span id="quote_tweet_text" class="i18n" title="Quote to this tweet"></span>
  </div>
  <silm-shortener></silm-shortener>
  <div id="attach_media_area">
    <input id="tweetit" class="i18n" type="button" value="Tweet!" />
    <input id="attach_button" class="i18n" type="button" value="Attach" />
    <input id="image_input" type="file" name="media" accept="image/jpeg,image/png,image/webp" multiple />
    <span id="upload_previews">
    </span>
    <span id="chars_left"></span>
  </div>
  <div id="compose_tweet">
    <span class="glyphicon glyphicon-menu-down"></span><span id="composeText" class="i18n"></span>
  </div>
    `;
    Object.defineProperties(this, {
      "composed": {
        get: () => {
          return this.getAttribute("composed");
        },
        set: (value = "") => {
          this.setAttribute("composed", value);
        }
      },
      "quote": {
        get: () => {
          return this.getAttribute("quote");
        },
        set: (value = "") => {
          this.setAttribute("quote", value);
        }
      },
      "tweetText": {
        get: () => {
          const tweetText = this.shadowRoot.querySelector("tweet_text");
          if(!!tweetText) {
            return tweetText.value;
          } else {
            return "";
          }
        },
        set: (value = "") => {
          const tweetText = this.shadowRoot.querySelector("tweet_text");
          if(!!tweetText) {
            tweetText.value = value;
          }
        }
      }
    });
  }
  connectedCallback() {
    chrome.runtime.getBackgroundPage((page) => {
      if(!page) {
        throw new TypeError("missing backgroundPage");
      }
      this.background = page;
    });
    doLocalization(this.shadowRoot.querySelectorAll(".i18n"));
    // event binding
    if(!this.handleTransitionend) {
      this.handleTransitionend = (event) => {
        if(event.propertyName === "transform") {
          const composed = this.getAttribute("composed");
          if(composed === "true") {
            this.shadowRoot.querySelector("textarea").focus();
            tweetManager.composerData.isComposing = true;
            Composer.syncComposerData();
            Composer.nowUploading(Composer.uploading);
          } else if (composed === "false") {
            tweetManager.composerData.isComposing = false;
            Composer.nowUploading(false);
            Composer.resetComposerData(true);
            Composer.textareaChanged();
          } else {
            console.warn("uncaught state");
          }
        }
      };
      this.addEventListener("transitionend", this.handleTransitionend);
    }
    const composeTweet = this.shadowRoot.querySelector("#compose_tweet");
    if(!!composeTweet && !composeTweet.handleClick) {
      composeTweet.handleClick = () => {
        if(this.composed === "true") {
          this.composed = "false";
        } else {
          this.composed = "true";
        }
      };
      composeTweet.addEventListener("click", composeTweet.handleClick);
    }
    const quoteDismiss = this.shadowRoot.querySelector("#quote_tweet_dismiss");
    if(!!quoteDismiss && !quoteDismiss.handleClick) {
      quoteDismiss.handleClick = () => {
        this.quote = "";
      };
      quoteDismiss.addEventListener("click", quoteDismiss.handleClick);
    } else {
      console.info("missing quotedismiss");
    }
  }
  disconnectedCallback() {
    this.background = null;
    // event unbinding
    if(!!this.handleTransitionend) {
      this.removeEventListener("transitionend", this.handleTransitionend);
    }
    const composeTweet = this.shadowRoot.querySelector("#compose_tweet");
    if(!!composeTweet && !!composeTweet.handleClick) {
      composeTweet.removeEventListener("click", composeTweet.handleClick);
    }
    const quoteDismiss = this.shadowRoot.querySelector("#quote_tweet_dismiss");
    if(!!quoteDismiss && !!quoteDismiss.handleClick) {
      quoteDismiss.removeEventListener("click", quoteDismiss.handleClick);
    }
  }
  static get observedAttributes() {
    return ["composed", "quote"];
  }
  attributeChangedCallback(attrName, oldVal, newVal) {
    if(!window || !this.isConnected) {
      return;
    }
    switch(attrName) {
      case "composed":
        this.checkComposed(newVal);
        break;
      case "quote":
        this.checkQuote(newVal);
        break;
      default:
        break;
    }
  }
  adoptedCallback() {
    this.background = null;
  }
  checkComposed(composed = this.getAttribute("composed") || "false") {
    const composeText = this.shadowRoot.querySelector("#composeText");
    const composeIcon = this.shadowRoot.querySelector("#compose_tweet >.glyphicon").classList;
    if(composed === "true") {
      if(!!Composer && !!Composer.quoteTweetUrl) {
        this.setAttribute("quote", Composer.quoteTweetUrl);
      }
      composeText.textContent = chrome.i18n.getMessage("closeComposeTweet");
      composeIcon.remove("glyphicon-menu-down");
      composeIcon.add("glyphicon-menu-up");
    } else if(composed === "false") {
      this.setAttribute("quote", "");
      composeText.textContent = chrome.i18n.getMessage("composeText");
      composeIcon.remove("glyphicon-menu-up");
      composeIcon.add("glyphicon-menu-down");
    }
  }
  checkQuote(quoteURL = this.getAttribute("quote") || "") {
    const quoteArea = this.shadowRoot.querySelector("#quote_tweet_url");
    const quoteText = this.shadowRoot.querySelector("#quote_tweet_text");
    if(/^https?:\/\/(mobile\.)?twitter\.com\//i.test(quoteURL)) {
      quoteText.textContent = chrome.i18n.getMessage("l_quote_tweet_url", quoteURL);
      quoteArea.style.display = "flex";
    } else {
      quoteText.textContent = "";
      quoteArea.style.display = "none";
    }
  }
}
customElements.define("silm-composer", SilMComposer);
