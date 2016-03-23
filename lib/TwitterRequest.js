"use strict";
class TwitterRequestBase {
  constructor(consumerKey, consumerSecret, cachedOAuthResponse) {
    if(!consumerKey || !consumerSecret) {
      throw new TypeError("consumerKey and consumerSecret are needed");
    }
    Object.defineProperties(this, {
      "consumerKey": {
        get: () => {
          return consumerKey;
        }
      },
      "consumerSecret": {
        get: () => {
          return consumerSecret;
        }
      },
      [Symbol.for("oauthToken")]: {
        value: undefined,
        writable: true
      },
      "oauthToken": {
        get: () => {
          return this[Symbol.for("oauthToken")] || "";
        },
        set: (token) => {
          if(token && typeof token === "string") {
            this[Symbol.for("oauthToken")] = token;
          } else {
            this[Symbol.for("oauthToken")] = undefined;
          }
        }
      },
      [Symbol.for("oauthTokenSecret")]: {
        value: undefined,
        writable: true
      },
      "oauthTokenSecret": {
        get: () => {
          return this[Symbol.for("oauthTokenSecret")] || "";
        },
        set: (secret) => {
          if(secret && typeof secret === "string") {
            this[Symbol.for("oauthTokenSecret")] = secret;
          } else {
            this[Symbol.for("oauthTokenSecret")] = undefined;
          }
        }
      },
      [Symbol.for("userId")]: {
        value: undefined,
        writable: true
      },
      "userId": {
        get: () => {
          return this[Symbol.for("userId")] || "";
        },
        set: (id) => {
          if(id && typeof id === "string") {
            this[Symbol.for("userId")] = id;
          } else {
            this[Symbol.for("userId")] = undefined;
          }
        }
      },
      [Symbol.for("screenName")]: {
        value: undefined,
        writable: true
      },
      "screenName": {
        get: () => {
          return this[Symbol.for("screenName")] || "";
        },
        set: (name) => {
          if(name && typeof name === "string") {
            this[Symbol.for("screenName")] = name;
          } else {
            this[Symbol.for("screenName")] = undefined;
          }
        }
      },
      [Symbol.for("baseQuery")]: {
        get: () => {
          return new Map([
            ["oauth_consumer_key", consumerKey || ""],
            ["oauth_nonce", ],
            ["oauth_timestamp", ],
            ["oauth_signature_method", "HMAC-SHA1"],
            ["oauth_version", "1.0"]
          ]);
        }
      },
      "baseQuery": {
        get: () => {
          const baseQuery = this[Symbol.for("baseQuery")];
          baseQuery.set("oauth_nonce", this.getNonce());
          baseQuery.set("oauth_timestamp", this.getTimestamp());
          if(this.oauthToken !== "") {
            baseQuery.set("oauth_token", this.oauthToken);
          }
          return baseQuery;
        }
      },
      "signKey": {
        get: () => {
          return new TextEncoder().encode([
            this.consumerSecret,
            this.oauthTokenSecret
          ].join("&"));
        }
      }
    });
    this.parseOAuthData(cachedOAuthResponse);
  }
  getNonce() {
    let ret = "";
    for(let i = 0; i < 32; i++) {
      ret += "0123456789abcdef"[Math.random() * 16 | 0];
    }
    return ret;
  }
  getTimestamp() {
    return Date.now() / 1000 | 0;
  }
  sortAscending(a, b) {
    if(a[0] < b[0]) {
      return -1;
    }
    if(a[0] > b[0]) {
      return 1;
    }
    return 0;
  }
  mapJoinEqual(e) {
    return e.join("=");
  }
  parseOAuthData(response) {
    for(let [key, value] of new URLSearchParams(response).entries()) {
      switch(key) {
        case "oauth_token":
          this.oauthToken = value;
          break;
        case "oauth_token_secret":
          this.oauthTokenSecret = value;
          break;
        case "user_id":
          this.userId = value;
          break;
        case "screen_name":
          this.screenName = value;
          break;
        default:
          break;
      }
    }
  }
  generateStringsForSign(request) {
    return new TextEncoder().encode([
      request.method,
      encodeURIComponent(request.url.origin + request.url.pathname),
      encodeURIComponent([...request.query].sort(this.sortAscending).map(this.mapJoinEqual).join("&"))
    ].join("&"));
  }
  generateSignature(request) {
    const target = this.generateStringsForSign(request);
    return window.crypto.subtle.importKey("raw", this.signKey, {
      name: "HMAC",
      hash: {name: "SHA-1"}
    }, false, ["sign"])
    .then((importedKey) => {
      return window.crypto.subtle.sign({
        name: "HMAC",
        hash: "SHA-1"
      }, importedKey, target);
    })
    .then((result) => {
      let str = "";
      for(let i of new Uint8Array(result).values()) {
        str += String.fromCharCode(i);
      }
      request.query.append("oauth_signature", window.btoa(str));
      return Promise.resolve(request);
    });
  }
  fetchRequest(request) {
    throw new TypeError("needs override");
  }
}

