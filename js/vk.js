/**
 * Слой окружения: VK Mini Apps или обычный браузер.
 * Игровой цикл не вызывает VK Bridge напрямую — только этот адаптер.
 *
 * Официальные методы (dev.vk.com/bridge), которые могут использоваться:
 * - VKWebAppInit
 * - VKWebAppGetLaunchParams
 * - VKWebAppGetUserInfo
 * - VKWebAppShare
 * - VKWebAppShowInviteBox
 * - VKWebAppJoinGroup (только при реальном numeric group_id)
 * - VKWebAppTapticNotificationOccurred (если supports)
 *
 * Если метод недоступен — безопасный fallback, без выдуманных API.
 */
(function (global) {
  'use strict';

  const BRIDGE_SRC = 'https://cdn.jsdelivr.net/npm/@vkontakte/vk-bridge@2.15.9/dist/browser.min.js';
  const INIT_TIMEOUT = (APP_CONFIG && APP_CONFIG.vkInitTimeoutMs) || 2500;

  const appEnvironment = {
    mode: 'browser',
    platform: null,
    vkAvailable: false
  };

  const playerProfile = {
    id: null,
    firstName: '',
    lastName: '',
    avatar: '',
    source: 'guest'
  };

  const launchParams = {};
  const challengeState = {
    active: false,
    fromId: null,
    fromName: '',
    score: 0
  };

  let profileNoticeShown = false;
  let subscribed = false;

  function safeStr(value, max) {
    const text = String(value == null ? '' : value)
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001f]/g, '')
      .trim();
    return text.slice(0, max || 64);
  }

  function isHttpsUrl(url) {
    try {
      const parsed = new URL(String(url), window.location.href);
      return parsed.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  function isSafeAvatar(url) {
    if (!isHttpsUrl(url)) return false;
    try {
      const host = new URL(url).hostname.toLowerCase();
      return (
        host === 'vk.com' ||
        host === 'vk.ru' ||
        host.endsWith('.vk.com') ||
        host.endsWith('.vk.ru') ||
        host.endsWith('.userapi.com')
      );
    } catch (err) {
      return false;
    }
  }

  function parseGroupId(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return 0;
    const id = Number(digits);
    return id > 0 ? id : 0;
  }

  function mapPlatform(vkPlatform) {
    const value = String(vkPlatform || '').toLowerCase();
    if (!value) return null;
    if (value.indexOf('desktop') !== -1) return 'desktop';
    if (value.indexOf('tablet') !== -1 || value.indexOf('ipad') !== -1) return 'tablet';
    if (
      value.indexOf('mobile') !== -1 ||
      value.indexOf('iphone') !== -1 ||
      value.indexOf('android') !== -1
    ) {
      return 'mobile';
    }
    return 'mobile';
  }

  function parseLaunchParams() {
    const out = {};
    try {
      const search = new URLSearchParams(window.location.search || '');
      search.forEach(function (value, key) {
        out[key] = safeStr(value, 200);
      });
      const hashRaw = (window.location.hash || '').replace(/^#/, '');
      if (hashRaw) {
        const hashQuery = hashRaw.indexOf('=') >= 0 ? hashRaw : '';
        if (hashQuery) {
          const hp = new URLSearchParams(hashQuery);
          hp.forEach(function (value, key) {
            if (!out[key]) out[key] = safeStr(value, 200);
          });
        }
      }
    } catch (err) {
      if (global.DEBUG) {
        try { console.warn('Не удалось прочитать параметры запуска'); } catch (ignore) {}
      }
    }

    Object.keys(launchParams).forEach(function (key) {
      delete launchParams[key];
    });
    Object.keys(out).forEach(function (key) {
      launchParams[key] = out[key];
    });

    if (APP_CONFIG.challengesEnabled) {
      const score = Number(out.challenge_score || out.challenge || 0);
      if (score > 0) {
        challengeState.active = true;
        challengeState.score = score;
        challengeState.fromName = safeStr(out.from_name || out.from || '', 40);
        challengeState.fromId = safeStr(out.from_id || '', 32);
      }
    } else {
      challengeState.active = false;
    }

    return launchParams;
  }

  function looksLikeVK() {
    try {
      if (launchParams.vk_user_id || launchParams.vk_app_id || launchParams.vk_platform) {
        return true;
      }
      const params = new URLSearchParams(window.location.search);
      if (params.has('vk_user_id') || params.has('vk_app_id') || params.has('vk_platform')) {
        return true;
      }
      const ref = document.referrer || '';
      if (window.parent !== window && /vk\.(com|ru)/i.test(ref)) {
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  function resetGuestProfile() {
    playerProfile.id = null;
    playerProfile.firstName = '';
    playerProfile.lastName = '';
    playerProfile.avatar = '';
    playerProfile.source = 'guest';
  }

  function applyMockIfDebug() {
    if (!global.DEBUG) return false;
    const mock = APP_CONFIG.mockVKUser;
    if (!mock) return false;
    playerProfile.id = safeStr(mock.id, 32) || null;
    playerProfile.firstName = safeStr(mock.firstName, 40);
    playerProfile.lastName = safeStr(mock.lastName, 40);
    playerProfile.avatar = isSafeAvatar(mock.avatar) ? mock.avatar : '';
    playerProfile.source = 'mock';
    return true;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        reject(new Error('timeout'));
      }, ms);
      promise.then(
        function (value) {
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('bridge-load')); };
      document.head.appendChild(script);
    });
  }

  function enterGuest(mode) {
    appEnvironment.mode = mode || 'browser';
    appEnvironment.vkAvailable = false;
    if (!global.DEBUG || playerProfile.source !== 'mock') {
      if (playerProfile.source !== 'vk') resetGuestProfile();
    }
  }

  const VKService = {
    ready: false,
    bridge: null,
    inVK: false,
    playerProfile: playerProfile,
    launchParams: launchParams,
    challengeState: challengeState,

    getLaunchSearch: function () {
      return window.location.search || '';
    },

    isVK: function () {
      return appEnvironment.mode === 'vk' && appEnvironment.vkAvailable;
    },

    isVKEnvironment: looksLikeVK,

    supports: function (method) {
      if (!this.bridge) return false;
      try {
        if (typeof this.bridge.supports === 'function') {
          return this.bridge.supports(method);
        }
        return typeof this.bridge.send === 'function';
      } catch (err) {
        return false;
      }
    },

    send: function (method, params) {
      if (!this.bridge || typeof this.bridge.send !== 'function') {
        return Promise.reject(new Error('no-bridge'));
      }
      if (!this.supports(method)) {
        return Promise.reject(new Error('unsupported'));
      }
      return this.bridge.send(method, params || {});
    },

    init: function () {
      const self = this;
      parseLaunchParams();
      applyMockIfDebug();

      const wantVK = !!(APP_CONFIG.vkEnabled && looksLikeVK());
      if (!wantVK) {
        appEnvironment.mode = 'browser';
        appEnvironment.platform = null;
        appEnvironment.vkAvailable = false;
        if (playerProfile.source !== 'mock') playerProfile.source = 'guest';
        this.inVK = false;
        this.ready = true;
        return Promise.resolve(playerProfile);
      }

      return withTimeout(this._connect(), INIT_TIMEOUT)
        .then(function () {
          return self._afterBridge();
        })
        .catch(function (err) {
          if (err && err.message !== 'timeout') {
            if (global.DEBUG) {
              try { console.warn('VK недоступен, продолжаем как гость'); } catch (ignore) {}
            }
          }
          self.bridge = null;
          self.inVK = false;
          enterGuest('browser');
          self.ready = true;
          return playerProfile;
        })
        .then(function () {
          self.ready = true;
          return playerProfile;
        });
    },

    _connect: function () {
      const self = this;
      if (global.vkBridge && typeof global.vkBridge.send === 'function') {
        this.bridge = global.vkBridge;
        return Promise.resolve(this.bridge);
      }
      return loadScript(BRIDGE_SRC).then(function () {
        if (!global.vkBridge || typeof global.vkBridge.send !== 'function') {
          throw new Error('bridge-missing');
        }
        self.bridge = global.vkBridge;
        return self.bridge;
      });
    },

    _afterBridge: function () {
      const self = this;
      return this.send('VKWebAppInit', {})
        .then(function () {
          appEnvironment.mode = 'vk';
          appEnvironment.vkAvailable = true;
          self.inVK = true;
          self._subscribe();
          return self._readLaunchParams();
        })
        .then(function () {
          if (!APP_CONFIG.vkProfileEnabled) return playerProfile;
          return self.getUser();
        })
        .catch(function () {
          self.inVK = false;
          enterGuest('browser');
          return playerProfile;
        });
    },

    _readLaunchParams: function () {
      const self = this;
      if (!this.supports('VKWebAppGetLaunchParams')) {
        appEnvironment.platform = mapPlatform(launchParams.vk_platform);
        return Promise.resolve(launchParams);
      }
      return this.send('VKWebAppGetLaunchParams', {})
        .then(function (data) {
          if (data && typeof data === 'object') {
            Object.keys(data).forEach(function (key) {
              if (data[key] != null) launchParams[key] = safeStr(data[key], 200);
            });
          }
          appEnvironment.platform = mapPlatform(launchParams.vk_platform);
          return launchParams;
        })
        .catch(function () {
          appEnvironment.platform = mapPlatform(launchParams.vk_platform);
          return launchParams;
        });
    },

    _subscribe: function () {
      if (subscribed || !this.bridge || typeof this.bridge.subscribe !== 'function') return;
      subscribed = true;
      this.bridge.subscribe(function (event) {
        const type = event && event.detail && event.detail.type;
        if (type === 'VKWebAppViewRestore' || type === 'VKWebAppViewHide') {
          const game = global.game;
          if (game && game.state === 'playing') {
            game.pauseGame('vk-view');
          }
        }
      });
    },

    getUser: function () {
      const self = this;
      if (!this.supports('VKWebAppGetUserInfo')) {
        return Promise.resolve(playerProfile);
      }
      return this.send('VKWebAppGetUserInfo', {})
        .then(function (user) {
          if (!user || !user.id) return playerProfile;
          playerProfile.id = String(user.id);
          playerProfile.firstName = safeStr(user.first_name, 40);
          playerProfile.lastName = safeStr(user.last_name, 40);
          const photo = user.photo_200 || user.photo_100 || '';
          playerProfile.avatar = isSafeAvatar(photo) ? photo : '';
          playerProfile.source = 'vk';
          return playerProfile;
        })
        .catch(function () {
          if (!profileNoticeShown) {
            profileNoticeShown = true;
            if (typeof UI !== 'undefined' && UI.toast) {
              UI.toast('Не удалось загрузить профиль. Можно продолжить как гость.');
            }
          }
          if (playerProfile.source !== 'mock') playerProfile.source = 'guest';
          return playerProfile;
        });
    },

    getPlayerProfile: function () {
      return playerProfile;
    },

    getGreeting: function () {
      const name = safeStr(playerProfile.firstName, 40);
      if (name) return name + ', готовы к отчётному периоду?';
      return '';
    },

    shareResult: function (data) {
      return shareGameResult(data || {});
    },

    inviteFriends: function () {
      AnalyticsService.track('share_click', { type: 'invite' });
      const text = buildInviteText();
      if (this.isVK() && this.supports('VKWebAppShowInviteBox')) {
        return this.send('VKWebAppShowInviteBox', {
          message: text
        }).then(function () {
          return { shared: true, via: 'vk-invite' };
        }).catch(function () {
          return shareGameResult({ score: (global.game && global.game.lastScore) || 0 });
        });
      }
      return shareGameResult({ score: (global.game && global.game.lastScore) || 0 });
    },

    openCommunity: function () {
      AnalyticsService.track('community_click');
      EnvAdapter.beforeExternal();
      const groupId = parseGroupId(APP_CONFIG.vkGroupId);
      const url = APP_CONFIG.communityUrl || (groupId ? ('https://vk.com/club' + groupId) : '');

      if (this.isVK() && url && this.supports('VKWebAppOpenURL')) {
        return this.send('VKWebAppOpenURL', { url: url }).then(function () {
          return { opened: true, via: 'vk-url' };
        }).catch(function () {
          return openHttps(url);
        });
      }
      return openHttps(url);
    },

    haptic: function (kind) {
      if (!this.isVK() || !this.supports('VKWebAppTapticNotificationOccurred')) {
        return Promise.resolve({ skipped: true });
      }
      const type = kind === 'error' || kind === 'warning' ? kind : 'success';
      return this.send('VKWebAppTapticNotificationOccurred', { type: type }).catch(function () {
        return { skipped: true };
      });
    }
  };

  function openHttps(url) {
    if (!isHttpsUrl(url)) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Ссылка сообщества появится после публикации.');
      }
      return Promise.resolve({ opened: false });
    }
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return Promise.resolve({ opened: true, via: 'https' });
    } catch (err) {
      return Promise.resolve({ opened: false });
    }
  }

  function shareLink() {
    if (isHttpsUrl(APP_CONFIG.appLaunchUrl)) return APP_CONFIG.appLaunchUrl;
    return '';
  }

  function buildShareText(data) {
    data = data || {};
    const score = Number(data.score) || 0;
    const combo = Number(data.combo || data.maxCombo) || 0;
    const rank = data.rank || (typeof getRank === 'function' ? getRank(score) : { title: 'Бухгалтер', icon: '🥷' });
    return (
      'Мой результат в игре\n«Бухгалтер-ниндзя» — ' +
      score.toLocaleString('ru-RU') +
      ' очков! ' + (rank.icon || '🥷') + '\n\n' +
      (data.isNewRecord ? '🏆 Новый личный рекорд!\n' : '') +
      'Звание: ' + (rank.title || 'Бухгалтер-ниндзя') + '\n' +
      'Combo: ×' + combo + '\n\n' +
      'А ты переживёшь отчётный период?'
    );
  }

  function buildInviteText() {
    return 'Бросаю вызов коллегам в игре «Бухгалтер-ниндзя»! Переживёшь отчётный период?';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return { copied: true };
      }).catch(function () {
        return { copied: false, text: text };
      });
    }
    return Promise.resolve({ copied: false, text: text });
  }

  function webShare(text, url) {
    if (navigator.share) {
      const payload = { title: APP_CONFIG.appName || 'Бухгалтер-ниндзя', text: text };
      if (url) payload.url = url;
      return navigator.share(payload).then(function () {
        return { shared: true, via: 'web-share' };
      }).catch(function () {
        return copyText(text);
      });
    }
    return copyText(text);
  }

  function shareGameResult(data) {
    AnalyticsService.track('share_click', { type: 'result' });
    const text = buildShareText(data);
    const link = shareLink();
    const payload = { text: text, link: link };

    if (typeof generateResultCard === 'function') {
      generateResultCard(data).then(function (card) {
        payload.card = card;
      }).catch(function () {});
    }

    if (VKService.isVK() && VKService.supports('VKWebAppShare')) {
      const params = {};
      if (link) params.link = link;
      if (text) params.text = text;
      return VKService.send('VKWebAppShare', params).then(function () {
        return { shared: true, via: 'vk-share' };
      }).catch(function () {
        return webShare(text, link);
      });
    }
    return webShare(text, link);
  }

  const EnvAdapter = {
    haptic: function (kind) {
      return VKService.haptic(kind);
    },
    beforeExternal: function () {
      const game = global.game;
      if (game && game.state === 'playing') {
        game.pauseGame('leave');
      }
      if (game) {
        try {
          StorageService.saveHighScore(game.score);
          StorageService.saveMaxCombo(game.maxCombo);
          StorageService.saveMaxLevel(game.level);
        } catch (err) {}
      }
    }
  };

  global.appEnvironment = appEnvironment;
  global.playerProfile = playerProfile;
  global.launchParams = launchParams;
  global.challengeState = challengeState;
  global.parseLaunchParams = parseLaunchParams;
  global.shareGameResult = shareGameResult;
  global.buildShareText = buildShareText;
  global.VKService = VKService;
  global.VKAdapter = VKService;
  global.EnvAdapter = EnvAdapter;
  global.isVKEnvironment = looksLikeVK;
})(window);
