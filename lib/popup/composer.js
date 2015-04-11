var Composer = {
  replyId: null,
  replyUser: null,
  mediaIds: new Map(),
  maxAttachableMedia: 4,
  favoriteId: null,
  destroyTimelineId: null,
  macCommandKey: false,
  dmTargetNameLength: 0,
  fileReader: new FileReader(),
  picTwitterCom: 0,
  quoteTweetUrl: null,
  matchDM: new RegExp('^d ([a-zA-Z0-9_]+) '),
  matchHTTPS: new RegExp('https:\/\/[A-Z0-9\-\.\/\?\=\&\%\#\_]+', 'ig'), // lazy
  matchURL: new RegExp('(http|ftp|file):\/\/[A-Z0-9\-\.\/\?\=\&\%\#\_]+', 'ig'), // lazy
  matchTLD: new RegExp('[A-Z0-9\-][\.](A(ERO|SIA)|BIZ|C(OOP|AT|OM)|EDU|GOV|I(NFO|NT)|JOBS|M(USEUM|OBI|IL)|N(AME|ET)|ORG|PRO|T(RAVEL|EL)|XXX)(?![A-Z0-9])', 'ig'),
  matchSLD: new RegExp('[A-Z0-9\-][\.][A-Z0-9\-]{2,63}[\.](A(ERO|RPA|SIA|[C-GIL-OQ-UWXZ])|B(IZ|[ABD-JMNORSTVWYZ])|C(OOP|AT|OM|[ACDF-IK-ORU-Z])|D[EJKMOZ]|E(DU|[CEGR-U])|F[IJKMOR]|G(OV|[ABD-ILMNP-UWY])|H[KMNRTU]|I(NFO|NT|[DEL-OQ-T])|J(OBS|[EMOP])|K[EGHIMNPRWYZ]|L[ABCIKR-VY]|M(USEUM|OBI|IL|[ACDEGHK-Z])|N(AME|ET?|[ACFGILOPRUZ])|O(RG|M)|P(OST|RO?|[AE-HK-NSTWY])|QA|R[EOSUW]|S[A-EG-ORTUVXYZ]|T(RAVEL|EL|[CDFGHJ-PRTVWZ])|U[AGKSYZ]|V[ACEGINU]|W[FS]|X(XX|N)|Y[ET]|Z[AMW])(?![A-Z0-9])', 'ig'),
  fullMatchTLD: new RegExp('[^\/@]([A-Z0-9\-\.]+\.)?[A-Z0-9\-]{2,63}[\.](A(ERO|RPA|SIA|[C-GIL-OQ-UWXZ])|B(IZ|[ABD-JMNORSTVWYZ])|C(OOP|AT|OM|[ACDF-IK-ORU-Z])|D[EJKMOZ]|E(DU|[CEGR-U])|F[IJKMOR]|G(OV|[ABD-ILMNP-UWY])|H[KMNRTU]|I(NFO|NT|[DEL-OQ-T])|J(OBS|[EMOP])|K[EGHIMNPRWYZ]|L[ABCIKR-VY]|M(USEUM|OBI|IL|[ACDEGHK-Z])|N(AME|ET?|[ACFGILOPRUZ])|O(RG|M)|P(OST|RO?|[AE-HK-NSTWY])|QA|R[EOSUW]|S[A-EG-ORTUVXYZ]|T(RAVEL|EL|[CDFGHJ-PRTVWZ])|U[AGKSYZ]|V[ACEGINU]|W[FS]|X(XX|N)|Y[ET]|Z[AMW])(?![A-Z0-9])', 'ig'),

  bindEvents: function() {
    $("#tweet_text")
    .on("keyup.popup blur.popup", Composer.textareaChanged.bind(Composer))
    .on("keydown.popup", Composer.checkMacCommandKey.bind(Composer));
    $("#tweetit").on("click.popup", Composer.sendTweet.bind(Composer));
    var imageInput = $("#image_input");
    $("#upload_selector").on("click.popup", function(event) {
      if(Composer.mediaIds.size >= Composer.maxAttachableMedia) {
        Renderer.showError(chrome.i18n.getMessage("ue_max_attached_images"), null);
        return;
      }
      imageInput.trigger(event.type);
    });
    if(ThemeManager.isPopup && !(/^Win/i.test(navigator.platform))) {
      $('#upload_selector')
      .text(chrome.i18n.getMessage('detach_window_for_upload'))
      .off('.popup');
    } else {
      imageInput
      .on("change.popup", Composer.inputFileOnchange);
      $('#upload_selector').text(chrome.i18n.getMessage('select_images_for_upload'));
    }
    $("#compose_tweet").on("click.popup", function() {
      Composer.showComposeArea();
    });
    $("#shortener_area input")
    .on("focus.popup", Shortener.focus.bind(Shortener))
    .on("keyup.popup", Shortener.changed.bind(Shortener))
    .on("blur.popup", Shortener.blur.bind(Shortener));
    $("#shorten_current").on("click.popup", function(event) {
      if(event.ctrlKey || Composer.macCommandKey) {
        Shortener.shortenCurrentPage(true);
      } else {
        Shortener.shortenCurrentPage(false);
      }
    });
    $("#shortener_button").on("click.popup", function() {
      Shortener.shortenIt();
    });
  },

  init: function() {
    if(tweetManager.composerData.isComposing) {
      Composer.initMessage(tweetManager.composerData.saveMessage, tweetManager.composerData.replyId, tweetManager.composerData.replyUser, tweetManager.composerData.quoteTweetUrl, tweetManager.composerData.mediaIds, false);
    }
    Composer.textareaChanged();
    Composer.fileReader.addEventListener('load', Composer.fileReaderOnload);
  },

  initMessage: function(message, replyId, replyUser, quoteTweetUrl, mediaIds, shouldAnimate) {
    Composer.replyId = replyId;
    Composer.replyUser = replyUser;
    Composer.quoteTweetUrl = quoteTweetUrl;
    Composer.mediaIds = mediaIds || new Map();
    for(var entry of Composer.mediaIds.entries()) {
      Composer.addMediaId(entry[0], entry[1], true);
    }
    document.getElementById('tweet_text').value = message || '';
    Composer.showComposeArea(true, !shouldAnimate);
    Composer.textareaChanged();
  },

  quoteTweet: function (url) {
    Composer.showComposeArea(true);
    Composer.quoteTweetUrl = url;
    Composer.textareaChanged();
  },

  confirmDestroy: function(destroyId, destroyRT) {
    $("#loading").show();

    tweetManager.destroy(function(success, data, status) {
      $("#loading").hide();
      var notFound = status && status.match(/Not Found/);
      if(success || notFound) {
        $(".tweet").find("[tweetid='" + destroyId + "']").parents('.tweet_space').first().hide('blind', { direction: "vertical" });
        if(destroyRT !== "0") {
          tweetManager.retweetsMap.delete(destroyRT);
          loadTimeline(true);
        } else {
          for(var entry of tweetManager.retweetsMap.entries()) {
            if(entry[1] == destroyId) {
              tweetManager.retweetsMap.delete(entry[0]);
            }
          }
        }
        var currentCount = tweetManager.getCurrentTimeline().getTweetsCache().length;
        if(currentCount < OptionsBackend.get('tweets_per_page')) {
          Paginator.nextPage();
        }
      } else {
        Renderer.showError(chrome.i18n.getMessage("ue_deletingTweet", status), Composer.confirmDestroy.bind(Composer));
      }
    }, this.destroyTimelineId, destroyId);
  },

  destroy: function (node, retweet) {
    var $node = $(node), dialogTitle = '', dialogMessage = '', destroyId = '', destroyRT = '0';
    if(retweet) {
      destroyRT = $node.attr('tweetid');
      destroyId = tweetManager.retweetsMap.get(destroyRT);
      dialogTitle = chrome.i18n.getMessage("deleteRT");
      dialogMessage = chrome.i18n.getMessage("deleteRTConfirm");
    } else {
      destroyId = $node.attr('tweetid');
      dialogTitle = chrome.i18n.getMessage("Delete");
      dialogMessage = chrome.i18n.getMessage("deleteConfirm");
    }
    this.destroyTimelineId = $node.attr('timelineid');
    $('#confirm_dialog')
    .attr('data-tweet-action', 'destroy')
    .attr('data-tweet-id', destroyId)
    .attr('data-tweet-option', destroyRT)
    .text(dialogMessage)
    .dialog('option', 'title', dialogTitle)
    .dialog('open');
  },

  confirmRT: function(rtId) {
    $("#loading").show();
    tweetManager.postRetweet(function(success, data, status) {
      $("#loading").hide();
      if(success) {
        loadTimeline(true, "home");
      } else {
        Renderer.showError(chrome.i18n.getMessage("ue_retweeting", status), Composer.confirmRT.bind(Composer));
      }
    }, rtId);
  },

  retweet: function (node) {
    $('#confirm_dialog')
    .attr('data-tweet-action', 'retweet')
    .attr('data-tweet-id', $(node).attr('tweetid'))
    .text(chrome.i18n.getMessage("retweetConfirm"))
    .dialog('option', 'title', chrome.i18n.getMessage("Retweet"))
    .dialog('open');
  },

  favorite: function (node) {
    if(node) {
      this.favoriteId = $(node).attr('tweetid');
    }
    var loading = $("#loading");
    loading.show();
    tweetManager.favorite(function(success, data, status) {
      loading.hide();
      if(success) {
         Paginator.needsMore = false;
         loadTimeline();
      } else {
        Renderer.showError(chrome.i18n.getMessage("ue_markFavorite", status), Composer.favorite.bind(Composer));
      }
    }, this.favoriteId);
  },

  unFavorite: function (node) {
    if(node) {
      this.favoriteId = $(node).attr('tweetid');
    }
    var loading = $("#loading");
    loading.show();
    tweetManager.unFavorite(function(success, data, status) {
      loading.hide();
      if(success) {
         Paginator.needsMore = false;
         loadTimeline();
      } else {
        Renderer.showError(chrome.i18n.getMessage("ue_unmarkFavorite", status), Composer.unFavorite.bind(Composer));
      }
    }, this.favoriteId);
  },

  addUser: function (replies) {
    var textArea = $("#tweet_text");
    var currentVal = textArea.val();
    replies =  (function(array) {
      var result = [], hash = {};
      for(var i = 0, len = array.length; i < len; i++) {
        if(!hash[array[i]]) {
          result[result.length] = array[i];
          hash[array[i]] = true;
        }
      }
      return result;
    })(replies || []);
    if(currentVal.length > 0 && currentVal[currentVal.length - 1] != ' ') {
      currentVal += ' ';
    }
    currentVal += replies.join(' ') + ' ';
    textArea.val(currentVal);
  },

  reply: function (node) {
    Composer.showComposeArea(true);

    var $node = $(node);
    var textArea = $("#tweet_text");
    var user = $node.find(".user").eq(0).attr('screen_name');
    var timelineId = $node.attr('timelineid');

    if(timelineId == TimelineTemplate.RECEIVED_DMS || timelineId == TimelineTemplate.SENT_DMS) {
      textArea.val("d " + user + " ");
      Composer.textareaChanged();
      return;
    }

    var currentVal = textArea.val();
    var replies = ['@'+user];
    if(OptionsBackend.get('reply_all')) {
      var ownName = tweetManager.twitterBackend.username();
      $node.find(".text_container").find('a').each(function(){
        var t = $(this).text();
        if (t !== ownName && (/^[A-Z0-9_-]{1,15}$/i).test(t)) {
          var user = '@' + t;
          if (replies.indexOf(user) == -1)
            replies.push(user);
        }
      });
    }

    if(Composer.replyId && currentVal.indexOf(Composer.replyUser) != -1) {
      this.addUser(replies);
      Composer.textareaChanged();
      return;
    }

    this.addUser(replies);
    tweetManager.composerData.replyId = Composer.replyId = $node.attr('tweetid');
    tweetManager.composerData.replyUser = Composer.replyUser = user;

    Composer.textareaChanged();
  },

  showComposeArea: function (showOnly, noAnimation) {
    var composeArea = $("#compose_tweet_area");
    var textarea = document.getElementById('tweet_text');
    var visible = (composeArea.css('display') != 'none');
    var tmCompose = tweetManager.composerData;

    if(!visible) {
      if(noAnimation) {
        composeArea.show();
      } else {
        composeArea.show('blind', { direction: "vertical" }, 'normal', function() {
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
          textarea.focus();
        });
      }
      $("#compose_tweet").find("img").attr('src', 'img/arrow_up.gif');
      $("#composeTweet").text(chrome.i18n.getMessage('closeComposeTweet'));
      tmCompose.isComposing = true;
      Composer.syncComposerData();
    } else if(!showOnly) {
      if(noAnimation) {
        composeArea.hide();
      } else {
        composeArea.hide('blind', { direction: "vertical" });
      }
      $("#compose_tweet").find("img").attr('src', 'img/arrow_down.gif');
      $("#composeTweet").text(chrome.i18n.getMessage('composeTweet'));
      tmCompose.isComposing = false;
      Composer.resetComposerData(true);
      Composer.textareaChanged();
    }

    if((visible && showOnly) || (!visible && noAnimation)) {
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      textarea.focus();
    }
  },

  textareaChanged: function () {
    var str = document.getElementById('tweet_text').value || '';
    tweetManager.composerData.saveMessage = str;
    // check DM
    if(str == '') {
      Composer.maxAttachableMedia = 4;
      Composer.dmTargetNameLength = 0;
    } else {
      var isDM = str.match(Composer.matchDM);
      if(isDM !== null) {
        // Direct Message with Media is not enabled for 3rd-party applications.
        Composer.maxAttachableMedia = 0;
        Composer.dmTargetNameLength = isDM[1].length + 3; // "d[space]hogehoge[space]"
      } else {
        Composer.maxAttachableMedia = 4;
        Composer.dmTargetNameLength = 0;
      }
      for(var mediaId of Composer.mediaIds.keys()) {
        if(Composer.mediaIds.size > Composer.maxAttachableMedia) {
          Composer.mediaIds.delete(mediaId);
          $('#thumbnail-' + mediaId).off('.thumbnail').remove();
        } else break;
      }
    }
    // replace link anchor for counting strings
    str = str.replace(Composer.matchHTTPS, '!!!!!!!!!!!!!!!!!!!!!!!') // 23
             .replace(Composer.matchURL, '!!!!!!!!!!!!!!!!!!!!!!')  // 22
             .replace(Composer.matchTLD, '!!!!!!!!!!!!!!!!!!!!!!')  // 22
             .replace(Composer.matchSLD, '!!!!!!!!!!!!!!!!!!!!!!');  // 22
    // check quote tweet
    var lengthOfQuoteTweet = 0;
    if(Composer.quoteTweetUrl && Composer.quoteTweetUrl.length > 0) {
      lengthOfQuoteTweet = 24; // a white space and reserved https link
      tweetManager.composerData.quoteTweetUrl = Composer.quoteTweetUrl;
      $('#quote_tweet_url')
      .find('#quote_tweet_text')
      .text(chrome.i18n.getMessage("l_quote_tweet_url", Composer.quoteTweetUrl))
      .end()
      .attr('style', 'display: flex; align-items: center;')
      .on('click.quote', '#quote_tweet_dismiss', function(event) {
        Composer.quoteTweetUrl = null;
        $(event.target.parent).hide();
        $(event.target).off('.quote');
        Composer.textareaChanged();
      });
      Composer.clearUploadedFiles();
      $('#upload_area').hide();
    } else {
      lengthOfQuoteTweet = 0;
      tweetManager.composerData.quoteTweetUrl = null;
      $('#quote_tweet_url')
      .find('#quote_tweet_text')
      .text('')
      .end()
      .attr('style', 'display: none')
      .off('.quote', '#quote_tweet_dismiss');
      $('#upload_area').show();
    }
    // check mediaIds
    if(Composer.mediaIds.size == 0) {
      Composer.picTwitterCom = 0;
    } else {
      Composer.picTwitterCom = tweetManager.twitterConfiguration.characters_reserved_per_media;
    }
    // counting strings
    var countStrings = 0;
    for(var i of str) ++countStrings; // Strings iterator consider surrogate-pair of Unicode
    // result
    var availableChars = MAX_TWEET_SIZE - countStrings - Composer.picTwitterCom - lengthOfQuoteTweet + Composer.dmTargetNameLength;
    var charsLeftEl = document.getElementById("chars_left");
    charsLeftEl.textContent = availableChars;
    // attention
    if(availableChars < 0) {
      charsLeftEl.style.color = 'red';
    } else {
      charsLeftEl.style.color = 'black';
    }
    // check tweetable
    if(availableChars < 0 || availableChars == MAX_TWEET_SIZE) {
      $('#tweetit').attr("disabled", "disabled");
    } else {
      $('#tweetit').removeAttr("disabled");
    }
  },

  sendTweet: function () {
    if(document.getElementById('tweetit').getAttribute('disabled') == 'disabled') return;
    var message = document.getElementById('tweet_text').value || '';
    var regexpResult = message.match(Composer.matchDM);
    if(regexpResult !== null) {
      message = message.substring(regexpResult[1].length + 3);
      tweetManager.enqueueTweet(message, regexpResult[1], Composer.replyUser, true, Composer.mediaIds);
    } else {
      if(Composer.quoteTweetUrl && Composer.quoteTweetUrl.length > 0) {
        message = message + ' ' + Composer.quoteTweetUrl;
      }
      tweetManager.enqueueTweet(message, Composer.replyId, Composer.replyUser, false, Composer.mediaIds);
    }
    Composer.resetComposerData(true);
    Composer.textareaChanged();
    Composer.showComposeArea();
  },

  refreshNew: function() {
    if(loadingNewTweets) return;
    loadTimeline(true);
  },

  isVisible: function() {
    var composeArea = $("#compose_tweet_area");
    var textarea = composeArea.find("textarea");
    var visible = (composeArea.css("display") != 'none');
    return visible && textarea.val().length > 0;
  },

  addText: function(value) {
    var textarea = $("#tweet_text");
    var tmpText = textarea.val();
    if(tmpText.length > 0) {
      if((textarea[0].selectionStart > 0) &&
        (tmpText[textarea[0].selectionStart-1] != ' ')) {
        value = ' ' + value;
      }
      if((textarea[0].selectionEnd < tmpText.length) &&
         (tmpText[textarea[0].selectionEnd+1] != ' ')) {
         value += ' ';
      }
    }
    textarea.insertAtCaret(value);
    Composer.textareaChanged();
  },

  checkMacCommandKey: function(e) {
    if(!e) return;
    if((Composer.macCommandKey || e.ctrlKey) && e.which == 13) {
      Composer.macCommandKey = false;
      this.sendTweet();
      return;
    }
    if(e && (e.which == 91 || e.which == 93)) {
      Composer.macCommandKey = true;
    } else {
      Composer.macCommandKey = false;
    }
  },

  inputFileOnchange: function(event) {
    var files = event.target.files;
    if(files.length > 0) {
      var maxMediaPerUpload = tweetManager.twitterConfiguration.max_media_per_upload || 1,
          maxImageSize = tweetManager.twitterConfiguration.photo_size_limit;
      for(var i = 0, len = maxMediaPerUpload; i < len; i++) {
        var file = files[i];
        if(maxImageSize && file.size <= maxImageSize) {
          Composer.fileReader.readAsDataURL(files[i]);
        } else {
          Renderer.showError(chrome.i18n.getMessage("ue_too_big_image_size"), null);
          Composer.clearLoadedFile();
        }
      }
    }
  },

  fileReaderOnload: function(event) {
    var dataURI = event.target.result;
    tweetManager.twitterBackend.uploadMedia(function(success, data) {
      if(success && data.media_id_string) {
        Composer.addMediaId(data.media_id_string, dataURI);
      } else {
        console.warn(data);
        Renderer.showError(chrome.i18n.getMessage("ue_media_upload_error"), null);
      }
    }, dataURI.split(',')[1]);
    Composer.clearLoadedFile();
  },

  addMediaId: function(mediaId, dataURI, thumbnailOnly) {
    if(!mediaId || !dataURI) return;
    $(document.createElement('img'))
    .attr({
      "src": dataURI,
      "id": 'thumbnail-' + mediaId,
      "data-media-id": mediaId
    })
    .on({
      "load.thumbnail": function(event) {
        if(thumbnailOnly) return;
        var thumbnail = './img/dummy_thumbnail.png';
        try {
          var canvas = document.createElement('canvas');
          canvas.width = 16;
          canvas.height = 16;
          var context2d = canvas.getContext('2d');
          context2d.drawImage(event.target, 0, 0, canvas.width, canvas.height)
          thumbnail = canvas.toDataURL();
        } catch(e) {
          console.warn(e);
        } finally {
          context2d = null;
          canvas = null;
        }
        Composer.mediaIds.set(mediaId, thumbnail);
        tweetManager.composerData.mediaIds = Composer.mediaIds;
        Composer.quoteTweetUrl = ''; // quote tweet with multiple meida is not effect
        Composer.textareaChanged();
      },
      "click.thumbnail": function(event) {
        var clickedEl = $(event.target),
            mediaId = clickedEl.data('mediaId');
        if(Composer.mediaIds.has(mediaId)) {
          Composer.mediaIds.delete(mediaId);
          tweetManager.composerData.mediaIds = Composer.mediaIds;
          $('#dismiss-' + event.target.dataset.mediaId).remove();
          clickedEl.off('.thumbnail').remove();
          Composer.textareaChanged();
        }
      },
      "mouseover.thumbnail": function(event) {
        $('<span class="ui-icon ui-icon-circle-close" id="dismiss-' + event.target.dataset.mediaId + '"></span>').insertAfter(event.target).css('marginLeft', '-20px');
      },
      "mouseout.thumbnail": function(event) {
        $('#dismiss-' + event.target.dataset.mediaId).remove();
      }
    })
    .appendTo('#upload_preview');
  },

  clearLoadedFile: function() {
    var inputEl = $("#image_input");
    inputEl.replaceWith(inputEl.clone()).on("change.popup", Composer.inputFileOnchange);
  },

  clearUploadedFiles: function() {
    $('#upload_preview').empty();
    Composer.clearLoadedFile();
    Composer.mediaIds.clear();
  },

  resetComposerData: function(withSync) {
    document.getElementById('tweet_text').value = '';
    Composer.replyId = null;
    Composer.replyUser = null;
    Composer.quoteTweetUrl = null;
    Composer.clearUploadedFiles();
    Shortener.clear();
    if(withSync) Composer.syncComposerData();
  },

  syncComposerData: function() {
    var tmCompose = tweetManager.composerData;
    tmCompose.saveMessage = document.getElementById('tweet_text').value;
    tmCompose.replyId = Composer.replyId;
    tmCompose.replyUser = Composer.replyUser;
    tmCompose.quoteTweetUrl = Composer.quoteTweetUrl;
    tmCompose.mediaIds = Composer.mediaIds;
    Shortener.sync(document.getElementById('shortener_text').value);
  }
};