class OAuthRequest extends TwitterRequestBase {
  constructor(consumerKey, consumerSecret) {
    super(consumerKey, consumerSecret);
    Object.defineProperties(this, {
      "state": {
        value: "ready",
        writable: true
      }
    });
  }
  resetState() {
    this.state = "ready";
    this.oauthToken = undefined;
    this.oauthTokenSecret = undefined;
    this.userId = undefined;
    this.screenName = undefined;
  }
  getRequestToken() {
    if(this.state !== "ready") {
      this.resetState();
    }
    this.generateSignature({
      method: "POST",
      url: new URL("https://api.twitter.com/oauth/request_token"),
      query: new URLSearchParams([...this.baseQuery].map(this.mapJoinEqual).join("&"))
    })
    .then(((self) => {
      self.state = "request_token_requested";
      return self.fetchRequest;
    })(this))
    .then(((self) => {
      return (response) => {
        self.state = "request_token_responded";
        response.text().then((oauthTokenStrings) => {
          self.parseOAuthData(oauthTokenStrings);
          self.state = "user_grant_requested";
          chrome.tabs.create({
            url: `https://api.twitter.com/oauth/authorize?oauth_token=${this.oauthToken}`,
            selected: true
          });
        });
      };
    })(this))
    .catch((e) => {
      //TODO open new Chrome tab with error strings
    });
  }
  getAccessToken(pin, onResolve) {
    if(this.state !== "user_grant_requested"
    || (!pin || typeof pin !== "string")) {
      this.resetState();
      return this.getRequestToken();
    }
    this.generateSignature({
      method: "POST",
      url: new URL("https://api.twitter.com/oauth/access_token"),
      query: new URLSearchParams([...this.baseQuery, ["oauth_verifier", pin]].map(this.mapJoinEqual).join("&"))
    })
    .then(((self) => {
      self.state = "access_token_requested";
      return self.fetchRequest;
    })(this))
    .then(((self) => {
      return (response) => {
        self.state = "access_token_responded";
        if(response.status === 200) {
          response.text().then((oauthTokenStrings) => {
            self.parseOAuthData(oauthTokenStrings);
            self.state = "authenticated";
            onResolve(self.serializeOAuthData());
          });
        } else {
          Promise.reject(response);
        }
      };
    })(this))
    .catch(((self) => {
      return (response) => {
        console.log("OAuthRequest.getAccessToken: %o", response);
        self.state = "authentication_failed";
        return self.getRequestToken();
      };
    })(this));
  }
  fetchRequest(request) {
    if(!request || !request.url || !request.query) {
      return Promise.reject(Response.error());
    }
    return fetch(request.url, {
      method: "POST",
      body: request.query
    });
  }
  serializeOAuthData() {
    return [
      ["oauth_token", this.oauthToken],
      ["oauth_token_secret", this.oauthTokenSecret],
      ["user_id", this.userId],
      ["screen_name", this.screenName]
    ].filter(([key, value]) => {
      if(value && typeof value === "string" && value !== "") {
        return true;
      } else {
        return false;
      }
    }).map(this.mapJoinEqual).join("&");
  }
}

class TwitterRequest extends TwitterRequestBase {
  constructor(consumerKey, consumerSecret, cachedOAuthResponse) {
    if(!cachedOAuthResponse) {
      throw new TypeError("OAuth data is needed");
    }
    super(consumerKey, consumerSecret, cachedOAuthResponse);
  }
  createOAuthHeader(query) {
    return new Headers([
      [
        "Authorization",
        `OAuth ${[...query].filter(([key, value]) => {
          if(key.substring(0, 6) === "oauth_") {
            return true;
          }
        }).sort(this.sortAscending).map(this.mapJoinEqual).join(", ")}`
      ]
    ]);
  }
}

