/**
 * Каталог достижений и AchievementService.
 * Проверка идёт по id, не по русскому названию.
 * Старые id сохранены, чтобы не потерять уже открытые награды.
 */
(function (global) {
  'use strict';

  const CATEGORIES = [
    { id: 'first', title: 'Первые шаги' },
    { id: 'mastery', title: 'Мастерство' },
    { id: 'reports', title: 'Отчётность' },
    { id: 'survival', title: 'Выживание' },
    { id: 'career', title: 'Карьера' },
    { id: 'progress', title: 'Документооборот' },
    { id: 'secret', title: 'Секреты' }
  ];

  const DEFINITIONS = [
    { id: 'firstDoc', title: 'Первый документ', description: 'Поймайте первый полезный объект', icon: '📄', category: 'first' },
    { id: 'firstHundred', title: 'Первая сотня', description: 'Наберите 100 очков за партию', icon: '💯', category: 'first' },
    { id: 'firstThousand', title: 'Первая тысяча', description: 'Наберите 1 000 очков за партию', icon: '🥇', category: 'first' },
    { id: 'firstBonus', title: 'Первый бонус', description: 'Поймайте первый бонус', icon: '🎁', category: 'first' },
    { id: 'firstPayment', title: 'Первая оплата', description: 'Поймайте первую оплату от клиента', icon: '💰', category: 'first' },

    { id: 'combo10', title: 'Всё сходится', description: 'Сделайте Combo ×10', icon: '🔥', category: 'mastery' },
    { id: 'ninjaCombo', title: 'Бухгалтер-ниндзя', description: 'Сделайте Combo ×20', icon: '🥷', category: 'mastery' },
    { id: 'combo30', title: 'Идеальная серия', description: 'Сделайте Combo ×30', icon: '✨', category: 'mastery' },
    { id: 'ironNerves', title: 'Железные нервы', description: 'Дойдите до режима главбуха без потери жизни', icon: '💪', category: 'mastery' },
    { id: 'noFines1000', title: 'Без единого штрафа', description: 'Наберите 1 000 очков без потери жизни', icon: '🛡️', category: 'mastery' },
    { id: 'glavbuh', title: 'Пять тысяч за смену', description: 'Наберите 5 000 очков за одну партию', icon: '🏆', category: 'mastery' },

    { id: 'monthClosed', title: 'Закрыли месяц', description: 'Успешно пройдите «Закрытие месяца»', icon: '📅', category: 'reports' },
    { id: 'quarterClosed', title: 'Закрыли квартал', description: 'Пройдите босс-раунд «Закрытие квартала»', icon: '📚', category: 'reports' },
    { id: 'deadlineDone', title: 'Отчёт принят', description: 'Успешно закройте «Дедлайн»', icon: '✅', category: 'reports' },
    { id: 'fnsReply', title: 'Ответ отправлен', description: 'Соберите пакет для требования ФНС', icon: '📨', category: 'reports' },

    { id: 'fnsEscaped', title: 'ФНС не догнала', description: 'Переживите событие ФНС без потери жизни', icon: '🕵️', category: 'survival' },
    { id: 'fridaySurvived', title: 'Пятница пережита', description: 'Пройдите событие «Пятница 17:55»', icon: '🕔', category: 'survival' },
    { id: 'update1cOk', title: '1С работает', description: 'Переживите событие «1С обновляется»', icon: '💻', category: 'survival' },
    { id: 'coffeeSaved', title: 'Кофе спас', description: 'Поймайте 3 бонуса кофе за одну игру', icon: '☕', category: 'survival' },

    { id: 'rankAccountant', title: 'Бухгалтер', description: 'Получите постоянное звание «Бухгалтер»', icon: '📘', category: 'career' },
    { id: 'rankGlavbuh', title: 'Главбух', description: 'Достигните уровня профиля Главбуха', icon: '🏅', category: 'career' },
    { id: 'rankNinja', title: 'Бухгалтер-ниндзя', description: 'Получите постоянное звание «Бухгалтер-ниндзя»', icon: '🥷', category: 'career' },
    { id: 'rankLegend', title: 'Легенда отчётности', description: 'Достигните самого высокого звания', icon: '🌟', category: 'career' },

    { id: 'docs100', title: 'Документооборот', description: 'Соберите 100 документов за всё время', icon: '📁', category: 'progress', target: 100, progressKey: 'totalDocuments' },
    { id: 'docs1000', title: 'Архив главбуха', description: 'Соберите 1 000 документов за всё время', icon: '🗄️', category: 'progress', target: 1000, progressKey: 'totalDocuments' },
    { id: 'games10', title: 'Рабочая неделя', description: 'Сыграйте 10 партий', icon: '🎮', category: 'progress', target: 10, progressKey: 'gamesPlayed' },

    { id: 'miracle1c', title: 'Чудо случилось', description: 'Пережить обновление 1С без потери жизни', icon: '🍀', category: 'secret', hidden: true },
    { id: 'clientOnTime', title: 'Клиент вовремя', description: 'Успешно пройти событие «Клиент прислал первичку»', icon: '📬', category: 'secret', hidden: true }
  ];

  const byId = {};
  DEFINITIONS.forEach(function (def) { byId[def.id] = def; });

  const AchievementService = {
    unlocked: {},
    justUnlocked: [],

    load: function () {
      this.unlocked = AchievementStorage.load() || {};
      this.justUnlocked = [];
      return this.unlocked;
    },

    save: function () {
      AchievementStorage.save(this.unlocked);
    },

    def: function (id) {
      return byId[id] || null;
    },

    count: function () {
      const self = this;
      return DEFINITIONS.reduce(function (n, def) {
        return n + (self.unlocked[def.id] ? 1 : 0);
      }, 0);
    },

    total: function () {
      return DEFINITIONS.length;
    },

    unlockAchievement: function (id) {
      if (!byId[id] || this.unlocked[id]) return false;
      this.unlocked[id] = { at: Date.now() };
      this.save();
      this.justUnlocked.push(id);
      if (global.PlayerDataService) {
        PlayerDataService.setAchievementsUnlocked(this.count());
      }
      return true;
    },

    unlock: function (id) {
      return this.unlockAchievement(id);
    },

    consumeJustUnlocked: function () {
      const ids = this.justUnlocked.slice();
      this.justUnlocked = [];
      const self = this;
      return ids.map(function (id) { return self.present(byId[id]); }).filter(Boolean);
    },

    getUnlocked: function () {
      const self = this;
      return DEFINITIONS.filter(function (d) { return !!self.unlocked[d.id]; }).map(function (d) {
        return self.present(d);
      });
    },

    getLocked: function () {
      const self = this;
      return DEFINITIONS.filter(function (d) { return !self.unlocked[d.id]; }).map(function (d) {
        return self.present(d);
      });
    },

    getProgress: function (id, stats) {
      const def = byId[id];
      if (!def || !def.target) return null;
      stats = stats || (PlayerDataService && PlayerDataService.getStats()) || {};
      const current = Math.min(def.target, Number(stats[def.progressKey]) || 0);
      return { current: current, target: def.target };
    },

    present: function (def) {
      if (!def) return null;
      const unlocked = !!this.unlocked[def.id];
      const hidden = !!(def.hidden && !unlocked);
      const rec = this.unlocked[def.id];
      const item = {
        id: def.id,
        title: hidden ? '???' : def.title,
        description: hidden ? 'Секретное достижение' : (def.description || def.hint || ''),
        hint: hidden ? 'Секретное достижение' : (def.description || def.hint || ''),
        icon: hidden ? '❓' : def.icon,
        category: def.category,
        hidden: !!def.hidden,
        unlocked: unlocked,
        unlockedAt: rec && rec.at ? rec.at : null,
        progress: this.getProgress(def.id)
      };
      return item;
    },

    list: function (filter) {
      const self = this;
      let items = DEFINITIONS.map(function (d) { return self.present(d); });
      if (filter === 'unlocked') items = items.filter(function (i) { return i.unlocked; });
      if (filter === 'locked') items = items.filter(function (i) { return !i.unlocked; });
      return items;
    },

    categories: function () {
      return CATEGORIES;
    },

    checkAchievements: function (ctx) {
      ctx = ctx || {};
      const stats = (PlayerDataService && PlayerDataService.getStats()) || {};
      const playerLevel = ctx.playerLevel || stats.playerLevel || 1;
      const docs = (Number(stats.totalDocuments) || 0);
      const games = (Number(stats.gamesPlayed) || 0);

      if ((ctx.documentsCaught || 0) >= 1 || docs >= 1) this.unlockAchievement('firstDoc');
      if ((ctx.score || 0) >= 100) this.unlockAchievement('firstHundred');
      if ((ctx.score || 0) >= 1000) this.unlockAchievement('firstThousand');
      if ((ctx.bonusesCaught || 0) >= 1 || (Number(stats.totalBonuses) || 0) >= 1) this.unlockAchievement('firstBonus');
      if ((ctx.paymentsCaught || 0) >= 1 || (Number(stats.totalPayments) || 0) >= 1) this.unlockAchievement('firstPayment');

      if ((ctx.combo || 0) >= 10 || (ctx.maxCombo || 0) >= 10) this.unlockAchievement('combo10');
      if ((ctx.combo || 0) >= 20 || (ctx.maxCombo || 0) >= 20) this.unlockAchievement('ninjaCombo');
      if ((ctx.combo || 0) >= 30 || (ctx.maxCombo || 0) >= 30) this.unlockAchievement('combo30');
      if ((ctx.level || 0) >= 8 && !ctx.lostLifeThisRun) this.unlockAchievement('ironNerves');
      if ((ctx.score || 0) >= 1000 && !ctx.lostLifeThisRun) this.unlockAchievement('noFines1000');
      if ((ctx.score || 0) >= 5000) this.unlockAchievement('glavbuh');

      if (ctx.monthClosed) this.unlockAchievement('monthClosed');
      if (ctx.quarterClosed) this.unlockAchievement('quarterClosed');
      if (ctx.deadlineDone) this.unlockAchievement('deadlineDone');
      if (ctx.fnsReply) this.unlockAchievement('fnsReply');

      if (ctx.survivedFnsEvent) this.unlockAchievement('fnsEscaped');
      if (ctx.fridaySurvived) this.unlockAchievement('fridaySurvived');
      if (ctx.update1cOk) this.unlockAchievement('update1cOk');
      if ((ctx.coffeeCaught || 0) >= 3) this.unlockAchievement('coffeeSaved');

      if (playerLevel >= 5) this.unlockAchievement('rankAccountant');
      if (playerLevel >= 20) this.unlockAchievement('rankGlavbuh');
      if (playerLevel >= 30) this.unlockAchievement('rankNinja');
      if (playerLevel >= 50) this.unlockAchievement('rankLegend');

      if (docs >= 100) this.unlockAchievement('docs100');
      if (docs >= 1000) this.unlockAchievement('docs1000');
      if (games >= 10) this.unlockAchievement('games10');

      if (ctx.miracle1c) this.unlockAchievement('miracle1c');
      if (ctx.clientOnTime) this.unlockAchievement('clientOnTime');
    },

    evaluateLive: function (stats) {
      this.checkAchievements(stats);
    },

    evaluateRun: function (stats) {
      this.checkAchievements(stats);
    }
  };

  const AchievementManager = AchievementService;

  global.ACHIEVEMENT_DEFS = DEFINITIONS;
  global.ACHIEVEMENT_CATEGORIES = CATEGORIES;
  global.AchievementService = AchievementService;
  global.AchievementManager = AchievementManager;
})(window);
