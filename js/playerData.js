/**
 * Игровой профиль (XP, уровень, статистика, серия).
 * Не смешивается с VK-профилем (id / имя / аватар).
 * Сейчас LocalPlayerDataService; позже можно заменить на RemotePlayerDataService.
 */
(function (global) {
  'use strict';

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatLocalDate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function shiftIsoDate(iso, days) {
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return '';
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + days);
    return formatLocalDate(d);
  }

  const LocalPlayerDataService = {
    stats: null,
    debugDateOverride: null,

    todayKey: function () {
      if (global.DEBUG && this.debugDateOverride) return String(this.debugDateOverride);
      return formatLocalDate(new Date());
    },

    load: function () {
      StorageService.migrateStorage();
      this.stats = StorageService.loadPlayerStats();
      this.touchStreak();
      return this.stats;
    },

    save: function () {
      if (!this.stats) this.stats = StorageService.loadPlayerStats();
      StorageService.savePlayerStats(this.stats);
      return this.stats;
    },

    getStats: function () {
      if (!this.stats) this.load();
      return this.stats;
    },

    getLevel: function () {
      return this.getStats().playerLevel || 1;
    },

    getXP: function () {
      return this.getStats().playerXP || 0;
    },

    getRank: function () {
      return getCareerRank(this.getLevel());
    },

    nextLevelXP: function () {
      return getXPRequiredForLevel(this.getLevel());
    },

    touchStreak: function () {
      const stats = this.getStats();
      const today = this.todayKey();
      const last = stats.lastPlayDate;
      if (last === today) {
        this.save();
        return stats;
      }
      if (last && last === shiftIsoDate(today, -1)) {
        stats.currentStreak = (Number(stats.currentStreak) || 0) + 1;
      } else {
        stats.currentStreak = 1;
      }
      if (stats.currentStreak > (Number(stats.bestStreak) || 0)) {
        stats.bestStreak = stats.currentStreak;
      }
      stats.lastPlayDate = today;
      this.save();
      return stats;
    },

    updateStats: function (run) {
      run = run || {};
      const stats = this.getStats();
      stats.gamesPlayed = (Number(stats.gamesPlayed) || 0) + 1;
      stats.totalScore = (Number(stats.totalScore) || 0) + (Number(run.score) || 0);
      stats.highScore = Math.max(Number(stats.highScore) || 0, Number(run.score) || 0);
      stats.bestCombo = Math.max(Number(stats.bestCombo) || 0, Number(run.maxCombo || run.bestCombo) || 0);
      stats.maxLevel = Math.max(Number(stats.maxLevel) || 1, Number(run.level) || 1);
      stats.totalDocuments = (Number(stats.totalDocuments) || 0) + (Number(run.documentsCaught || run.documentsCollected) || 0);
      stats.totalPayments = (Number(stats.totalPayments) || 0) + (Number(run.paymentsCaught) || 0);
      stats.totalBonuses = (Number(stats.totalBonuses) || 0) + (Number(run.bonusesCaught) || 0);
      stats.totalPenalties = (Number(stats.totalPenalties) || 0) + (Number(run.penaltiesHit) || 0);
      stats.eventsCompleted = (Number(stats.eventsCompleted) || 0) + (Number(run.eventsCompleted) || 0);
      this.save();
      return stats;
    },

    addXP: function (amount) {
      const stats = this.getStats();
      const gained = Math.max(0, Math.floor(Number(amount) || 0));
      const fromLevel = stats.playerLevel || 1;
      const fromRank = getCareerRank(fromLevel).title;
      const levels = [];
      stats.playerXP = (Number(stats.playerXP) || 0) + gained;
      let guard = 0;
      while (guard < 80) {
        const need = getXPRequiredForLevel(stats.playerLevel);
        if (stats.playerXP < need) break;
        stats.playerXP -= need;
        stats.playerLevel += 1;
        levels.push(stats.playerLevel);
        guard += 1;
      }
      const toRank = getCareerRank(stats.playerLevel).title;
      this.save();
      return {
        gained: gained,
        fromLevel: fromLevel,
        toLevel: stats.playerLevel,
        levelsGained: levels,
        fromRank: fromRank,
        toRank: toRank,
        rankChanged: fromRank !== toRank,
        playerXP: stats.playerXP,
        nextLevelXP: getXPRequiredForLevel(stats.playerLevel)
      };
    },

    setAchievementsUnlocked: function (count) {
      this.getStats().achievementsUnlocked = count;
      this.save();
    },

    addDailyCompleted: function () {
      this.getStats().dailyChallengesCompleted = (Number(this.getStats().dailyChallengesCompleted) || 0) + 1;
      this.save();
    },

    advanceDebugDate: function () {
      if (!global.DEBUG) return this.todayKey();
      const cur = this.debugDateOverride || this.todayKey();
      this.debugDateOverride = shiftIsoDate(cur, 1);
      this.touchStreak();
      return this.debugDateOverride;
    }
  };

  global.formatLocalDate = formatLocalDate;
  global.LocalPlayerDataService = LocalPlayerDataService;
  global.HybridPlayerDataService = LocalPlayerDataService;
  global.PlayerDataService = LocalPlayerDataService;
})(window);