class UserStream extends TwitterRequest {
  constructor(consumerKey, consumerSecret, cachedOAuthResponse) {
    super(consumerKey, consumerSecret, cachedOAuthResponse);
    Object.defineProperties(this, {
      [Symbol.for("state")]: {
        value: false,
        writable: true
      },
      "state": {
        get: () => {
          return this[Symbol.for("state")] || false;
        },
        set: (bool) => {
          this[Symbol.for("state")] = !!bool;
        }
      },
      [Symbol.for("reader")]: {
        value: undefined,
        writable: true
      },
      "streamReader": {
        get: () => {
          return this[Symbol.for("reader")];
        },
        set: (reader) => {
          if(!!reader) {
            this[Symbol.for("reader")] = reader;
          } else {
            this[Symbol.for("reader")] = undefined;
          }
        }
      },
      [Symbol.for("stream")]: {
        value: []
      }
    });
  }
  connect() {
    if(!this.oauthToken || !this.oauthTokenSecret) {
      throw new Error("OAuth token is broken");
    }
    if(!!this.state) {
      return;
    }
    const params = new Map([
      ["stall_warnings", "true"],
      ["with", "followings"],
      ["replies", "all"],
      ["stringify_friend_ids", "true"]
    ]);
    this.generateSignature({
      method: "GET",
      url: new URL("https://userstream.twitter.com/1.1/user.json"),
      query: new URLSearchParams([...this.baseQuery, ...params].map(this.mapJoinEqual).join("&"))
    })
    .then(this.fetchRequest.bind(this))
    .catch(((self) => {
      return (e) => {
        console.log("UserStream.connect: %o", e);
        self.disconnect();
      }
    })(this));
  }
  disconnect() {
    try {
      if(!!this.streamReader) {
        this.streamReader.cancel();
      }
    } catch(e) {
      console.log("UserStream.disconnect.fail: %o", e);
    } finally {
      console.log("UserStream.disconnect.finally");
      this.state = false;
      this.streamReader = undefined;
    }
  }
  fetchRequest(request) {
    if(!request || !request.url) {
      return Promise.reject(Response.error());
    }
    request.url.search = `?${request.query.toString()}`;
    fetch(request.url, {
      method: "GET",
      headers: this.createOAuthHeader(request.query)
    }).then(((self) => {
      return (response) => {
        if(response.status === 200) {
          self.state = true;
          self.streamReader = response.body.getReader();
          self.streamReader.closed.then(() => {
            console.log("UserStream.streamReader.closed:success");
          }).catch((e) => {
            return Promise.reject(e);
          });
          self.readStream();
        } else {
          return Promise.reject(response);
        }
      };
    })(this)).catch(((self) => {
      return (e) => {
        console.log("UserStream.fetchRequest: %o", e);
        if(e.status === 420) {
          self.disconnect();
        } else if(e.status === 401) {
          self.oauthToken = undefined;
          self.oauthTokenSecret = undefined;
          //TODO re-authenticate
        }
      }
    })(this));
  }
  readStream() {
    if(!this.streamReader) {
      throw new ReferenceError("streamReader is undefined");
    }
    return this.streamReader.read().then(((self) => {
      return (result) => {
        const data = (!!result? result.value: undefined) || new Uint8Array([13, 10]);
        const decodedData = new TextDecoder().decode(data);
        if(decodedData !== "\r\n") {
          self.processStream(decodedData);
        }
        return self.readStream();
      }
    })(this)).catch(((self) => {
      return (e) => {
        console.log("UserStream.readStream: %o", e);
        self.disconnect();
      }
    })(this));
  }
  processStream(stream) {
    if(!stream || typeof stream !== "string") {
      return;
    }
    const buffer = this[Symbol.for("stream")];
    try {
      this.dispatch(JSON.parse(stream));
      if(buffer.length > 0) {
        buffer.splice(0);
      }
    } catch(e) {
      buffer.push(stream);
      if(buffer.length > 1) {
        const joinedStream = buffer.join("");
        try {
          this.dispatch(JSON.parse(stream));
          buffer.splice(0);
        } catch(e) {
          if(joinedStream.length > 1024 * 32) {
            console.log("UserStream.processStream.bufferOverflow: %s", joinedStream.length);
            buffer.splice(0);
          }
        }
      }
    }
  }
  dispatch(data) {
    console.log(data);
  }
}
