"use strict";
class TwitterLib {
  constructor(onAuthenticatedCallback, oauthTokenData, consumerSecret, consumerKey) {
    if(typeof onAuthenticatedCallback === "undefined") {
      throw new TypeError("onAuthenticatedCallback is needed");
    } else if(typeof onAuthenticatedCallback !== "function") {
      throw new TypeError("onAuthenticatedCallback must be function");
    }
    Object.defineProperties(this, {
      "onAuthenticated": {
        value: onAuthenticatedCallback
      },
      "oauthLib": {
        value: new TwitterOAuth(
          oauthTokenData,
          ((self) => {
            return () => {
              self.verifyCredentials(self.onAuthenticated);
            };
          })(this),
          consumerSecret,
          consumerKey
        )
      },
      "snowflakeIdRegexp": {
        value: new RegExp("^(.*)_str$")
      },
      "userData": {
        value: {
          id_str: undefined,
          screen_name: undefined
        },
        writable: true
      }
    });
  }
  static get URLS() {
    return {
      BASE: 'https://api.twitter.com/1.1/',
      BASE_OAUTH: 'https://api.twitter.com/oauth/',
      BASE_SIGNING: 'https://api.twitter.com/1.1/',
      BASE_OAUTH_SIGNING: 'https://api.twitter.com/oauth/'
    };
  }
  get userId() {
    return this.userData.id_str;
  }
  get userName() {
    return this.userData.screen_name;
  }
  isAuthenticated() {
    return this.oauthLib.authenticated || false;
  }
  isTokenRequested() {
    return this.oauthLib.tokenRequested || false;
  }
  isAuthenticating() {
    return this.oauthLib.authenticating || false;
  }
  startAuthentication() {
    if(!this.oauthLib.authenticating) {
      this.oauthLib.getRequestToken();
    }
  }
  generateOauthHeader(signedData) {
    return 'OAuth ' +
      'oauth_consumer_key="' + signedData.oauth_consumer_key + '", ' +
      'oauth_nonce="' + encodeURIComponent(signedData.oauth_nonce) + '", ' +
      'oauth_signature="' + encodeURIComponent(signedData.oauth_signature) + '", ' +
      'oauth_signature_method="HMAC-SHA1", ' +
      'oauth_timestamp="' + signedData.oauth_timestamp + '", ' +
      'oauth_token="' + signedData.oauth_token + '", ' +
      'oauth_version="1.0"';
  }
  signOauth(xhr, url, params, method) {
    var signedData = this.oauthLib.prepareSignedParams(url, params, method);
    xhr.setRequestHeader('Authorization', this.generateOauthHeader(signedData));
  }
  ajaxRequest(params) {
    var url = params.endpoint,
        callback = params.callback,
        context = params.context,
        requestParams = params.requestParams || {},
        httpMethod = params.httpMethod || 'GET',
        overriddenTimeout = params.overriddenTimeout,
        baseUrl = params.baseUrl || TwitterLib.URLS.BASE_SIGNING,
        targetId = params.targetId;
    if(targetId && targetId !== '') url = [url, targetId].join('/');
    var requestUrl = baseUrl + url + ".json";
    var signingUrl = baseUrl + url + ".json";
    var beforeSendCallback = function(self) {
      return function(request, settings) {
        self.signOauth(request, signingUrl, requestParams, httpMethod);
      };
    };
    var errorCallback = function(self) {
      return function(request, status, error) {
        console.warn("Failed Request", requestUrl + '?' + $.param(requestParams), request, status, error);
        var fmtError = '', rspObj = {}, retry = true;
        if(request.status === 0 && status === "error") {
          this.suspend = true;
          callback(false, null, 0, context, request, false);
          return;
        }
        try{
          const parsedJSON = JSON.parse(request.responseText);
          if(parsedJSON.hasOwnProperty("errors") && Array.isArray(parsedJSON.errors)) {
            rspObj = parsedJSON.errors[0];
          } else if(parsedJSON.hasOwnProperty("error")) {
            rspObj = parsedJSON.error;
          } else {
            throw new TypeError("Error Response");
          }
        } catch(e) {
          console.info("JSON.parse Error: %o: request: %o", e, request);
          callback(false, null, 500, context, request, false);
        }
        if(status == 'timeout') {
          // Gateway timeout
          fmtError = 504;
        } else if(status == 'canceled') {
          // Too Many Requests
          fmtError = 429;
        } else {
          try {
            switch(request && request.readyState === 4) {
              case (rspObj.code === 89):
                // Invalid or expired token
                TweetManager.instance.signoutAndReauthenticate();
                return;
              case (rspObj.code === 251):
                // This endpoint has been retired and should not be used.
                fmtError = rspObj.code;
                console.error(rspObj.message);
                retry = false;
                break;
              case (rspObj.code === 226):
                // This request looks like it might be automated. To protect our users from spam and other malicious activity, we can�ft complete this action right now.
                fmtError = rspObj.code;
                console.error(rspObj.message);
                retry = false;
                break;
              case (request.status === 401):
                retry = false;
                switch(true) {
                  case (/user_timeline/.test(url)):
                    fmtError = "(This user is protected)";
                    break;
                  case (/verify_credentials/.test(url)):
                    TweetManager.instance.signoutAndReauthenticate();
                    return;
                  case (self.oauthLib.adjustTimestamp(request, 'Date')):
                    console.log('Unauthorized, trying again using adjusted timestamp based on server time.');
                    self.ajaxRequest(params);
                    return;
                  default:
                    // Could not authenticate you
                    fmtError = request.status;
                    console.warn(`${rspObj.request}:${rspObj.error}`);
                    console.warn(request.responseText);
                    break;
                }
                break;
              case (request.status === 400 || request.status === 403):
                retry = false;
                switch(true) {
                  case (rspObj.code === 64):
                    // Your account is suspended and is not permitted to access this feature
                    alert(rspObj.message);
                    TweetManager.instance.signout();
                    return;
                  case (rspObj.code === 215):
                    // Bad authentication data
                    TweetManager.instance.signoutAndReauthenticate();
                    return;
                  case (rspObj.code === 261):
                    // Application cannot perform write actions.
                    fmtError = rspObj.code;
                    console.error(rspObj.message);
                    break;
                  case (rspObj.code === 170):
                    // 170: Missing required parameter
                  case (rspObj.code === 187):
                    // 187: Status is a duplicate
                    if(/statuses\/update/.test(url) || /direct_messages\/new/.test(url)) {
                      fmtError = rspObj.code;
                    } else {
                      fmtError = `${url}:${rspObj.code}:${rspObj.message}`;
                    }
                    console.warn(rspObj.message);
                    break;
                  case (rspObj.code === 179):
                    // Sorry, you are not authorized to see this status
                    if(/statuses\/show/.test(url)) {
                      fmtError = rspObj.code;
                    } else {
                      fmtError = `${url}:${rspObj.code}:${rspObj.message}`;
                    }
                    console.warn(rspObj.message);
                    break;
                  case (rspObj.code === 185):
                    // 185: User is over daily status update limit
                  case (rspObj.code === 186):
                    // 186: Status is over 140 characters.
                  case (rspObj.code === 324):
                    // 324: "The validation of media ids failed.
                    // currentry media ids only for statues/update
                    if(/statuses\/update/.test(url)) {
                      fmtError = rspObj.code;
                    } else {
                      fmtError = `${url}:${rspObj.code}:${rspObj.message}`;
                    }
                    console.warn(rspObj.message);
                    break;
                  case (rspObj.code === 150):
                    // 150:You cannot send messages to users who are not following you.
                  case (rspObj.code === 354):
                    // 354: The text of your direct message is over the max character limit.
                    if(/direct_messages/.test(url)) {
                      fmtError = rspObj.code;
                    } else {
                      fmtError = `${url}:${rspObj.code}:${rspObj.message}`;
                    }
                    console.warn(rspObj.message);
                    break;
                  case (rspObj.code === 161):
                    // You are unable to follow more people at this time
                    if(/friendships/.test(url)) {
                      fmtError = rspObj.code;
                    } else {
                      fmtError = `${url}:${rspObj.code}:${rspObj.message}`;
                    }
                    console.warn(rspObj.message);
                    break;
                  case (rspObj.code === 271):
                    // You can�ft mute yourself.
                  case (rspObj.code === 272):
                    // You are not muting the specified user.
                    if(/mutes\/users/.test(url)) {
                      fmtError = rspObj.code;
                    } else {
                      fmtError = `${url}:${rspObj.code}:${rspObj.message}`;
                    }
                    console.warn(rspObj.message);
                    break;
                  case (rspObj.code === 327):
                    // You have already retweeted this tweet.
                    fmtError = rspObj.code;
                    console.warn(rspObj.message);
                    break;
                  case /direct_messages/.test(url):
                    var accessLevel = self.findResponseHeader(request, 'X-Access-Level');
                    if(accessLevel) {
                      if(accessLevel.match('directmessages')) {
                        // The permission level is correct so that's some bizarre glitch
                        TweetManager.instance.disableDMS();
                      } else {
                        TweetManager.instance.signoutAndReauthenticate();
                        return;
                      }
                    }
                    break;
                  case (rspObj.code === 195):
                    // Missing or invalid url parameter.
                    if(/search\/tweets/.test(url)) {
                      fmtError = rspObj.code;
                    } else {
                      fmtError = `${url}:${rspObj.code}:${rspObj.message}`;
                    }
                    console.warn(rspObj.message);
                    break;
                  default:
                    fmtError = `${url}:${rspObj.code}:${rspObj.message}`;
                    console.warn(fmtError);
                    console.warn(request.responseText);
                    break;
                }
                break;
              case (request.status === 404):
                fmtError = rspObj.code;
                retry = false;
                break;
              case (request.status === 429):
                // 429: Too Many Requests
              case (rspObj.code === 88):
                // 88: Rate limit exceeded
                fmtError = 429;
                retry = false;
                break;
              case (request.status === 422):
                // 422: Unprocessable Entity
              case (request.status === 500):
                // 500: Internal Server Error
              case (request.status === 502):
                // 502: Bad Gateway
              case (request.status === 504):
                // 504: Gateway timeout
                fmtError = request.status;
                retry = false;
                break;
              case (request.status === 503):
                // Service Unavailable
                if(rspObj.code === 130) {
                  fmtError = rspObj.code;
                } else {
                  fmtError = `Service Unavailable:${rspObj.code}:${rspObj.message}`;
                }
                console.warn(rspObj.message);
                break;
              default:
                console.warn('API CALL ERROR: ' + url);
                console.warn(request.responseText);
                break;
            }
          } catch(e) {
            /* Ignoring */
            if(console) console.warn(e);
          }
        }
        if(fmtError === '') {
          try {
            if(!request.responseText || !rspObj) {
              throw 'no response';
            }
            fmtError = url + ': "' + rspObj.message + '"(' + request.statusText + ')';
          } catch(e) {
            fmtError = url + ': "' + (error || request.statusText) + '"(' + status + ')';
          }
        }
        callback(false, null, fmtError, context, request, retry);
      };
    };
    var successCallback = function(self) {
      return function(data, status, request) {
        if(request.status === 0) {
          // Empty responses are a pain...
          (errorCallback(self))(request, 'error', 'empty response');
          return;
        }
        if(!data) {
          data = [];
        }else if(url == 'search/tweets') {
          data = data.statuses;
        }
        self.normalizeTweets(data);
        callback(true, data, status, context, request);
      };
    };
    var ajaxOptions = {
      type: httpMethod,
      url: requestUrl,
      data: requestParams,
      dataType: "json",
      timeout: overriddenTimeout,
      beforeSend: beforeSendCallback(this)
    };
    $.ajax(ajaxOptions)
    .done(successCallback(this))
    .fail(errorCallback(this));
  }
  normalizeTweets(tweetsOrTweet) {
    if(tweetsOrTweet.hasOwnProperty('id_str')) {
      tweetsOrTweet = [tweetsOrTweet];
    }
    for(var i = 0, len = tweetsOrTweet.length; i < len; ++i) {
      var ti = tweetsOrTweet[i];

      // Damn Snowflake... Damn 53 bits precision limit...
      this.checkSnow(ti);

      if(!ti.user) {
        // DMs
        ti.user = ti.sender;
      }
      if(!ti.user) {
        // Search result
        ti.user = {
          name: ti.from_user,
          screen_name: ti.from_user,
          profile_image_url: ti.profile_image_url
        };
      }
    }
  }
  checkSnow(ti) {
    if (!ti) {
      return;
    }
    var regExp = this.snowflakeIdRegexp;
    for (var prop in ti) {
      if (!ti.hasOwnProperty(prop)) {
        continue;
      }
      if (typeof ti[prop] === 'object') {
        this.checkSnow(ti[prop]);
        continue;
      }
      var m = prop.match(regExp);
      if (m) {
        ti[m[1]] = ti[prop];
      }
    }
  }
  verifyCredentials(callback) {
    this.ajaxRequest({
      endpoint: 'account/verify_credentials',
      callback: (function(self) {
        return function(success, data) {
          if(success) {
            self.userData = data;
          }
          if(callback) {
            callback(success, data);
          }
        };
      })(this)
    });
  }
  showTweet(callback, id) {
    if(!id) {
      callback(false, null, 'Missing Tweet ID');
      return;
    }
    const params = {
      id: id,
      include_my_retweet: "true",
      include_entities: "true",
      tweet_mode: "extended"
    };
    this.ajaxRequest({
      endpoint: 'statuses/show',
      callback: callback,
      requestParams: params
    });
  }
  tweet(callback, msg, replyId, mediaIds, attachmentUrl = undefined) {
    var params = {
      status: msg,
      tweet_mode: "extended"
    };
    if(replyId) {
      params.in_reply_to_status_id = replyId;
      params.auto_populate_reply_metadata = `${OptionsBackend.get("reply_all") || "false"}`;
    }
    if(mediaIds && Array.isArray(mediaIds) && mediaIds.length > 0 && mediaIds.length <= 4) {
      params.media_ids = mediaIds.join(',');
    } else if(!!attachmentUrl) {
      params.attachment_url = attachmentUrl;
    }
    this.ajaxRequest({
      endpoint: 'statuses/update',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST',
      overriddenTimeout: 30000
    });
  }
  retweet(callback, id) {
    if(!id) {
      callback(false, null, 'Missing Tweet ID');
      return;
    }
    const params = {
      tweet_mode: "extended"
    };
    this.ajaxRequest({
      endpoint: 'statuses/retweet',
      callback: callback,
      httpMethod: 'POST',
      targetId: id,
      params: params
    });
  }
  destroy(callback, id) {
    if(!id) {
      callback(false, null, 'Missing Tweet ID');
      return;
    }
    this.ajaxRequest({
      endpoint: 'statuses/destroy',
      callback: callback,
      httpMethod: 'POST',
      targetId: id
    });
  }
  newDM(callback, msg, screenName) {
    const params = {
      text: msg,
      screen_name: screenName,
      tweet_mode: "extended"
    };
    this.ajaxRequest({
      endpoint: 'direct_messages/new',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  destroyDM(callback, id) {
    if(!id) {
      callback(false, null, 'Missing Tweet ID');
      return;
    }
    var params = {
      id: id
    };
    this.ajaxRequest({
      endpoint: 'direct_messages/destroy',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  createLike(callback, id) {
    if(!id) {
      callback(false, null, 'Missing Tweet ID');
      return;
    }
    var params = {
      id: id,
      tweet_mode: "extended"
    };
    this.ajaxRequest({
      endpoint: 'favorites/create',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  destroyLike(callback, id) {
    if(!id) {
      callback(false, null, 'Missing Tweet ID');
      return;
    }
    var params = {
      id: id
    };
    this.ajaxRequest({
      endpoint: 'favorites/destroy',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  lists(callback, cursor = "-1", count = "1000") {
    let params = {
      user_id: this.userId,
      count: count,
      cursor: cursor
    };
    this.ajaxRequest({
      endpoint: 'lists/ownerships',
      callback: callback,
      requestParams: params
    });
  }
  subs(callback, cursor = "-1", count = "1000") {
   let params = {
      user_id: this.userId,
      count: count,
      cursor: cursor
    };
    this.ajaxRequest({
      endpoint: 'lists/subscriptions',
      callback: callback,
      requestParams: params
    });
  }
  timeline(timeline_path, callback, context, params = {}) {
    params = Object.assign(params, {
      include_entities: "true",
      include_rts: "true",
      tweet_mode: "extended"
    });
    this.ajaxRequest({
      endpoint: timeline_path,
      callback: callback,
      context: context,
      requestParams: params
    });
  }
  searchTimeline(callback, context, params = {}) {
    params = Object.assign(params, {
      result_type: "recent",
      include_entities: "true",
      count: 100,
      tweet_mode: "extended"
    });
    this.ajaxRequest({
      endpoint: 'search/tweets',
      callback: callback,
      context: context,
      requestParams: params
    });
  }
  blockedUsers(callback, cursor = "-1") {
    const params = {
      cursor: cursor,
      include_entities: 'false',
      skip_status: 'true'
    };
    this.ajaxRequest({
      endpoint: 'blocks/list',
      callback: callback,
      context: cursor,
      requestParams: params
    });
  }
  friendsIds(callback, cursor = "-1", count = "5000") {
   let params = {
      stringify_ids: "true",
      user_id: this.userId,
      cursor: cursor,
      count: count
    };
    this.ajaxRequest({
      endpoint: 'friends/ids',
      callback: callback,
      context: cursor,
      requestParams: params
    });
  }
  trendingPlaces(callback) {
    this.ajaxRequest({
      endpoint: 'trends/available',
      callback: callback
    });
  }
  trendingTopics(callback, place) {
    var params = {};
    if (place != undefined) {
      params.id = place;
    } else {
      params.id = '1'; //1 - worldwide
    }
    this.ajaxRequest({
      endpoint: 'trends/place',
      callback: callback,
      requestParams: params
    });
  }
  savedSearches(callback) {
    this.ajaxRequest({
      endpoint: 'saved_searches/list',
      callback: callback
    });
  }
  createSavedSearches(callback, query) {
    if(!query) {
      callback(false, null, 'Missing Query');
      return;
    }
    var params = {
      query: query
    };
    this.ajaxRequest({
      endpoint: 'saved_searches/create',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  destorySavedSearches(callback, id) {
    if(!id) {
      callback(false, null, 'Missing SavedSearch ID');
      return;
    }
    this.ajaxRequest({
      endpoint: 'saved_searches/destroy',
      callback: callback,
      httpMethod: 'POST',
      targetId: id
    });
  }
  lookupUsers(callback, usersIdList = []) {
    if(!Array.isArray(usersIdList)) {
      callback(false);
      return;
    } else if(usersIdList.length == 0) {
      callback(true, []);
      return;
    }
    const params = {
      user_id: usersIdList.join(',')
    };
    this.ajaxRequest({
      endpoint: 'users/lookup',
      callback: callback,
      requestParams: params
    });
  }
  usersTimeline(callback, context, params = {}) {
    params = Object.assign(params, {
      include_rts: "true",
      exclude_replies: "false",
      tweet_mode: "extended"
    });
    this.ajaxRequest({
      endpoint: 'statuses/user_timeline',
      callback: callback,
      context: context,
      requestParams: params
    });
  }
  follow(callback, userId) {
    if(!userId) {
      callback(false, null, "Missing user_id");
      return;
    }
    var params = {
      user_id: userId,
      follow: false
    };
    this.ajaxRequest({
      endpoint: 'friendships/create',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  unfollow(callback, userId) {
    if(!userId) {
      callback(false, null, "Missing user_id");
      return;
    }
    var params = {
      user_id: userId
    };
    this.ajaxRequest({
      endpoint: 'friendships/destroy',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  block(callback, userId) {
    if(!userId) {
      callback(false, null, "Missing user_id");
      return;
    }
    var params = {
      user_id: userId
    };
    this.ajaxRequest({
      endpoint: 'blocks/create',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  unblock(callback, userId) {
    if(!userId) {
      callback(false, null, "Missing user_id");
      return;
    }
    var params = {
      user_id: userId
    };
    this.ajaxRequest({
      endpoint: 'blocks/destroy',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  report(callback, userId) {
    if(!userId) {
      callback(false, null, "Missing user_id");
      return;
    }
    var params = {
      user_id: userId
    };
    this.ajaxRequest({
      endpoint: 'users/report_spam',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  findResponseHeader(request, matchPattern) {
    var allHeaders = request.getAllResponseHeaders().split("\r\n"), ret;
    for(var i = 0, len = allHeaders.length; i < len; i++) {
      var header = allHeaders[i], splited = header.split(/:\s*/), pattern = new RegExp(matchPattern, 'i');
      if(pattern.test(splited[0])) {
        ret = splited[1];
        break;
      }
    }
    return ret;
  }
  retrieveConfiguration(callback) {
    this.ajaxRequest({
      endpoint: 'help/configuration',
      callback: callback
    });
  }
  mutesUsers(callback, cursor = "-1") {
    const params = {
      cursor: cursor,
      include_entities: 'false',
      skip_status: 'true'
    };
    this.ajaxRequest({
      endpoint: 'mutes/users/list',
      callback: callback,
      context: cursor,
      requestParams: params
    });
  }
  createMutes(callback, userId) {
    if(!userId) {
      callback(false, null, "Missing user_id");
      return;
    }
    var params = {
      user_id: userId
    };
    this.ajaxRequest({
      endpoint: 'mutes/users/create',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  destroyMutes(callback, userId) {
    if(!userId) {
      callback(false, null, "Missing user_id");
      return;
    }
    var params = {
      user_id: userId
    };
    this.ajaxRequest({
      endpoint: 'mutes/users/destroy',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST'
    });
  }
  uploadMedia(callback, mediaData) {
    if(!mediaData) {
      callback(false, null, "Missing mediaData");
      return;
    }
    var params = {
      media: mediaData
    };
    this.ajaxRequest({
      endpoint: 'media/upload',
      callback: callback,
      requestParams: params,
      httpMethod: 'POST',
      baseUrl: 'https://upload.twitter.com/1.1/',
      overriddenTimeout: 30000
    });
  }
  followers(callback, cursor = "-1", count = "5000") {
    const params = {
      cursor: cursor,
      stringify_ids: "true",
      count: count
    };
    this.ajaxRequest({
      endpoint: 'followers/ids',
      callback: callback,
      context: cursor,
      requestParams: params
    });
  }
  readyToEnteringPIN() {
    chrome.runtime.onConnect.addListener((function(oauthLib) {
      return function(port) {
        if(port.name !== 'getAuthPin') return;
        port.onMessage.addListener(function(message) {
          if(message.check_pin_needed) {
            if(!oauthLib.authenticated && oauthLib.tokenRequested) {
              port.postMessage({tokenRequested: true});
              return;
            }
          } else if(message.cr_oauth_pin) {
            oauthLib.authenticating = true;
            oauthLib.getAccessToken.call(oauthLib, message.cr_oauth_pin, function(data) {
              if(data) {
                port.postMessage({success: data});
              }
            });
          }
        });
      };
    })(this.oauthLib));
  }
};

class TwitterOAuth {
  constructor(oauthTokenData, onAuthenticatedCallback, consumerSecret, consumerKey) {
    this.authenticated = false;
    this.onAuthenticated = onAuthenticatedCallback;
    this.responseCallback = null;
    this.authenticating = false;
    this.tokenRequested = false;
    this.timeAdjusted = false;
    this.oauthTokenData = oauthTokenData;
    this.consumerSecret = consumerSecret;
    this.consumerKey    = consumerKey;

    var cachedToken = this.oauthTokenData.val();
    if(cachedToken) {
      this.authenticating = true;
      this.tokenRequested = true;
      setTimeout(function(self) {
        self.accessTokenCallback.call(self, cachedToken);
      }, 0, this);
    }
  }
  getAccessToken(pin, callback) {
    this.responseCallback = callback;
    this.makeRequest.call(this, 'access_token', { oauth_verifier: pin }, this.accessTokenCallback);
  }
  prepareSignedParams(url, params, httpMethod) {
    var accessor = {
      consumerSecret: this.consumerSecret,
      tokenSecret: this.oauth_token_secret
    };
    if(!httpMethod) {
      httpMethod = 'POST';
    }
    var message = {
      action: url,
      method: httpMethod,
      parameters: [
        ['oauth_consumer_key', this.consumerKey],
        ['oauth_signature_method', 'HMAC-SHA1']
      ]
    };
    if(this.oauth_token) {
      OAuth.setParameter(message, 'oauth_token', this.oauth_token);
    }
    for(var p in params) {
      if(!params.hasOwnProperty(p)) continue;
      OAuth.setParameter(message, p, params[p]);
    }
    OAuth.completeRequest(message, accessor);
    return OAuth.getParameterMap(message.parameters);
  }
  adjustTimestamp(request) {
    var serverHeaderFields = ['Last-Modified', 'Date'];
    var serverTimestamp;
    for(var i = 0, len = serverHeaderFields.length; i < len; ++i) {
      var headerField = serverHeaderFields[i];
      var fieldValue = request.getResponseHeader(headerField);
      if(!fieldValue) {
        continue;
      }
      serverTimestamp = Date.parse(fieldValue);
      if(serverTimestamp && !isNaN(serverTimestamp)) {
        break;
      }
    }
    if(serverTimestamp) {
      var beforeAdj = OAuth.timeCorrectionMsec;
      OAuth.timeCorrectionMsec = serverTimestamp - Date.now();
      if(Math.abs(beforeAdj - OAuth.timeCorrectionMsec) > 5000) {
        console.log("Server timestamp: " + serverTimestamp + " Correction (ms): " + OAuth.timeCorrectionMsec);
        return true;
      }
    }
    return false;
  }
  makeRequest(url, params, callback) {
    var signingUrl = TwitterLib.URLS.BASE_OAUTH_SIGNING + url;
    var signedParams = this.prepareSignedParams(signingUrl, params);
    var requestUrl = TwitterLib.URLS.BASE_OAUTH + url;
    $.ajax({
      type: 'POST',
      url: requestUrl,
      data: signedParams
    })
    .done((function(self) {
      return function(data, status, xhr) {
        callback.call(self, data, status, xhr);
      };
    })(this))
    .fail((function(self) {
      return function(request, status, error) {
        var fmtError = '';
        try {
          if(self.adjustTimestamp(request)) {
            console.log('First OAuth token request failed: ' + status + '. Trying again using adjusted timestamp.');
            callback.call(self, null, null, true);
            return;
          }
          fmtError = '"' + request.responseText + '"(' + request.statusText + ')';
        } catch(e) {
          fmtError = '"' + error + '"(' + status + ')';
        }
        callback.call(self, null, fmtError);
      };
    })(this));
  }
  accessTokenCallback(data, status, xhr) {
    this.authenticating = false;
    var success = true;
    if(!data) {
      success = false;
      this.error = status;
      console.log('accessTokenCallback error: ' + status);
    } else {
      var paramMap = OAuth.getParameterMap(data);
      this.oauthTokenData.save(data);
      this.oauth_token = paramMap['oauth_token'];
      this.oauth_token_secret = paramMap['oauth_token_secret'];
      this.user_id = paramMap['user_id'];
      this.screen_name = paramMap['screen_name'];
      this.authenticated = true;
      if(this.onAuthenticated) {
        this.onAuthenticated();
      }
    }
    if(this.responseCallback) {
      try {
        this.responseCallback(success);
      } catch(e) { /* ignoring */ }
      this.responseCallback = null;
    }
  }
  requestTokenCallback(data, status, tryAgain) {
    var alertRequestError = function(self) {
      return function(errorMsg) {alertRequestError
        self.error = errorMsg;
        console.log('requestTokenCallback error: ' + errorMsg);
        alert(chrome.i18n.getMessage("request_token_error", [errorMsg]));
      };
    };
    if(!data) {
      if(tryAgain) {
        this.getRequestToken();
        return;
      }
      (alertRequestError(this))(status);
      return;
    }

    var paramMap = OAuth.getParameterMap(data);
    this.oauth_token = paramMap['oauth_token'];
    this.oauth_token_secret = paramMap['oauth_token_secret'];

    if(!this.oauth_token || !this.oauth_token_secret) {
      (alertRequestError(this))("Invalid oauth_token: " + data);
      return;
    }

    chrome.tabs.create({
      "url": TwitterLib.URLS.BASE_OAUTH + 'authorize?oauth_token=' + this.oauth_token,
      "selected": true
    });
    this.tokenRequested = true;
  }
  getRequestToken() {
    this.oauth_token_secret = '';
    this.oauth_token = null;
    this.makeRequest('request_token', {}, this.requestTokenCallback);
  }
}
