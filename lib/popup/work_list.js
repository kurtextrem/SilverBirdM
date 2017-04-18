const WorkList = class WorkList{
  static init() {
    window.addEventListener("sendQueue", (evnet) => {
      switch(event.detail.type) {
        case "empty":
          WorkList.sendQueueEmpty(evnet.detail.lastSent);
          break;
        case "enqueue":
          WorkList.tweetEnqueued();
          break;
        case "tweetSent":
          // no behavior
          break;
        case "sendFailed":
          WorkList.sendFailed(event.detail.status, event.detail.aborted);
          break;
        default:
          console.info(event);
          break;
      }
    });
  }

  static sendQueueEmpty(lastSent) {
    if(OptionsBackend.get('use_streaming_api')) {
      loadNewTweets();
    } else {
      let updateTimelineId = TimelineTemplate.HOME;
      if(lastSent && lastSent.isDM) {
        updateTimelineId = TimelineTemplate.SENT_DMS;
      }
      loadTimeline(true, updateTimelineId);
    }
  }

  static tweetEnqueued() {
  }

  static sendFailed(status, abortedQueue) {
    if(!abortedQueue || abortedQueue.length === 0) {
      return;
    }
    // If we're here that's because something went wrong
    if(!Composer.isVisible()) {
      // For now let's just show the first enqueued message
      let topMessage = abortedQueue[0];
      let replyTargetUrl = undefined;
      if(topMessage.isDM) {
        topMessage.message = `d ${topMessage.replyUser} ${topMessage.message}`;
      } else if(!!topMessage.replyUser && !!topMessage.replyId) {
        replyTargetUrl = `https://twitter.com/${topMessage.replyUser}/status/${topMessage.replyId}`;
      }
      Composer.initMessage(topMessage.message, replyTargetUrl, topMessage.attachmentUrl, topMessage.mediaIds);
    }
    if(status === 500 || status === 503 || status === 504) {
      Renderer.showError(chrome.i18n.getMessage("ue_twitter_is_now_unable"));
    } else if(status === 261) {
      Renderer.showError(chrome.i18n.getMessage("ue_restricted_write_action"));
    } else if(status === 354) {
      Renderer.showError(chrome.i18n.getMessage("ue_over_dm_character_limit"));
    } else {
      Renderer.showError(chrome.i18n.getMessage("tweet_send_error"));
    }
  }
};
