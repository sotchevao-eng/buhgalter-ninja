/**
 * Загрузка спрайтов персонажа. Отсутствие файлов не ломает игру.
 * Ожидаемые файлы: assets/images/player/*.webp
 */
(function (global) {
  'use strict';

  const FILES = {
    idle: 'idle.webp',
    moveLeft: 'move-left.webp',
    moveRight: 'move-right.webp',
    happy: 'happy.webp',
    worried: 'worried.webp',
    hit: 'hit.webp',
    victory: 'victory.webp',
    tired: 'tired.webp'
  };

  const PlayerSprites = {
    images: {},
    ready: {},
    loaded: false,

    preload: function () {
      const self = this;
      const keys = Object.keys(FILES);
      let remaining = keys.length;

      return new Promise(function (resolve) {
        function done() {
          remaining -= 1;
          if (remaining <= 0) {
            self.loaded = true;
            resolve(self);
          }
        }

        keys.forEach(function (key) {
          const img = new Image();
          img.onload = function () {
            self.ready[key] = true;
            done();
          };
          img.onerror = function () {
            self.ready[key] = false;
            done();
          };
          img.src = './assets/images/player/' + FILES[key];
          self.images[key] = img;
        });
      });
    },

    get: function (state) {
      if (this.ready[state]) return this.images[state];
      if (this.ready.idle) return this.images.idle;
      return null;
    },

    hasAny: function () {
      const keys = Object.keys(this.ready);
      for (let i = 0; i < keys.length; i++) {
        if (this.ready[keys[i]]) return true;
      }
      return false;
    }
  };

  global.PlayerSprites = PlayerSprites;
})(window);
