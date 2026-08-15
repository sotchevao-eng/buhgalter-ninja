/**
 * Синхронизация профиля с backend. Не блокирует кнопку «Играть».
 * Пока API не настроен или офлайн — LOCAL MODE.
 */
(function (global) {
  'use strict';

  function localHasProgress() {
    const stats = PlayerDataService.getStats();
    const ach = StorageService.loadAchievements() || {};
    const unlocked = Object.keys(ach).filter(function (id) { return !!ach[id]; }).length;
    return (Number(stats.highScore) || 0) > 0 ||
      (Number(stats.playerLevel) || 1) > 1 ||
      (Number(stats.gamesPlayed) || 0) > 0 ||
      unlocked > 0;
  }

  function remoteHasProgress(progress) {
    if (!progress) return false;
    return (Number(progress.highScore) || 0) > 0 ||
      (Number(progress.playerLevel) || 1) > 1 ||
      (Number(progress.gamesPlayed) || 0) > 0;
  }

  function achievementIds() {
    const map = StorageService.loadAchievements() || {};
    return Object.keys(map).filter(function (id) { return !!map[id]; });
  }

  function applyAchievementsUnion(ids) {
    const map = StorageService.loadAchievements() || {};
    (ids || []).forEach(function (item) {
      const id = typeof item === 'string' ? item : (item && item.id);
      if (!id) return;
      const at = (item && item.unlockedAt) ? Date.parse(item.unlockedAt) : Date.now();
      if (!map[id] || map[id] === true) {
        map[id] = { at: Number.isFinite(at) ? at : Date.now() };
      }
    });
    StorageService.saveAchievements(map);
    if (global.AchievementService && AchievementService.load) AchievementService.load();
    PlayerDataService.setAchievementsUnlocked(Object.keys(map).filter(function (id) { return !!map[id]; }).length);
  }

  function applyCloudProgress(progress) {
    if (!progress) return;
    const stats = PlayerDataService.getStats();
    stats.highScore = Math.max(Number(stats.highScore) || 0, Number(progress.highScore) || 0);
    stats.bestCombo = Math.max(Number(stats.bestCombo) || 0, Number(progress.bestCombo) || 0);
    stats.maxLevel = Math.max(Number(stats.maxLevel) || 1, Number(progress.maxGameLevel) || 1);
    const cloudLevel = Math.max(1, Number(progress.playerLevel) || 1);
    const cloudXP = Math.max(0, Number(progress.xp) || 0);
    const localLevel = Math.max(1, Number(stats.playerLevel) || 1);
    const localXP = Math.max(0, Number(stats.playerXP) || 0);
    if (cloudLevel > localLevel || (cloudLevel === localLevel && cloudXP >= localXP)) {
      stats.playerLevel = cloudLevel;
      stats.playerXP = cloudXP;
    }
    stats.currentStreak = Math.max(Number(stats.currentStreak) || 0, Number(progress.currentStreak) || 0);
    stats.bestStreak = Math.max(Number(stats.bestStreak) || 0, Number(progress.bestStreak) || 0);
    stats.gamesPlayed = Math.max(Number(stats.gamesPlayed) || 0, Number(progress.gamesPlayed) || 0);
    stats.totalScore = Math.max(Number(stats.totalScore) || 0, Number(progress.totalScore) || 0);
    stats.totalDocuments = Math.max(Number(stats.totalDocuments) || 0, Number(progress.totalDocuments) || 0);
    stats.totalPayments = Math.max(Number(stats.totalPayments) || 0, Number(progress.totalPayments) || 0);
    stats.totalBonuses = Math.max(Number(stats.totalBonuses) || 0, Number(progress.totalBonuses) || 0);
    stats.totalPenalties = Math.max(Number(stats.totalPenalties) || 0, Number(progress.totalPenalties) || 0);
    stats.eventsCompleted = Math.max(Number(stats.eventsCompleted) || 0, Number(progress.eventsCompleted) || 0);
    stats.dailyChallengesCompleted = Math.max(
      Number(stats.dailyChallengesCompleted) || 0,
      Number(progress.dailyChallengesCompleted) || 0
    );
    if (progress.lastPlayDate) stats.lastPlayDate = progress.lastPlayDate;
    PlayerDataService.save();
  }

  const SyncService = {
    mode: 'local',
    online: false,
    player: null,
    lastError: '',
    mergeNeeded: false,
    serverDate: null,
    pendingTimer: 0,

    isOnline: function () {
      return this.online && !!ApiClient.getToken() && !(FEATURES && FEATURES.cloudSync === false);
    },

    markPending: function (kind) {
      const pending = StorageService.read('pendingSync', {}) || {};
      pending[kind || 'progress'] = true;
      pending.updatedAt = new Date().toISOString();
      StorageService.write('pendingSync', pending);
    },

    clearPending: function (kind) {
      const pending = StorageService.read('pendingSync', {}) || {};
      if (kind) delete pending[kind];
      else StorageService.write('pendingSync', {});
      if (kind) StorageService.write('pendingSync', pending);
    },

    queueProgress: function () {
      if (!this.isOnline()) return;
      const self = this;
      this.markPending('progress');
      if (this.pendingTimer) clearTimeout(this.pendingTimer);
      this.pendingTimer = setTimeout(function () {
        self.flushPendingChanges();
      }, 1200);
    },

    launchSearch: function () {
      if (global.VKService && typeof VKService.getLaunchSearch === 'function') {
        return VKService.getLaunchSearch();
      }
      return window.location.search || '';
    },

    syncOnBoot: function () {
      const self = this;
      if (!ApiClient.isConfigured() || !FEATURES || FEATURES.cloudSync === false) {
        this.mode = 'local';
        this.online = false;
        return Promise.resolve({ mode: 'local' });
      }
      return this.health()
        .then(function () {
          return self.authIfPossible();
        })
        .then(function (auth) {
          if (!auth && !ApiClient.getToken()) {
            self.mode = 'local';
            self.online = true;
            return { mode: 'guest-online' };
          }
          return self.pullCloud().then(function () {
            return self.flushPendingChanges();
          }).then(function () {
            self.mode = 'online';
            return { mode: 'online' };
          });
        })
        .catch(function (err) {
          self.online = false;
          self.mode = 'local';
          self.lastError = (err && err.friendly) || ApiClient.friendlyError(err);
          return { mode: 'offline', error: self.lastError };
        });
    },

    health: function () {
      return ApiClient.get('/api/health', { timeoutMs: 2500 }).then(function (data) {
        if (data && data.status === 'maintenance') {
          SyncService.online = false;
          SyncService.mode = 'local';
          SyncService.lastError = 'MAINTENANCE';
          if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('Онлайн-рейтинг временно недоступен. Но играть можно!');
          }
          const err = new Error('maintenance');
          err.code = 'MAINTENANCE';
          throw err;
        }
        SyncService.online = !!(data && data.status === 'ok');
        return SyncService.online;
      });
    },

    authIfPossible: function () {
      const search = this.launchSearch();
      if (!search || search.indexOf('vk_user_id') === -1 || search.indexOf('sign=') === -1) {
        return Promise.resolve(null);
      }
      const profile = (global.playerProfile) || {};
      const self = this;
      const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      return ApiClient.post('/api/v1/auth/vk', {
        launchSearch: search,
        displayName: displayName,
        avatarUrl: profile.avatar || ''
      }, { token: '' }).then(function (data) {
        ApiClient.setToken(data.token);
        self.player = data.player;
        self.serverDate = data.serverDate;
        self.mode = 'online';
        self.online = true;
        return data;
      }).catch(function (err) {
        if (err && err.code === 'UNAUTHORIZED' || err && err.code === 'INVALID_SIGN') {
          ApiClient.clearToken();
        }
        throw err;
      });
    },

    pullCloud: function () {
      const self = this;
      if (!ApiClient.getToken()) return Promise.resolve(null);
      return ApiClient.get('/api/v1/me/progress').then(function (data) {
        self.serverDate = data.serverDate;
        if (data.daily && global.DailyChallengeService && DailyChallengeService.applyServerDaily) {
          DailyChallengeService.applyServerDaily(data.daily, data.serverDate);
        }
        const migrated = StorageService.read('cloudMigrated', false) === true;
        const local = localHasProgress();
        const remote = remoteHasProgress(data.progress);
        if (!migrated && local && remote) {
          self.mergeNeeded = true;
          return data;
        }
        if (!migrated && local && !remote) {
          return self.migrateLocal().then(function () { return data; });
        }
        applyCloudProgress(data.progress);
        applyAchievementsUnion(data.achievements || []);
        if (remote || !local) StorageService.write('cloudMigrated', true);
        self.mergeNeeded = false;
        return data;
      });
    },

    migrateLocal: function () {
      const stats = PlayerDataService.getStats();
      const self = this;
      return ApiClient.post('/api/v1/me/migrate-local', {
        highScore: stats.highScore,
        bestCombo: stats.bestCombo,
        maxGameLevel: stats.maxLevel,
        playerLevel: stats.playerLevel,
        achievements: achievementIds()
      }).then(function (data) {
        StorageService.write('cloudMigrated', true);
        self.mergeNeeded = false;
        if (data.progress) applyCloudProgress(data.progress);
        return data;
      });
    },

    skipMerge: function () {
      StorageService.write('cloudMigrated', true);
      this.mergeNeeded = false;
      return this.pullCloud();
    },

    flushPendingChanges: function () {
      if (!this.isOnline()) return Promise.resolve(false);
      const pending = StorageService.read('pendingSync', {}) || {};
      const stats = PlayerDataService.getStats();
      const tasks = [];
      if (pending.progress || pending.achievements) {
        tasks.push(ApiClient.put('/api/v1/me/progress', {
          highScore: stats.highScore,
          bestCombo: stats.bestCombo,
          maxGameLevel: stats.maxLevel,
          achievements: achievementIds()
        }));
      }
      if (!tasks.length) return Promise.resolve(true);
      return Promise.all(tasks).then(function () {
        SyncService.clearPending();
        return true;
      }).catch(function (err) {
        SyncService.lastError = (err && err.friendly) || ApiClient.friendlyError(err);
        return false;
      });
    },

    startSession: function () {
      if (!this.isOnline()) return Promise.resolve(null);
      return ApiClient.post('/api/v1/game/session', {
        gameVersion: global.APP_VERSION || '0.9.1'
      }).then(function (data) {
        return data;
      }).catch(function (err) {
        SyncService.lastError = (err && err.friendly) || ApiClient.friendlyError(err);
        return null;
      });
    },

    finishSession: function (sessionId, payload) {
      if (!this.isOnline() || !sessionId) {
        return Promise.resolve({ local: true });
      }
      const body = Object.assign({
        gameVersion: global.APP_VERSION || '0.9.1'
      }, payload || {});
      return ApiClient.post('/api/v1/game/session/' + encodeURIComponent(sessionId) + '/finish', body)
        .then(function (data) {
          if (data.progress) applyCloudProgress(data.progress);
          return data;
        })
        .catch(function (err) {
          SyncService.markPending('progress');
          SyncService.lastError = (err && err.friendly) || ApiClient.friendlyError(err);
          return { local: true, error: SyncService.lastError, rejected: err && err.status === 400 };
        });
    },

    claimDaily: function () {
      if (!this.isOnline()) return Promise.resolve(null);
      return ApiClient.post('/api/v1/me/daily/claim', {}).then(function (data) {
        if (data.progress) applyCloudProgress(data.progress);
        if (data.daily && DailyChallengeService.applyServerDaily) {
          DailyChallengeService.applyServerDaily(data.daily, data.serverDate);
        }
        return data;
      }).catch(function (err) {
        if (err && err.code === 'ALREADY_CLAIMED') return { already: true };
        return null;
      });
    }
  };

  const origLoad = LocalPlayerDataService.load;
  LocalPlayerDataService.load = function () {
    const stats = origLoad.call(this);
    return stats;
  };

  global.HybridPlayerDataService = LocalPlayerDataService;
  global.PlayerDataService = LocalPlayerDataService;
  global.SyncService = SyncService;
})(window);
