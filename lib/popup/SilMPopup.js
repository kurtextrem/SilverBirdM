class SilMPopup {
  constructor() {
    if(!this.appId || (!!this.appId && !!SilMPopup.instance)) {
      throw new TypeError(`needs SilMPopup.getInstance()`);
    } else {
      this.__init();
    }
  }
  static getInstance() {
    if(!this.prototype.appId) {
      Object.defineProperties(this.prototype, {
        "appId": {
          value: chrome.runtime.id
        }
      });
      this.instance = new SilMPopup();
      Object.freeze(this);
    }
    return this.instance;
  }
  __init() {
    if(!window) {
      throw new TypeError("missing window");
    }
    window.addEventListener("silm", this.handlerSilMEvents);
  }
  sendAction(action = {action: "echo"}) {
    chrome.runtime.sendMessage(this.appId, action, {}, (response) => {
      console.info(`sendAction: %s`, response);
    });
  }
  handlerSilMEvents(event, self = SilMPopup.getInstance()) {
    console.info(event);
  }
  localize(nodes = document.querySelectorAll("i18n")) {
    if(!nodes[Symbol.iterator]) {
      nodes = [nodes];
    }
    nodes.forEach((node) => {
      if(node.title) {
        node.setAttribute("title", chrome.i18n.getMessage(node.id));
      } else if(node.value && node.tagName !== "OPTION") {
        node.setAttribute("value", chrome.i18n.getMessage(node.id));
      } else {
        node.textContent = chrome.i18n.getMessage(node.id);
      }
      node.classList.remove("i18n");
    });
  }
}
const popup = SilMPopup.getInstance();
