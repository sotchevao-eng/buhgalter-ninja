/**
 * Звуковая архитектура без обязательных файлов.
 * Синтезирует короткие сигналы через Web Audio API.
 */
(function (global) {
  'use strict';

  const AudioManager = {
    ctx: null,
    enabled: true,

    init: function () {
      this.enabled = GameStorage.isSoundEnabled();
      this._ensureContext();
    },

    _ensureContext: function () {
      if (this.ctx) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
      } catch (err) {
        this.ctx = null;
      }
    },

    unlock: function () {
      this._ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
    },

    setEnabled: function (enabled) {
      this.enabled = !!enabled;
      GameStorage.setSoundEnabled(this.enabled);
      if (this.enabled) this.unlock();
    },

    toggle: function () {
      this.setEnabled(!this.enabled);
      return this.enabled;
    },

    play: function (type) {
      if (!this.enabled) return;
      this._ensureContext();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(function () {});

      switch (type) {
        case 'ui_click':
          this._tone(640, 0.04, 'sine', 0.04);
          break;
        case 'catch':
        case 'good_collect':
          this._tone(720, 0.07, 'triangle', 0.08);
          break;
        case 'bonus':
        case 'bonus_collect':
          this._chord([523, 659, 784], 0.16, 0.07);
          break;
        case 'error':
        case 'bad_hit':
          this._tone(180, 0.14, 'sawtooth', 0.07);
          break;
        case 'life':
          this._tone(140, 0.22, 'square', 0.08);
          break;
        case 'level':
        case 'level_up':
          this._arpeggio([392, 523, 659, 784], 0.09);
          break;
        case 'gameover':
        case 'game_over':
          this._arpeggio([392, 330, 262, 196], 0.16);
          break;
        case 'combo':
          this._tone(880, 0.1, 'sine', 0.06);
          break;
        case 'ninja_mode':
          this._arpeggio([523, 784, 1046], 0.08);
          break;
        case 'new_record':
          this._chord([659, 784, 988], 0.18, 0.07);
          break;
        case 'pause':
          this._tone(360, 0.08, 'sine', 0.04);
          break;
        case 'resume':
          this._tone(520, 0.07, 'triangle', 0.05);
          break;
        default:
          this._tone(500, 0.06, 'sine', 0.05);
      }
    },

    _tone: function (freq, duration, type, gain) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    },

    _chord: function (freqs, duration, gain) {
      const self = this;
      freqs.forEach(function (f, i) {
        setTimeout(function () {
          self._tone(f, duration, 'triangle', gain);
        }, i * 40);
      });
    },

    _arpeggio: function (freqs, step) {
      const self = this;
      freqs.forEach(function (f, i) {
        setTimeout(function () {
          self._tone(f, step + 0.04, 'triangle', 0.07);
        }, i * step * 1000);
      });
    }
  };

  global.AudioManager = AudioManager;
})(window);
