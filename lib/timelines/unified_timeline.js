"use strict";
class UnifiedTweetsTimeline extends TweetsTimeline {
  constructor(timelineId, manager, template, timelines) {
    super(timelineId, manager, template);
    this.timelines = timelines;
    this.lastRequestedId = new Map();
    this.currentPage = 0;
  }
  static makeJoinableCallback(joinCount, eachCallback, joinCallback) {
    return function() {
      joinCount--;
      eachCallback.apply(this, arguments);
      if(joinCount === 0) {
        joinCallback();
      }
    };
  }
  /* overridden */
  init() {
    TimelineTemplate.reloadOptions();
    TimelineTemplate.eachTimelineTemplate((template) => {
      if(this._shouldIncludeTemplate(template)) {
        TweetManager.instance.createTimelineTemplate(template, true);
      }
    }, true);
  }
  /* overridden */
  remove() {
    this.template.visible = false;
    if(!this.template.includeInUnified) {
      this.killTimeline();
      this._eachTimeline((timeline) => {
        if(!timeline.template.visible) {
          timeline.killTimeline();
          this.timelines.delete(timeline.timelineId);
        }
      });
      TimelineTemplate.reloadOptions();
      return true;
    }
    return false;
  }
  /* overridden */
  getError() {
    let err = null;
    this._eachTimeline((timeline) => {
      if(timeline.getError()) {
        err = timeline.getError();
        return false;
      }
    });
    return err;
  }
  /* overridden */
  killTimeline() {
    /* noop */
  }
  /* overridden */
  giveMeTweets(callback, syncNew, cacheOnly, keepCache) {
    if(this.currentCallback) {
      //Handling multiple calls to giveMeTweets, just update the registered
      //callback and let the first request finish.
      this.currentCallback = callback;
      return;
    }
    this.currentCallback = callback;

    const tweetsPerPage = OptionsBackend.get('tweets_per_page');
    const maxCachedTweets = OptionsBackend.get('max_cached_tweets');
    const maxCachedPages = parseInt((maxCachedTweets / tweetsPerPage) - 1, 10);

    if(cacheOnly || syncNew) {
      if(!keepCache) {
        if(this.currentPage > maxCachedPages) {
          this.currentPage = maxCachedPages;
          this._eachTimeline((timeline) => {
            timeline._cleanUpCache();
          });
        }
      }
    } else {
      this.currentPage += 1;
    }

    let errorAbort = false;
    const externalTweetsCache = new Map();
    const requiredTweets = (this.currentPage + 1) * tweetsPerPage;

    const resultTweetsList = [];
    const usedTweetsSet = new Set();

    const findMaxBefore = (maxDate) => {
      let maxBeforeDate = null;
      let maxBeforeTweet = null;

      const checkMaxTweet = (timelineId) => {
        const tweetsInTimeline = externalTweetsCache.get(timelineId);
        tweetsInTimeline.forEach((tweet) => {
          if(usedTweetsSet.has(tweet.id_str)) {
            return;
          }
          const date = Date.parse(tweet.created_at);
          if(maxDate && date > maxDate) {
            return;
          }
          if(!maxBeforeDate || date > maxBeforeDate) {
            maxBeforeDate = date;
            maxBeforeTweet = tweet;
            maxBeforeTweet.timelineId = timelineId;
            if(!maxBeforeTweet.originalTimelineId) {
              maxBeforeTweet.originalTimelineId = timelineId;
            }
          }
        });
      };
      let isLike = false;
      for(let timelineId of externalTweetsCache.keys()) {
        if(timelineId === "likes") {
          //HACK: postpone
          isLike = true;
          continue;
        }
        checkMaxTweet(timelineId);
      }
      if(isLike) {
        checkMaxTweet("likes");
      }

      if(maxBeforeTweet) {
        usedTweetsSet.add(maxBeforeTweet.id_str);
      }
      return maxBeforeTweet;
    };

    const joinFunction = () => {
        if(errorAbort) {
          return;
        }
        /* 2nd step: Let's cherry pick tweets until we get enough of them
           to compose our unified timeline.
        */
        while(resultTweetsList.length < requiredTweets) {
          const lastTweet = resultTweetsList[resultTweetsList.length - 1];
          let maxDate = null;
          if(lastTweet) {
            maxDate = Date.parse(lastTweet.created_at);
          }
          const nextTweet = findMaxBefore(maxDate);
          if(!nextTweet) {
            break;
          }
          resultTweetsList.push(nextTweet);
          if(resultTweetsList.length == requiredTweets) {
            break;
          }
          const timelineTweetsCache = externalTweetsCache.get(nextTweet.timelineId);
          const isLastInTimelineCache = timelineTweetsCache[timelineTweetsCache.length - 1].id_str === nextTweet.id_str;
          if(isLastInTimelineCache) {
            /* 3rd step: Some timeline went empty because all other tweets are already in
               the unified timeline, now we need to get more tweets from this timeline.
            */
            if(this.lastRequestedId.get(nextTweet.timelineId) == nextTweet.id_str) {
              // Avoid repeating the same query but reseting for the next time
              // because Twitter may act weirdly sometimes and simply return an
              // empty list instead of an error. Because of that, we can't rely
              // on the fact that an empty list really means the end of the tweets.
              this.lastRequestedId.delete(nextTweet.timelineId);
              continue;
            }
            const newJoinableCallback = UnifiedTweetsTimeline.makeJoinableCallback(1, eachFunction, joinFunction);
            const wantedTimeline = this.timelines.get(nextTweet.timelineId);
            wantedTimeline.unifiedRunning = true;
            let requiredCount = (requiredTweets - resultTweetsList.length) + 1;
            if(requiredCount <= 2) {
              requiredCount += 1;
            }
            wantedTimeline.giveMeTweets((returnedTweets) => {
              if(returnedTweets) { // Success
                this.lastRequestedId.set(nextTweet.timelineId, nextTweet.id_str);
              }
              newJoinableCallback.apply(this, arguments);
            }, false, false, true, requiredCount);
            return;
          }
        }
        /* 4th step now we're ready to return our unified timeline. */
        const callback = this.currentCallback;
        this.currentCallback = null;
        this.tweetsCache = resultTweetsList;
        try {
          callback(resultTweetsList, this.timelineId);
        } catch(e) {
          /* ignoring, popup dead? */
          console.warn(e, e.stack);
        }
    };
    const eachFunction = (tweets, timelineId, timelineObj) => {
      if(timelineObj) {
        timelineObj.unifiedRunning = false;
      }
      if(errorAbort) {
        return;
      }
      if(!tweets) {
        errorAbort = true;
        try {
          this.currentCallback(null, this.timelineId);
        } catch(e) {
          /* ignoring, popup dead? */
        }
        this.currentCallback = null;
        return;
      }
      externalTweetsCache.set(timelineId, tweets);
    };

    /* 1st step: Let's get cached results from each timeline and call
       joinFunction when we get all the results.
    */
    const joinCount = this._countTimelines();
    const joinableCallback = UnifiedTweetsTimeline.makeJoinableCallback(joinCount, eachFunction, joinFunction);

    this._eachTimeline((timeline) => {
      timeline.unifiedRunning = true;
      timeline.giveMeTweets(joinableCallback, syncNew, true, true);
    });

  }
  /* overridden */
  mergeNewTweets() {
    this._eachTimeline((timeline) => {
      timeline.mergeNewTweets();
    });
  }
  /* overridden */
  getNewTweetsCount() {
    let ret = 0;
    this._eachTimeline((timeline) => {
      ret += timeline.getNewTweetsCount();
    });
    return ret;
  }
  /* overridden */
  getNewTweetsCache() {
    return [];
  }
  /* overridden */
  removeFromCache(id) {
    let ret = false;
    this._eachTimeline((timeline) => {
      ret = timeline.removeFromCache(id) || ret;
    });
    return ret;
  }
  /* overridden */
  findTweet(id) {
    return null;
  }
  /* Private Methods */
  _eachTimeline(callback) {
    for(let [tId, timeline] of this.timelines.entries()) {
      if(this._shouldIncludeTemplate(timeline.template)) {
        if(callback.call(this, timeline) === false)
          break;
      }
    }
  }
  _countTimelines() {
    let count = 0;
    this._eachTimeline((timeline) => {
      if(this._shouldIncludeTemplate(timeline.template)) {
        ++count;
      }
    });
    return count;
  }
  _shouldIncludeTemplate(template) {
    return (template.includeInUnified && !template.hiddenTemplate) || template.id === TimelineTemplate.NOTIFICATION;
  }
}
