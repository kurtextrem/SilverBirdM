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
    this.sendAction({action: "request", type: "bootstrap", detail: {}});
  }
  sendAction(action = {action: "echo"}) {
    chrome.runtime.sendMessage(this.appId, action, {}, (response) => {
      console.info(`sendAction: %s`, response);
    });
  }
  handlerSilMEvents(event, self = SilMPopup.getInstance()) {
    switch(event.detail) {
      case "bootstrap":
        self.handlerBootstrap(event.detail);
        break;
      case "update":
        self.handlerUpdate(event.detail);
        break;
      case "echo":
      default:
        console.info(event);
        break;
    }
  }
  handlerBootstrap(detail) {
    
  }
  handlerUpdate(detail) {
    
  }
  localize(nodes = document.querySelectorAll("i18n")) {
    if(!nodes[Symbol.iterator]) {
      nodes = [nodes];
    }
    nodes.forEach((node) => {
      const currentText = node.textContent || "";
      const converted = chrome.i18n.getMessage(node.id) || currentText;
      switch(true) {
        case !!node.title:
          node.setAttribute("title", converted);
          break;
        case !!node.value && node.tagName !== "OPTION":
          node.setAttribute("value", converted);
          break;
        default:
          node.textContent = converted;
          break;
      }
      node.classList.remove("i18n");
    });
  }
}
const popup = SilMPopup.getInstance();
