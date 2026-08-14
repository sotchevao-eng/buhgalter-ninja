/**
 * Очередь наград: окна показываются по одному, без наложения.
 */
(function (global) {
  'use strict';

  const RewardQueue = {
    items: [],
    busy: false,

    enqueueReward: function (item) {
      if (!item) return;
      this.items.push(item);
    },

    clear: function () {
      this.items = [];
      this.busy = false;
    },

    start: function () {
      if (this.busy) return;
      this.showNextReward();
    },

    showNextReward: function () {
      const overlay = document.getElementById('overlay-reward');
      if (!this.items.length) {
        this.busy = false;
        if (overlay) overlay.classList.remove('is-active');
        return;
      }
      this.busy = true;
      const item = this.items.shift();
      if (typeof UI !== 'undefined' && UI.showReward) {
        UI.showReward(item);
      }
    }
  };

  global.RewardQueue = RewardQueue;
})(window);
