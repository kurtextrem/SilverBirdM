class SilMTweetArea extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({mode: "open"});
    shadowRoot.innerHTML = `
      <style>
        @import "./css/silm_reset.css";
        :host {
          flex: 100 1 auto; /* flex item from #compose_tweet_area */
          width: calc(100% - 2px);
          margin: 0;
          padding: 0;
          border-radius: 5px;
          background-color: var(--main-bg-color);
          border: 1px solid var(--main-bd-color);
          display: flex;
          flex-flow: column nowrap;
        }
        textarea {
          flex: 100 1 auto; /* flex item from :host */
          width: calc(100% - 4px);
          border: none;
          border-radius: 5px;
          background-color: transparent;
        }
      </style>
      <textarea></textarea>
    `;
    Object.defineProperties(this, {
      "io": {
        value: new IntersectionObserver((changes) => {
          for(let change of changes) {
            let target = change.target;
            if(change.intersectionRatio === 1) {
              requestIdleCallback(() => {
                const textarea = this.shadowRoot.querySelector("textarea");
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                textarea.focus();
              });
            }
          }
        }, {
          threshold: [0, 1]
        })
      },
      "value": {
        get: () => {
          return this.shadowRoot.querySelector("textarea").value;
        },
        set: (str = "") => {
          this.shadowRoot.querySelector("textarea").value = str;
        }
      },
      "startPosition": {
        value: 0,
        writable: true
      }
    });
  }
  connectedCallback() {
    this.io.observe(this);
    // event binding
    const textarea = this.shadowRoot.querySelector("textarea");
    if(!!textarea) {
      textarea.handleKeyDown = (event) => {
        if(event.defaultPrevented) {
          return;
        }
        if((Composer.macCommandKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          Composer.macCommandKey = false;
          Composer.sendTweet();
        }
      };
      textarea.addEventListener("keydown", textarea.handleKeyDown);
      textarea.handleKeyUp = (event) => {
        if(event.defaultPrevented) {
          return;
        }
        Composer.textareaChanged();
      };
      textarea.addEventListener("keyup", textarea.handleKeyUp);
      textarea.handleBulr = (event) => {
        Composer.textareaChanged();
      };
      textarea.addEventListener("blur", textarea.handleBulr);
    }
    // autocomplete
    if(OptionsBackend.get('show_user_autocomplete')) {
      $(this.shadowRoot.querySelector("textarea")).autocomplete({
        source: (request, response) => {
          let hintStr = request.term;
          const usersList = tweetManager.getFollowingUsers();
          if(usersList.length === 0) {
            return response([]);
          }
          const lastSpaceIdx = hintStr.lastIndexOf(' ');
          if(hintStr.substr(lastSpaceIdx + 1, 1) === '@') {
            this.startPosition = lastSpaceIdx + 2;
          } else if(lastSpaceIdx === 1 && (hintStr.substr(0, 1) === 'd' || hintStr.substr(0, 1) === 'm')) {
            this.startPosition = 2;
          } else {
            return response([]);
          }
          hintStr = hintStr.substr(this.startPosition).toLowerCase();
          response(usersList.filter((user) => {
            return user.toLowerCase().indexOf(hintStr) === 0;
          }));
        },
        focus: (event, ui) => {
          const textarea = this.shadowRoot.querySelector("textarea");
          const oldLen = textarea.value.length;
          textarea.value = textarea.value.substring(0, this.startPosition) + ui.item.value;
          textarea.setSelectionRange(oldLen, textarea.value.length);
          return false;
        },
        select: (event, ui) => {
          const textarea = this.shadowRoot.querySelector("textarea");
          textarea.value = textarea.value.substring(0, this.startPosition) + ui.item.value + ' ';
          const valueLen = textarea.value.length;
          textarea.setSelectionRange(valueLen, valueLen);
          return false;
        },
        open: (event, ui) => {
          $('.ui-autocomplete').css({
            overflowX: 'hidden',
            overflowY: 'auto',
            maxHeight: '200px'
          });
        }
      });
    }
  }
  disconnectedCallback() {
    this.io.unobserve(this);
    // event unbinding
    const textarea = this.shadowRoot.querySelector("textarea");
    if(!!textarea) {
      textarea.removeEventListener("keydown", textarea.handleKeyUp);
      textarea.removeEventListener("keyup", textarea.handleKeyUp);
      textarea.removeEventListener("blur", textarea.handleBulr);
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
}
customElements.define("silm-tweetarea", SilMTweetArea);
