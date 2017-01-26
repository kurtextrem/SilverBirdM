var Shortener = {
  CHROME_QUERY_PARAMS: {
    status: "complete",
    windowType: "normal"
  },
  context: [],

  init: function() {
    $('#shortener_text').autocomplete({
      source: function(request, response) {
        chrome.tabs.query(Shortener.CHROME_QUERY_PARAMS, (tabs) => {
          Shortener.context = tabs.filter((entry) => /^https?:\/\//i.test(entry.url));
          response(Shortener.context.map((entry)  => entry.url));
        });
      },
      close: function(event, ui) {
        document.querySelector("silm-shortener").checkShortenable(true);
      },
      open: function(event, ui) {
        $(".ui-autocomplete").css({
          overflowX: 'hidden',
          overflowY: 'auto',
          maxHeight: '200px'
        });
      }
    });
  },

  shortenIt: function(context) {
    Shortener.shortenPage(document.getElementById('shortener_text').value, context);
  },

  shortenPage: function(longUrl, context) {
    const input = document.querySelector("#shortener_text");
    const uploading = document.querySelector("#uploading");
    showLoading(uploading);
    input.setAttribute("disabled", "disabled");
    if(context && context.withoutQuery) {
      longUrl = longUrl.split('?')[0];
    }
    shortener.shorten(longUrl, function(success, shortUrl, longUrl) {
      hideLoading(uploading);
      input.removeAttribute("disabled");
      if(success && shortUrl) {
        if(OptionsBackend.get('share_include_title')) {
          if(context && context.title) {
            shortUrl = context.title + ' - ' + shortUrl;
          } else if(longUrl) {
            var filterd = Shortener.context.filter(function(entry) {
              return longUrl == entry.url || longUrl == entry.url.split('?')[0];
            }) || [];
            if(filterd.length > 0) {
              shortUrl = filterd[0].title + ' - ' + shortUrl;
            }
          }
        }
        Composer.addText(shortUrl);
      } else if(!success) {
        Renderer.showError(shortUrl);
      }
      Composer.showComposeArea(true);
    });
  }
};
