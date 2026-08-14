/**
 * Локальное хранилище с namespace accountantNinja_*.
 * Версия 2 добавляет playerStats и dailyChallenge, не удаляя старые ключи.
 */
(function (global) {
  'use strict';

  const PREFIX = 'accountantNinja_';

  const DEFAULTS = {
    highScore: 0,
    maxCombo: 0,
    maxLevel: 1,
    soundEnabled: true,
    tutorialCompleted: false,
    gamesPlayed: 0,
    achievements: {},
    lifetimeDocs: 0
  };

  function key(name) {
    return PREFIX + name;
  }

  function read(name, fallback) {
    try {
      const raw = localStorage.getItem(key(name));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function write(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function defaultPlayerStats() {
    return {
      gamesPlayed: 0,
      totalScore: 0,
      highScore: 0,
      bestCombo: 0,
      maxLevel: 1,
      totalDocuments: 0,
      totalPayments: 0,
      totalBonuses: 0,
      totalPenalties: 0,
      eventsCompleted: 0,
      achievementsUnlocked: 0,
      dailyChallengesCompleted: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastPlayDate: null,
      playerXP: 0,
      playerLevel: 1
    };
  }

  function safeNum(value, fallback, min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (min != null && n < min) return min;
    return Math.floor(n);
  }

  function sanitizePlayerStats(stats) {
    const base = defaultPlayerStats();
    const src = stats && typeof stats === 'object' ? stats : {};
    const out = {};
    out.gamesPlayed = safeNum(src.gamesPlayed, 0, 0);
    out.totalScore = safeNum(src.totalScore, 0, 0);
    out.highScore = safeNum(src.highScore, 0, 0);
    out.bestCombo = safeNum(src.bestCombo, 0, 0);
    out.maxLevel = Math.max(1, safeNum(src.maxLevel, 1, 1));
    out.totalDocuments = safeNum(src.totalDocuments, 0, 0);
    out.totalPayments = safeNum(src.totalPayments, 0, 0);
    out.totalBonuses = safeNum(src.totalBonuses, 0, 0);
    out.totalPenalties = safeNum(src.totalPenalties, 0, 0);
    out.eventsCompleted = safeNum(src.eventsCompleted, 0, 0);
    out.achievementsUnlocked = safeNum(src.achievementsUnlocked, 0, 0);
    out.dailyChallengesCompleted = safeNum(src.dailyChallengesCompleted, 0, 0);
    out.currentStreak = safeNum(src.currentStreak, 0, 0);
    out.bestStreak = safeNum(src.bestStreak, 0, 0);
    out.lastPlayDate = typeof src.lastPlayDate === 'string' ? src.lastPlayDate : (src.lastPlayDate || null);
    out.playerXP = safeNum(src.playerXP, 0, 0);
    out.playerLevel = Math.max(1, safeNum(src.playerLevel, 1, 1));
    Object.keys(base).forEach(function (k) {
      if (out[k] == null) out[k] = base[k];
    });
    return out;
  }

  function migrateStorage() {
    const target = global.STORAGE_VERSION || 2;
    let version = Number(read('storageVersion', 0)) || 0;
    if (version >= target && read('playerStats', null)) {
      return { migrated: false, version: version };
    }

    const stats = defaultPlayerStats();
    const existing = read('playerStats', null);
    if (existing && typeof existing === 'object') {
      Object.keys(stats).forEach(function (k) {
        if (existing[k] != null) stats[k] = existing[k];
      });
    }

    stats.highScore = Math.max(Number(stats.highScore) || 0, Number(read('highScore', 0)) || 0);
    stats.bestCombo = Math.max(Number(stats.bestCombo) || 0, Number(read('maxCombo', 0)) || 0);
    stats.maxLevel = Math.max(Number(stats.maxLevel) || 1, Number(read('maxLevel', 1)) || 1);
    stats.gamesPlayed = Math.max(Number(stats.gamesPlayed) || 0, Number(read('gamesPlayed', 0)) || 0);
    stats.totalDocuments = Math.max(Number(stats.totalDocuments) || 0, Number(read('lifetimeDocs', 0)) || 0);

    const ach = read('achievements', {});
    if (ach && typeof ach === 'object') {
      stats.achievementsUnlocked = Object.keys(ach).filter(function (id) {
        return !!ach[id];
      }).length;
    }

    write('playerStats', sanitizePlayerStats(stats));
    write('storageVersion', target);
    write('highScore', stats.highScore);
    write('maxCombo', stats.bestCombo);
    write('maxLevel', stats.maxLevel);
    write('gamesPlayed', stats.gamesPlayed);
    write('lifetimeDocs', stats.totalDocuments);
    return { migrated: true, version: target };
  }

  const Storage = {
    read: read,
    write: write,
    migrateStorage: migrateStorage,
    defaultPlayerStats: defaultPlayerStats,

    getStorageVersion: function () {
      return Number(read('storageVersion', 0)) || 0;
    },

    loadPlayerStats: function () {
      migrateStorage();
      const data = read('playerStats', null);
      const base = defaultPlayerStats();
      if (!data || typeof data !== 'object') return sanitizePlayerStats(base);
      Object.keys(base).forEach(function (k) {
        if (data[k] != null) base[k] = data[k];
      });
      return sanitizePlayerStats(base);
    },

    savePlayerStats: function (stats) {
      const clean = sanitizePlayerStats(stats || defaultPlayerStats());
      write('playerStats', clean);
      write('highScore', clean.highScore);
      write('maxCombo', clean.bestCombo);
      write('maxLevel', clean.maxLevel);
      write('gamesPlayed', clean.gamesPlayed);
      write('lifetimeDocs', clean.totalDocuments);
      return true;
    },

    loadDailyChallenge: function () {
      const data = read('dailyChallenge', null);
      return data && typeof data === 'object' ? data : null;
    },

    saveDailyChallenge: function (data) {
      write('dailyChallenge', data || null);
    },

    loadHighScore: function () {
      return Number(read('highScore', DEFAULTS.highScore)) || 0;
    },

    saveHighScore: function (score) {
      const current = this.loadHighScore();
      if (score > current) {
        write('highScore', score);
        return true;
      }
      return false;
    },

    loadMaxCombo: function () {
      return Number(read('maxCombo', DEFAULTS.maxCombo)) || 0;
    },

    saveMaxCombo: function (combo) {
      if (combo > this.loadMaxCombo()) write('maxCombo', combo);
    },

    loadMaxLevel: function () {
      return Number(read('maxLevel', DEFAULTS.maxLevel)) || 1;
    },

    saveMaxLevel: function (level) {
      if (level > this.loadMaxLevel()) write('maxLevel', level);
    },

    isSoundEnabled: function () {
      return read('soundEnabled', DEFAULTS.soundEnabled) !== false;
    },

    setSoundEnabled: function (enabled) {
      write('soundEnabled', !!enabled);
    },

    isTutorialCompleted: function () {
      return read('tutorialCompleted', DEFAULTS.tutorialCompleted) === true;
    },

    setTutorialCompleted: function () {
      write('tutorialCompleted', true);
    },

    resetTutorial: function () {
      write('tutorialCompleted', false);
    },

    getGamesPlayed: function () {
      return Number(read('gamesPlayed', DEFAULTS.gamesPlayed)) || 0;
    },

    incrementGamesPlayed: function () {
      const next = this.getGamesPlayed() + 1;
      write('gamesPlayed', next);
      return next;
    },

    getLifetimeDocs: function () {
      return Number(read('lifetimeDocs', DEFAULTS.lifetimeDocs)) || 0;
    },

    addLifetimeDocs: function (count) {
      const next = this.getLifetimeDocs() + count;
      write('lifetimeDocs', next);
      return next;
    },

    loadAchievements: function () {
      const data = read('achievements', DEFAULTS.achievements);
      return data && typeof data === 'object' ? data : {};
    },

    saveAchievements: function (map) {
      write('achievements', map || {});
    },

    loadApiToken: function () {
      return read('apiToken', '') || '';
    },

    saveApiToken: function (token) {
      write('apiToken', token || '');
    },

    isCloudMigrated: function () {
      return read('cloudMigrated', false) === true;
    },

    setCloudMigrated: function (value) {
      write('cloudMigrated', !!value);
    },

    loadPendingSync: function () {
      const data = read('pendingSync', null);
      return data && typeof data === 'object' ? data : {};
    },

    savePendingSync: function (data) {
      write('pendingSync', data || {});
    },

    loadLeaderboardCache: function (period) {
      const all = read('leaderboardCache', {}) || {};
      return all[period || 'all'] || null;
    },

    saveLeaderboardCache: function (period, payload) {
      const all = read('leaderboardCache', {}) || {};
      all[period || 'all'] = payload;
      write('leaderboardCache', all);
    },

    getRecords: function () {
      const stats = this.loadPlayerStats();
      return {
        highScore: stats.highScore,
        maxCombo: stats.bestCombo,
        maxLevel: stats.maxLevel,
        gamesPlayed: stats.gamesPlayed,
        lifetimeDocs: stats.totalDocuments,
        bestStreak: stats.bestStreak
      };
    }
  };

  global.GameStorage = Storage;
  global.StorageService = Storage;
  global.migrateStorage = migrateStorage;

  global.AchievementStorage = {
    load: function () {
      return Storage.loadAchievements();
    },
    save: function (map) {
      return Storage.saveAchievements(map);
    }
  };
})(window);
