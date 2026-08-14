/**
 * Одно ежедневное задание. Дата — локальный календарь YYYY-MM-DD.
 * Задание на день стабильно: seed от даты, не от Math.random().
 */
(function (global) {
  'use strict';

  const POOL = [
    { id: 'docs25', title: 'Первичка', description: 'Соберите 25 документов', target: 25, xp: 250, key: 'documentsCaught' },
    { id: 'clean750', title: 'Без ошибок', description: 'Наберите 750 очков без потери жизни', target: 750, xp: 300, key: 'cleanScore' },
    { id: 'combo10', title: 'Комбо', description: 'Получите Combo ×10', target: 10, xp: 200, key: 'maxCombo' },
    { id: 'pay5', title: 'День оплат', description: 'Поймайте 5 оплат', target: 5, xp: 200, key: 'paymentsCaught' },
    { id: 'bonus3', title: 'Бонусный день', description: 'Поймайте 3 бонуса', target: 3, xp: 180, key: 'bonusesCaught' },
    { id: 'level5', title: 'Отчётность', description: 'Дойдите до игрового уровня 5', target: 5, xp: 220, key: 'level' },
    { id: 'score2000', title: 'Ниндзя', description: 'Наберите 2 000 очков', target: 2000, xp: 350, key: 'score' }
  ];

  function hashDate(dateStr) {
    let h = 2166136261;
    const s = String(dateStr);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function pickForDate(dateStr) {
    return POOL[hashDate(dateStr) % POOL.length];
  }

  function emptyState(dateStr, def) {
    return {
      date: dateStr,
      challengeId: def.id,
      progress: 0,
      completed: false,
      rewardClaimed: false
    };
  }

  const DailyChallengeService = {
    state: null,
    def: null,
    serverDate: null,

    applyServerDaily: function (daily, serverDate) {
      if (serverDate) this.serverDate = String(serverDate);
      if (!daily) return this.view();
      const def = pickForDate(daily.date || this.serverDate || PlayerDataService.todayKey());
      this.def = POOL.filter(function (item) { return item.id === daily.id; })[0] || def;
      this.state = {
        date: daily.date,
        challengeId: daily.id || this.def.id,
        progress: Number(daily.progress) || 0,
        completed: !!daily.completed,
        rewardClaimed: !!daily.rewardClaimed
      };
      StorageService.saveDailyChallenge(this.state);
      return this.view();
    },

    getTodayChallenge: function () {
      const today = this.serverDate || PlayerDataService.todayKey();
      let stored = StorageService.loadDailyChallenge();
      const def = pickForDate(today);
      if (!stored || stored.date !== today || stored.challengeId !== def.id) {
        stored = emptyState(today, def);
        StorageService.saveDailyChallenge(stored);
      }
      this.state = stored;
      this.def = def;
      return this.view();
    },

    view: function () {
      if (!this.state) this.getTodayChallenge();
      const def = this.def || pickForDate(this.state.date);
      const target = def.target;
      const progress = Math.min(target, Number(this.state.progress) || 0);
      return {
        date: this.state.date,
        id: def.id,
        title: def.title,
        description: def.description,
        target: target,
        progress: progress,
        completed: !!this.state.completed || progress >= target,
        rewardClaimed: !!this.state.rewardClaimed,
        xp: def.xp
      };
    },

    runValue: function (run, key) {
      run = run || {};
      if (key === 'cleanScore') {
        return run.lostLifeThisRun ? 0 : (Number(run.score) || 0);
      }
      return Number(run[key]) || 0;
    },

    updateProgress: function (run) {
      const view = this.getTodayChallenge();
      if (view.rewardClaimed && view.completed) return this.view();
      const value = this.runValue(run, this.def.key);
      const next = Math.max(Number(this.state.progress) || 0, value);
      this.state.progress = Math.min(this.def.target, next);
      if (this.state.progress >= this.def.target) this.state.completed = true;
      StorageService.saveDailyChallenge(this.state);
      return this.view();
    },

    completeChallenge: function () {
      this.getTodayChallenge();
      this.state.progress = this.def.target;
      this.state.completed = true;
      StorageService.saveDailyChallenge(this.state);
      return this.view();
    },

    claimReward: function () {
      const view = this.getTodayChallenge();
      if (!view.completed || view.rewardClaimed) {
        return { ok: false, already: !!view.rewardClaimed, xp: 0 };
      }
      this.state.rewardClaimed = true;
      StorageService.saveDailyChallenge(this.state);
      PlayerDataService.addDailyCompleted();
      const xpResult = PlayerDataService.addXP(view.xp);
      if (global.SyncService && SyncService.isOnline()) {
        SyncService.claimDaily();
      }
      AnalyticsService.track('daily_complete');
      return { ok: true, xp: view.xp, xpResult: xpResult };
    },

    resetToday: function () {
      if (!global.DEBUG) return this.view();
      const today = PlayerDataService.todayKey();
      const def = pickForDate(today);
      this.def = def;
      this.state = emptyState(today, def);
      StorageService.saveDailyChallenge(this.state);
      return this.view();
    }
  };

  global.DAILY_CHALLENGE_POOL = POOL;
  global.DailyChallengeService = DailyChallengeService;
})(window);
