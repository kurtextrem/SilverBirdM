var TwitterLib = {
  URLS: {
    BASE: 'https://twitter.com/',
    SEARCH: 'https://twitter.com/search?q='
  }
};
var backgroundPage = chrome.extension.getBackgroundPage();
var tweetManager = backgroundPage.TweetManager.instance;
var twitterBackend = tweetManager.twitterBackend;
var OptionsBackend = tweetManager.getOptionsBackend();
var TimelineTemplate = tweetManager.getTimelineTemplate();

switch(location.pathname) {
  case "/popup.html":
    var shortener = tweetManager.shortener;

    if(backgroundPage.SecretKeys.hasValidKeys()
    && !twitterBackend.isAuthenticated()
    && !twitterBackend.isTokenRequested()) {
      twitterBackend.readyToEnteringPIN();
      twitterBackend.startAuthentication();
      window.close();
    }
    if(location.search === "?popup") {
      chrome.tabs.query({windowType: "popup"}, function(tabs) {
        tabs.forEach(function(tab) {
          if(tab.url.includes(chrome.runtime.id)) {
            chrome.windows.remove(tab.windowId);
          }
        });
      });
    }
    break;
  case "/options.html":
    break;
  default:
    window.close();
    break;
}

function doLocalization() {
  document.querySelectorAll(".i18n").forEach(function(node) {
    if(node.title) {
      node.setAttribute('title', chrome.i18n.getMessage(node.id));
    } else if(node.value && node.tagName !== 'OPTION') {
      node.setAttribute('value', chrome.i18n.getMessage(node.id));
    } else {
      node.textContent = chrome.i18n.getMessage(node.id);
    }
    node.classList.remove("i18n");
  });
}
