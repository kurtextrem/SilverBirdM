"use strict";
class UnifiedTweetsTimeline extends TweetsTimeline {
  constructor(timelineId, manager, template, timelines) {
    super(timelineId, manager, template);
    this.timelines = timelines;
  }
  /* overridden */
  init() {
    TimelineTemplate.reloadOptions();
    TimelineTemplate.eachTimelineTemplate((function(self) {
      return function(template) {
        if(self._shouldIncludeTemplate(template)) {
          TweetManager.instance.createTimelineTemplate(template, true);
        }
      };
    })(this), true);
  }
  /* overridden */
  remove() {
    this.template.visible = false;
    if(!this.template.includeInUnified) {
      this.killTimeline();
      this._eachTimeline(function(timeline) {
        if(!timeline.template.visible) {
          var timelineId = timeline.timelineId;
          timeline.killTimeline();
          this.timelines.delete(timelineId);
        }
      });
      TimelineTemplate.reloadOptions();
      return true;
    }
    return false;
  }
  /* overridden */
  getError() {
    var err = null;
    this._eachTimeline(function(timeline) {
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
  giveMeTweets(callback) {
    const option = 1 * 60 * 60 * 1000; // 1 hour
    const recentTime = Date.now() - option;
    const ret = [];
    this._eachTimeline((timeline) => {
      ret.push(...(timeline.tweetsCache.filter((tweet) => {
        if(!tweet || !tweet.created_at) {
          return false;
        }
        if(!tweet.parsed_created_at) {
          tweet.parsed_created_at = Date.parse(tweet.created_at);
        }
        if(!tweet.originalTimelineId) {
          tweet.originalTimelineId = timeline.timelineId;
        }
        if(tweet.parsed_created_at < recentTime) {
          return false;
        } else {
          return true;
        }
      })));
    });
    ret.sort(TweetsTimeline.sortFromId);
    callback(ret, this.timelineId);
  }
  /* overridden */
  mergeNewTweets() {
    this._eachTimeline(function(timeline) {
      timeline.mergeNewTweets();
    });
  }
  /* overridden */
  getNewTweetsCount() {
    let ret = 0;
    this._eachTimeline(function(timeline) {
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
    this._eachTimeline(function(timeline) {
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
  _shouldIncludeTemplate(template) {
    return (template.includeInUnified && !template.hiddenTemplate) || template.id === TimelineTemplate.NOTIFICATION;
  }
}
