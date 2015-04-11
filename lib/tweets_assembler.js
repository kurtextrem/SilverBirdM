var TwitterLib = {
  URLS: {
    BASE: 'https://twitter.com/',
    SEARCH: 'https://twitter.com/search?q='
  }
};

var Renderer = {
  setContext: function(ctx) {
    this.context = ctx;
  },

  isDesktop: function() {
    return this.context == 'desktop';
  },

  isComplete: function() {
    return this.context == 'popup' || this.context == 'standalone';
  },

  isStandalone: function() {
    return this.context == 'standalone';
  },

  isNotification: function() {
    return this.context == 'desktop';
  },

  getTimestampText: function (inputTimestamp) {
    var diff = (Date.now() - inputTimestamp) * 0.001 | 0;

    if(diff < 15) {
      return chrome.i18n.getMessage("justNow");
    } else if(diff < 60) {
      return chrome.i18n.getMessage("minuteAgo");
    } else if(diff < 60 * 60) {
      var minutes = parseInt(diff / 60, 10);
      var minute_string = minutes > 1 ? "minute_plural" : "minute_singular";
      return chrome.i18n.getMessage('minutes', [minutes, chrome.i18n.getMessage(minute_string)]);
    } else if(diff < 60 * 60 * 24) {
      var hours = parseInt(diff / (60 * 60), 10);
      var hour_string = hours > 1 ? "hour_plural" : "hour_singular";
      return chrome.i18n.getMessage("timeAgo", [hours, chrome.i18n.getMessage(hour_string)]);
    } else if(diff < 60 * 60 * 24 * 30) {
      var days = parseInt(diff / (60 * 60 * 24), 10);
      var day_string = days > 1 ? "day_plural" : "day_singular";
      return chrome.i18n.getMessage("timeAgo", [days, chrome.i18n.getMessage(day_string)]);
    } else if(diff < 60 * 60 * 24 * 365) {
      var months = parseInt(diff / (60 * 60 * 24 * 30), 10);
      var month_string = months > 1 ? "month_plural" : "month_singular";
      return chrome.i18n.getMessage("timeAgo", [months, chrome.i18n.getMessage(month_string)]);
    } else {
      var years = parseInt(diff / (60 * 60 * 24 * 365), 10);
      var years_string = years > 1 ? "year_plural" : "year_singular";
      return chrome.i18n.getMessage("timeAgo", [years, chrome.i18n.getMessage(years_string)]);
    }
  },

  getTimestampAltText: function (inputTimestamp) {
    return `${new Date(inputTimestamp).toLocaleDateString()} ${new Date(inputTimestamp).toLocaleTimeString()}`;
  },

  entitiesFuncs: {
    typeMap: function(type) {
      return function(e) {e.type = type; return e;};
    },
    indexSort: function(e1, e2) {
      return e1.indices[0] - e2.indices[0];
    }
  },

  entitiesRegexp: {
    quoteTweet: new RegExp('^https?://twitter.com/[a-z0-9_]{1,15}?/status/(\\d+)$', 'i'),
    matchNormal: new RegExp('_normal\.(jpe?g|gif|png|bmp|tiff)$', 'i')
  },

  parseEntities: function(text, entities, extended_entities, tweetspaceId) {
    var mapFunc = this.entitiesFuncs.typeMap,
        sortFunc = this.entitiesFuncs.indexSort,
        quoteRegexp = this.entitiesRegexp.quoteTweet;
    var mediaEntities = entities.media || [];
    var extendedMediaEntities = extended_entities.media || [];
    var orderedEntities = [].concat(
        entities.hashtags.map(mapFunc('hashtag')),
        entities.urls.map(mapFunc('url')),
        entities.user_mentions.map(mapFunc('mention')),
        mediaEntities.map(mapFunc('media')));
    orderedEntities.sort(sortFunc);
    var totalInc = 0, elements = '', i, len, entity, indices, link, handleLink;
    for (i = 0, len = orderedEntities.length; i < len; ++i) {
      entity = orderedEntities[i];
      indices = entity.indices;
      link = null;
      handleLink = '';
      elements += text.substring(totalInc, indices[0]).replace(/\r|\r?\n/g, '<br />');
      if(entity.type === 'mention') {
        elements += `@<a href="#" class="createUserActionMenu" data-user-id="${entity.id_str}" data-user-name="${entity.screen_name}">${entity.screen_name}</a>`;
      } else if(entity.type === 'hashtag') {
        elements += `<a href="#" class="handleHashTag" data-handle-hash-tag="${entity.text}">#${entity.text}</a>`;
      } else if(entity.type === "media" && extendedMediaEntities.length > 1) {
        elements += `<a href="${entity.url}" class="handleLink" data-handle-link-noexpand="true" data-handle-link-base="${entity.expanded_url}" data-handle-link-expanded="undefined" data-handle-link-media="undefined">${entity.display_url}</a> ${extendedMediaEntities.map(function(value, index) {
          if(value.display_url[value.display_url.length - 1].charCodeAt(0) == 8230) { // Ends with ...
            title = ` title="${value.expanded_url}"`;
          }
          return `<a href="${value.url}" class="handleLink" data-handle-link-base="${value.url}" data-handle-link-expanded="${value.expanded_url}" data-handle-link-media="${value.media_url_https}"${title}>[${(index + 1)}]</a>`;
        }).join(' ')}`;
      } else if(entity.type === 'url' && quoteRegexp.test(entity.expanded_url)) {
        var quotedTweetEntity = escape(JSON.stringify({"in_reply_to_status_id": quoteRegexp.exec(entity.expanded_url)[1] || ""}));
        elements += `<span><span class="glyphicon glyphicon-link"></span><a href="${entity.url}" class="expandInReply" data-handle-link-base="${entity.url}" data-handle-link-expanded="${entity.expanded_url}" data-handle-link-media="${entity.media_url_https}" data-expand-in-reply-tweet="${quotedTweetEntity}" data-expand-in-reply-id="${tweetspaceId}" title="${chrome.i18n.getMessage("expand_quote_tweet")}">${entity.display_url}</a></span>`;
      } else if(entity.type === 'url' || entity.type === 'media' || entity.type === 'photo') {
        var title = '';
        if(entity.display_url[entity.display_url.length - 1].charCodeAt(0) == 8230) { // Ends with ...
          title = ` title="${entity.expanded_url}"`;
        }
        elements += `<a href="${entity.url}" class="handleLink" data-handle-link-base="${entity.url}" data-handle-link-expanded="${entity.expanded_url}" data-handle-link-media="${entity.media_url_https}"${title}>${entity.display_url}</a>`;
      } else {
        elements += text.substring(indices[0], indices[1]).replace(/\r|\r?\n/g, '<br />');
      }
      totalInc = indices[1];
    }
    elements += text.substring(totalInc, text.length).replace(/\r|\r?\n/g, '<br />');
    return elements;
  },

  renderTweet: function (tweet, useColors) {
    var user = tweet.user;
    var text = tweet.text;
    var tweetId = tweet.id;
    var entities = tweet.entities;
    var extended_entities = tweet.extended_entities || {};
    var selfTweet = (tweet.user.id_str == tweetManager.twitterBackend.userid());
    if(tweet.retweeted_status) {
      user = tweet.retweeted_status.user;
      text = tweet.retweeted_status.text;
      tweetId = tweet.retweeted_status.id;
      if(tweet.retweeted_status.in_reply_to_status_id) {
        tweet.in_reply_to_status_id = tweet.retweeted_status.in_reply_to_status_id;
        tweet.in_reply_to_screen_name = tweet.retweeted_status.in_reply_to_screen_name;
      }
      entities = tweet.retweeted_status.entities;
      extended_entities = tweet.retweeted_status.extended_entities || {};
      if(selfTweet && !tweetManager.isRetweet(tweet)) {
        tweetManager.retweetsMap.set(tweetId, tweet.id);
      }
    }
    var tweetspaceId = `id${Date.now()}${tweet.id}`;
    var tweetTimeline = tweet.originalTimelineId || tweet.timelineId || tweetManager.currentTimelineId || 'home';
    var templateId = tweetTimeline.replace(/_.*$/, '');

    // Twitter Display Requirements Options
    var compliantTDR, hiddenUserIcons, nameAttribute, displaySimpleName, hiddenFooter, hiddenTimestamp,
        hiddenReplyInfo, hiddenRetweetInfo, hiddenClientName, hiddenDMInfo, hiddenGeoInfo, hiddenListInfo;
    if(typeof OptionsBackend === 'undefined' || OptionsBackend.get('compliant_twitter_display_requirements')) {
      compliantTDR = true;
      hiddenUserIcons = false;
      nameAttribute = 'both';
      displaySimpleName = false;
      hiddenFooter = false;
      hiddenTimestamp = false;
      hiddenReplyInfo = false;
      hiddenRetweetInfo = false;
      hiddenClientName = false;
      hiddenDMInfo = false;
      hiddenGeoInfo = false;
      hiddenListInfo = false;
    } else {
      compliantTDR = false;
      hiddenUserIcons = OptionsBackend.get('hidden_user_icons');
      nameAttribute = OptionsBackend.get('name_attribute');
      displaySimpleName = OptionsBackend.get('display_simple_name');
      hiddenFooter = OptionsBackend.get('hidden_footer');
      hiddenTimestamp = OptionsBackend.get('hidden_timestamp');
      hiddenReplyInfo = OptionsBackend.get('hidden_reply_info');
      hiddenRetweetInfo = OptionsBackend.get('hidden_retweet_info');
      hiddenClientName = OptionsBackend.get('hidden_client_name');
      hiddenDMInfo = OptionsBackend.get('hidden_dm_info');
      hiddenGeoInfo = OptionsBackend.get('hidden_geo_info');
      hiddenListInfo = OptionsBackend.get('hidden_list_info');
    }

    // tweet space
    var timestamp_content, timestamp_url = '', timestamp_option = '',
        overlayStyle = '', profile_container = '', header_container = '', userNameHref = 'href="#"',
        userVerified = '', userProtected = '', bothContent = '</div><div class="secondary_name">',
        text_container = '', footer_content = '', footer_container = '', newActions_container = '';

    // profile_container
    if(!hiddenUserIcons) {
      var profileIconSize, profileIconStyle, replaceRegExp = this.entitiesRegexp.matchNormal, tweetIconUrl, retweeterIconUrl;
      switch(OptionsBackend.get('icon_size')) {
        case 'icon_small':
          profileIconSize = '_mini';
          profileIconStyle = 'icon_small'; // 24px
          break;
        case 'icon_large':
          profileIconSize = '_bigger';
          profileIconStyle = 'icon_large'; // 73px
          break;
        case 'icon_max':
          profileIconSize = '';
          profileIconStyle = 'icon_max'; // 128px
          break;
        case 'icon_normal':
        default:
          profileIconSize = '_normal';
          profileIconStyle = 'icon_normal'; // 48px
          break;
      }
      if(tweet.retweeted_status) {
        tweetIconUrl = user.profile_image_url.replace(replaceRegExp, profileIconSize + '.$1');
        retweeterIconUrl = tweet.user.profile_image_url.replace(replaceRegExp, profileIconSize + '.$1');
        profile_container = `<div class="profile_container"><img data-user-id="${user.id_str}" data-user-name="${user.screen_name}" class="createUserActionMenu profile retweet_source ${profileIconStyle}" src="${tweetIconUrl}"/><img data-user-id="${tweet.user.id_str}" data-user-name="${tweet.user.screen_name}" class="createUserActionMenu profile retweet_retweeter ${profileIconStyle}" src="${retweeterIconUrl}"/></div>`;
      } else {
        tweetIconUrl = user.profile_image_url.replace(replaceRegExp, profileIconSize + '.$1');
        profile_container = `<div class="profile_container"><img data-user-id="${user.id_str}" data-user-name="${user.screen_name}" class="createUserActionMenu profile ${profileIconStyle}" src="${tweetIconUrl}" /></div>`;
      }
    }

    // header_container
    if(user.verified && !displaySimpleName) {
      userVerified = `<span class="glyphicon glyphicon-check" title="${chrome.i18n.getMessage('verified_account')}"></span>`;
    }
    if(user['protected'] && !displaySimpleName) {
      userProtected = `<span class="glyphicon glyphicon-lock" title="${chrome.i18n.getMessage('protected_account')}"></span>`;
    }
    if(nameAttribute == "both") {
      if(displaySimpleName) bothContent = '';
      header_container = `<div class="header_container"><div class="primary_name"><a ${userNameHref} data-user-id="${user.id_str}" data-user-name="${user.screen_name}" class="createUserActionMenu user" screen_name="${user.screen_name}">${user.name}</a>${userVerified}${userProtected}${bothContent}<a ${userNameHref} data-user-id="${user.id_str}" data-user-name="${user.screen_name}" class="createUserActionMenu user" screen_name="${user.screen_name}">@${user.screen_name}</a></div></div>`;
    } else if(nameAttribute == "screen_name") {
      header_container = `<div class="header_container"><div class="primary_name"><a ${userNameHref} data-user-id="${user.id_str}" data-user-name="${user.screen_name}" class="createUserActionMenu user" screen_name="${user.screen_name}" title="${user.name}">@${user.screen_name}</a>${userVerified}${userProtected}</div></div>`;
    } else if(nameAttribute == "name") {
      header_container = `<div class="header_container"><div class="primary_name"><a ${userNameHref} data-user-id="${user.id_str}" data-user-name="${user.screen_name}" class="createUserActionMenu user" screen_name="${user.screen_name}" title="@${user.screen_name}">${user.name}</a>${userVerified}${userProtected}</div></div>`;
    }

    // text_container
    text_container = `<div class="text_container">${this.parseEntities(text, entities, extended_entities, tweetspaceId)}</div>`;

    // footer_container
    if(this.isComplete() && !hiddenFooter) {
      // timestamp
      if(!hiddenTimestamp) {
        var parsedTime = Date.parse(tweet.created_at);
        timestamp_url = `${TwitterLib.URLS.BASE}${user.screen_name}/status/${tweetId}`;
        footer_content += `<span class="timestamp"><a class="handleLink" data-handle-link-noexpand="true" data-handle-link-base="${timestamp_url}" title="${Renderer.getTimestampAltText(parsedTime)}" href="${timestamp_url}">${Renderer.getTimestampText(parsedTime)}</a></span>`;
      }
      // reply
      if(!hiddenReplyInfo && tweet.in_reply_to_status_id) {
        footer_content += `<span class="inReply">${chrome.i18n.getMessage("inReply_prefix")}<a class="expandInReply" data-expand-in-reply-tweet="${escape(JSON.stringify({"in_reply_to_status_id": tweet.in_reply_to_status_id}))}" data-expand-in-reply-id="${tweetspaceId}" href="#">${tweet.in_reply_to_screen_name}</a>${chrome.i18n.getMessage("inReply_suffix")}</span>`;
      }
      // retweet
      if(!hiddenRetweetInfo && tweet.retweeted_status) {
        if(selfTweet) {
          footer_content += `<span class="selfRetweet"><span class="glyphicon glyphicon-retweet"></span>${chrome.i18n.getMessage("retweetedByMe")}`;
        } else {
          footer_content += `<span class="inRetweet"><span class="glyphicon glyphicon-retweet"></span>${chrome.i18n.getMessage("retweetedBy_prefix")}<a href="${TwitterLib.URLS.BASE}${tweet.user.screen_name}" data-user-id="${tweet.user.id_str}" data-user-name="${tweet.user.screen_name}" class="createUserActionMenu">${tweet.user.screen_name}</a>${chrome.i18n.getMessage("retweetedBy_suffix")}`;
        }
        if(tweet.retweet_count > 0) {
          footer_content += ` (${chrome.i18n.getMessage("retweetedCount_prefix")}${tweet.retweet_count}${chrome.i18n.getMessage("retweetedCount_suffix")})</span>`;
        }
      }
      // from App
      if(!hiddenClientName && tweet.source) {
        footer_content += `<span class="from_app">${chrome.i18n.getMessage("fromApp_prefix")}${tweet.source.replace(/href=/i, 'class="handleLink" href="#" data-handle-link-noexpand="true" data-handle-link-base=')}${chrome.i18n.getMessage("fromApp_suffix")}</span>`;
      }
      // DM
      if(!hiddenDMInfo && templateId == TimelineTemplate.SENT_DMS) {
        footer_content += `<span class="dm_recipient">${chrome.i18n.getMessage("sentTo_prefix")}<a href="#" data-user-id="${tweet.recipient.id_str}" data-user-name="${tweet.recipient.screen_name}" class="createUserActionMenu">${tweet.recipient.name}</a>${chrome.i18n.getMessage("sentTo_suffix")}</span>`;
      }
      // geo
      if(!hiddenGeoInfo && tweet.geo) {
        var coords = tweet.geo.coordinates;
        if(typeof coords[0] != 'number') {
          coords[0] = 0.0;
        }
        if(typeof coords[1] != 'number') {
          coords[1] = 0.0;
        }
        var latStr = `${coords[0]},${coords[1]}`;
        var mapParam = $.param({center: latStr, zoom: 15, size: '200x200', maptype: 'roadmap', markers: 'size:small|' + latStr, sensor: false});
        footer_content += `<span class="geo_tag"><a class="handleLink tooltip" data-handle-link-base="http://maps.google.com/maps?q=loc:${latStr}" data-tooltip-content="<img src=\'http://maps.google.com/maps/api/staticmap?${mapParam}\' />" href="#"><span class="glyphicon glyphicon-map-marker"></span></a></span>`;
      }
      // from list
      if(!hiddenListInfo && templateId == TimelineTemplate.LISTS && tweetManager.currentTimelineId != tweetTimeline) {
        var list = tweetManager.getList(tweetTimeline);
        if(list !== null) {
          var linkPath = list.uri.substr(1);
          footer_content += `<span class="from_list">(${chrome.i18n.getMessage("f_footer_list")}: <a class="handleLink" data-handle-link-noexpand="true" data-handle-link-base="${TwitterLib.URLS.BASE}${linkPath}" href="#" title="@${linkPath}">${list.name}</a>)</span>`;
        }
      }
    }
    if(!hiddenFooter) {
      footer_container = `<div class="footer_container">${footer_content}</div>`;
    }

    // new_actions
    if(this.isComplete() && !/^Notification/.test(tweet.id)) {
      newActions_container = '<div class="new_actions">';
      if(templateId != TimelineTemplate.RECEIVED_DMS && templateId != TimelineTemplate.SENT_DMS) {
        if(tweet.favorited) {
          newActions_container += `<span class="glyphicon glyphicon-star new_actions_item" title="${chrome.i18n.getMessage('unmarkFavorite')}"></span>`;
        } else {
          newActions_container += `<span class="glyphicon glyphicon-star-empty new_actions_item" title="${chrome.i18n.getMessage('markFavorite')}"></span>`;
        }
      }
      if(selfTweet) {
        var titleStrig;
        if(tweet.retweeted_status) {
          titleString = chrome.i18n.getMessage("deleteRT");
        } else {
          titleString = chrome.i18n.getMessage("Delete");
        }
        newActions_container += `<span class="glyphicon glyphicon-trash new_actions_item" title="${titleString}"></span>`;
      } else {
        newActions_container += `<span class="glyphicon glyphicon-reply new_actions_item" title="${chrome.i18n.getMessage("Reply")}"></span>`;
        if(tweetManager.isRetweet(tweet)) {
          newActions_container += `<span class="glyphicon glyphicon-remove-circle new_actions_item" title="${chrome.i18n.getMessage("deleteRT")}"></span>`;
        } else {
          if(templateId != TimelineTemplate.RECEIVED_DMS && templateId != TimelineTemplate.SENT_DMS && !user['protected']) {
            newActions_container += `<span class="glyphicon glyphicon-retweet new_actions_item" title="${chrome.i18n.getMessage("Retweet")}"></span>`;
          }
        }
        if(!user['protected']) {
          newActions_container += `<span class="glyphicon glyphicon-comment new_actions_item" title="${chrome.i18n.getMessage("quoteTweet")}" data-quote-tweet-url="${timestamp_url}"></span>`;
        }
      }
      newActions_container += '</div>';
    }

    // build tweetSpace
    if(this.isComplete()) {
      if(useColors) overlayStyle = `background-color: ${TimelineTemplate.getTemplate(templateId).overlayColor};`;
    }
    return `<div class="tweet_space" id="${tweetspaceId}"><div class="chromed_bird_tweet tweet" timelineid="${tweetTimeline}" tweetid="${tweet.id}"><div class="tweet_overlay" style="${overlayStyle}"><div class="first_container">${profile_container}${header_container}${text_container}${footer_container}</div>${newActions_container}</div></div></div>`;
  }
};

function openTab(tabUrl) {
  var background = true;
  if(event) {
    if(event.button == 2) {
      return true;
    }
    if(event.button == 1 || event.metaKey || event.ctrlKey) {
      background = true;
    }
  }
  if(!(/^https?:\/\//.test(tabUrl))
  && !(/^chrome-extension:\/\//.test(tabUrl))) {
    tabUrl = "http://" + tabUrl;
  }
  tabUrl.replace(/\W.*$/, "");
  if(!background) {
    var obj = chrome.tabs.create({
      url: tabUrl,
      selected: !background
    });
    if(background && obj) {
      obj.blur();
    }
  } else {
    chrome.tabs.create({
      url: tabUrl,
      selected: !background
    });
  }
  return true;
}
