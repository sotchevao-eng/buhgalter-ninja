/**
 * Экраны и оверлеи. Не содержит игровой логики.
 * Имена и launch-параметры выводятся только через textContent.
 */
(function (global) {
  'use strict';

  function daysWord(n) {
    const abs = Math.abs(Number(n) || 0) % 100;
    const d = abs % 10;
    if (abs >= 11 && abs <= 14) return 'дней';
    if (d === 1) return 'день';
    if (d >= 2 && d <= 4) return 'дня';
    return 'дней';
  }

  const UI = {
    game: null,
    toastTimer: 0,
    lastShare: null,
    lastCardDataUrl: '',
    achFilter: 'all',
    currentReward: null,
    dailyHudLast: '',

    init: function (game) {
      this.game = game;
      this.els = {
        loading: document.getElementById('screen-loading'),
        menu: document.getElementById('screen-menu'),
        howto: document.getElementById('screen-howto'),
        records: document.getElementById('screen-records'),
        leaderboard: document.getElementById('screen-leaderboard'),
        achievements: document.getElementById('screen-achievements'),
        tutorial: document.getElementById('screen-tutorial'),
        about: document.getElementById('screen-about'),
        profile: document.getElementById('screen-profile'),
        play: document.getElementById('screen-play'),
        pause: document.getElementById('overlay-pause'),
        gameover: document.getElementById('overlay-gameover'),
        reward: document.getElementById('overlay-reward'),
        merge: document.getElementById('overlay-merge'),
        confirm: document.getElementById('overlay-confirm'),
        tutorialDone: document.getElementById('overlay-tutorial-done'),
        tutorialHint: document.getElementById('tutorial-hint'),
        tutorialHintTitle: document.getElementById('tutorial-hint-title'),
        tutorialHintSub: document.getElementById('tutorial-hint-sub'),
        loaderFill: document.getElementById('loader-fill'),
        loaderText: document.getElementById('loader-text'),
        greeting: document.getElementById('menu-greeting'),
        menuProfile: document.getElementById('menu-profile'),
        avatar: document.getElementById('menu-avatar'),
        hello: document.getElementById('menu-hello'),
        helloSub: document.getElementById('menu-hello-sub'),
        soundBtn: document.getElementById('btn-sound'),
        hudScore: document.getElementById('hud-score'),
        hudLives: document.getElementById('hud-lives'),
        hudLevel: document.getElementById('hud-level'),
        hudCombo: document.getElementById('hud-combo'),
        hudRecord: document.getElementById('hud-record'),
        hudXp: document.getElementById('hud-xp'),
        hudEffects: document.getElementById('hud-effects'),
        hudDaily: document.getElementById('hud-daily'),
        toast: document.getElementById('toast'),
        achPop: document.getElementById('ach-pop'),
        achPopTitle: document.getElementById('ach-pop-title'),
        achPopHint: document.getElementById('ach-pop-hint'),
        achCount: document.getElementById('ach-count'),
        goStats: document.getElementById('go-stats'),
        goRecord: document.getElementById('go-record'),
        goInvite: document.getElementById('go-invite'),
        goRank: document.getElementById('go-rank'),
        goXp: document.getElementById('go-xp'),
        goXpFill: document.getElementById('go-xp-fill'),
        goXpLabel: document.getElementById('go-xp-label'),
        goDaily: document.getElementById('go-daily'),
        goScore: document.getElementById('go-score'),
        goBest: document.getElementById('go-best'),
        goDetailsBtn: document.getElementById('go-details-btn'),
        rcScore: document.getElementById('rc-score'),
        rcRank: document.getElementById('rc-rank'),
        rcCombo: document.getElementById('rc-combo'),
        rcLevel: document.getElementById('rc-level'),
        recordsBody: document.getElementById('records-body'),
        leaderboardBody: document.getElementById('leaderboard-body'),
        leaderboardStatus: document.getElementById('leaderboard-status'),
        leaderboardMe: document.getElementById('leaderboard-me'),
        achievementsBody: document.getElementById('achievements-body'),
        profileBody: document.getElementById('profile-body'),
        aboutVersion: document.getElementById('about-version'),
        debugPanel: document.getElementById('debug-panel'),
        communityName: document.querySelectorAll('[data-community-name]')
      };

      this.els.communityName.forEach(function (node) {
        node.textContent = APP_CONFIG.communityName;
      });
      if (this.els.aboutVersion) {
        this.els.aboutVersion.textContent = 'Версия ' + (global.APP_VERSION || '0.9.0');
      }

      this.bindClicks();
      this.updateSoundButton();
      this.setupDebug();
    },

    bindClicks: function () {
      const self = this;
      document.body.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        e.preventDefault();
        self.handleAction(btn.getAttribute('data-action'), btn);
      });
    },

    handleAction: function (action, btn) {
      AudioManager.unlock();
      if (action !== 'pause') AudioManager.play('ui_click');
      const game = this.game;
      switch (action) {
        case 'start':
          game.requestStart();
          break;
        case 'howto':
          this.show('howto');
          break;
        case 'records':
          this.renderRecords();
          this.show('records');
          break;
        case 'leaderboard':
          AnalyticsService.track('leaderboard_open');
          this.renderLeaderboard();
          this.show('leaderboard');
          break;
        case 'board-period':
          LeaderboardService.setPeriod((btn && btn.getAttribute('data-period')) || 'all');
          this.renderLeaderboard();
          break;
        case 'merge-yes':
          this.confirmMerge();
          break;
        case 'merge-later':
          this.skipMerge();
          break;
        case 'achievements':
          this.renderAchievements();
          this.show('achievements');
          break;
        case 'profile':
          this.renderPlayerProfile();
          this.show('profile');
          break;
        case 'about':
          this.show('about');
          break;
        case 'menu':
          if (game.state === 'paused') {
            this.askConfirm('menu');
            break;
          }
          game.backToMenu();
          break;
        case 'sound':
          AudioManager.toggle();
          this.updateSoundButton();
          break;
        case 'tutorial-done':
          game.finishTutorial();
          break;
        case 'replay-tutorial':
          game.replayTutorial();
          break;
        case 'resume':
          game.resumeGame();
          break;
        case 'restart':
          if (game.state === 'paused') {
            this.askConfirm('restart');
            break;
          }
          RewardQueue.clear();
          game.restartGame();
          break;
        case 'confirm-yes':
          this.resolveConfirm(true);
          break;
        case 'confirm-no':
          this.resolveConfirm(false);
          break;
        case 'go-details':
          this.toggleGoDetails();
          break;
        case 'pause':
          if (game.state === 'playing') game.pauseGame('manual');
          break;
        case 'share':
          this.share();
          break;
        case 'invite':
          this.invite();
          break;
        case 'community':
          VKService.openCommunity();
          break;
        case 'claim-reward':
          this.claimCurrentReward();
          break;
        case 'ach-filter':
          this.achFilter = (btn && btn.getAttribute('data-filter')) || 'all';
          this.renderAchievements();
          break;
        case 'debug-xp':
          if (!global.DEBUG) break;
          PlayerDataService.addXP(1000);
          this.renderProfile();
          this.updateDebug();
          this.toast('+1000 XP');
          break;
        case 'debug-daily':
          if (!global.DEBUG) break;
          DailyChallengeService.completeChallenge();
          this.renderDailyCard();
          this.toast('Задание отмечено выполненным');
          break;
        case 'debug-ach':
          if (!global.DEBUG) break;
          AchievementService.unlockAchievement('firstDoc');
          this.toast('Тестовое достижение');
          break;
        case 'debug-reset-daily':
          if (!global.DEBUG) break;
          DailyChallengeService.resetToday();
          this.renderDailyCard();
          this.toast('Задание дня сброшено');
          break;
        case 'debug-date':
          if (!global.DEBUG) break;
          this.toast('Дата: ' + PlayerDataService.advanceDebugDate());
          DailyChallengeService.getTodayChallenge();
          this.renderDailyCard();
          this.renderProfile();
          this.updateDebug();
          break;
        default:
          break;
      }
    },

    hideAll: function () {
      ['loading', 'menu', 'howto', 'records', 'leaderboard', 'achievements', 'tutorial', 'about', 'profile', 'play'].forEach(function (name) {
        const el = UI.els[name];
        if (el) el.classList.remove('is-active');
      });
      if (this.els.pause) this.els.pause.classList.remove('is-active');
      if (this.els.gameover) this.els.gameover.classList.remove('is-active');
      this.hideConfirm();
      this.hideTutorialDone();
      if (this.els.reward) this.els.reward.classList.remove('is-active');
      if (this.els.merge) this.els.merge.classList.remove('is-active');
    },

    show: function (name) {
      this.hideAll();
      const el = this.els[name];
      if (el) el.classList.add('is-active');
      document.body.classList.toggle('is-playing', name === 'play');
    },

    setLoading: function (percent) {
      const p = Math.max(0, Math.min(100, Math.round(percent)));
      this.els.loaderFill.style.width = p + '%';
      this.els.loaderText.textContent = 'Загружаем первичку... ' + p + '%';
    },

    runLoading: function (done) {
      const self = this;
      this.show('loading');
      let p = 0;
      const timer = setInterval(function () {
        p += 7 + Math.random() * 14;
        if (p >= 100) {
          p = 100;
          clearInterval(timer);
          self.setLoading(100);
          setTimeout(done, 220);
        } else {
          self.setLoading(p);
        }
      }, 70);
    },

    displayName: function () {
      const profile = (VKService && VKService.getPlayerProfile()) || global.playerProfile || {};
      const name = String(profile.firstName || '').trim();
      return name || 'Бухгалтер-ниндзя';
    },

    renderProfile: function () {
      const profile = (VKService && VKService.getPlayerProfile()) || global.playerProfile || {};
      const name = String(profile.firstName || '').trim();
      const hasAvatar = !!(profile.avatar && this.els.avatar);
      const career = PlayerDataService.getRank();
      const level = PlayerDataService.getLevel();

      if (this.els.menuProfile) this.els.menuProfile.hidden = false;
      if (this.els.avatar) {
        if (hasAvatar) {
          this.els.avatar.src = profile.avatar;
          this.els.avatar.hidden = false;
          this.els.avatar.alt = '';
        } else {
          this.els.avatar.removeAttribute('src');
          this.els.avatar.hidden = true;
        }
      }
      if (this.els.hello) this.els.hello.textContent = name ? name : 'Гость';
      if (this.els.helloSub) {
        this.els.helloSub.textContent = (career.icon || '') + ' ' + career.title + ' · Уровень ' + level;
      }
      if (this.els.greeting) {
        this.els.greeting.hidden = false;
        this.els.greeting.textContent = name
          ? (name + ', готовы спасать отчётность?')
          : 'Готовы спасать отчётность?';
      }
      this.updateDebug();
    },

    setGreeting: function () {
      this.renderProfile();
    },

    renderDailyCard: function () {
      const card = document.getElementById('menu-daily');
      if (!card) return;
      const daily = DailyChallengeService.getTodayChallenge();
      const title = document.getElementById('menu-daily-title');
      const progress = document.getElementById('menu-daily-progress');
      const bar = document.getElementById('menu-daily-bar');
      const reward = document.getElementById('menu-daily-reward');
      const streak = document.getElementById('menu-streak');
      if (title) title.textContent = daily.description;
      if (daily.completed) {
        if (progress) progress.textContent = '✅ ЗАДАНИЕ ВЫПОЛНЕНО';
        if (bar) bar.style.width = '100%';
        card.classList.add('is-done');
      } else {
        if (progress) progress.textContent = daily.progress + ' / ' + daily.target;
        if (bar) bar.style.width = Math.round((daily.progress / daily.target) * 100) + '%';
        card.classList.remove('is-done');
      }
      if (reward) {
        if (daily.rewardClaimed) reward.textContent = 'Награда уже получена';
        else if (daily.completed) reward.textContent = 'Готово! Заберите награду после игры';
        else reward.textContent = 'Награда: ' + daily.xp + ' XP';
      }
      if (streak) {
        const stats = PlayerDataService.getStats();
        const n = Number(stats.currentStreak) || 0;
        streak.textContent = n > 0 ? ('🔥 ' + n + ' ' + daysWord(n)) : '';
        streak.hidden = n < 1;
      }
    },

    updateDailyHud: function () {
      const el = this.els.hudDaily || document.getElementById('hud-daily');
      if (!el) return;
      const daily = DailyChallengeService.view();
      const text = daily.completed ? '✅ Готово' : ('🎯 ' + daily.progress + '/' + daily.target);
      el.textContent = text;
      el.hidden = false;
      if (this.dailyHudLast && this.dailyHudLast !== text) {
        el.classList.add('is-flash');
        setTimeout(function () { el.classList.remove('is-flash'); }, 420);
      }
      this.dailyHudLast = text;
    },

    renderPlayerProfile: function () {
      const body = this.els.profileBody;
      if (!body) return;
      body.textContent = '';
      const vk = (VKService && VKService.getPlayerProfile()) || {};
      const stats = PlayerDataService.getStats();
      const career = PlayerDataService.getRank();
      const need = PlayerDataService.nextLevelXP();
      const xp = PlayerDataService.getXP();

      const head = document.createElement('div');
      head.className = 'profile-head';
      if (vk.avatar) {
        const img = document.createElement('img');
        img.className = 'menu-avatar profile-avatar';
        img.width = 64;
        img.height = 64;
        img.alt = '';
        img.src = vk.avatar;
        head.appendChild(img);
      }
      const name = document.createElement('p');
      name.className = 'profile-name';
      name.textContent = this.displayName();
      const rank = document.createElement('p');
      rank.className = 'rank-title';
      rank.textContent = (career.icon || '') + ' ' + career.title;
      head.appendChild(name);
      head.appendChild(rank);
      body.appendChild(head);

      this.appendBlock(body, 'Уровень игрока ' + stats.playerLevel);
      const xpLine = document.createElement('p');
      xpLine.className = 'xp-caption';
      xpLine.textContent = xp.toLocaleString('ru-RU') + ' / ' + need.toLocaleString('ru-RU') + ' XP';
      body.appendChild(xpLine);
      body.appendChild(this.makeBar(xp / need));

      this.appendRow(body, '🏆 Рекорд', Number(stats.highScore).toLocaleString('ru-RU'));
      this.appendRow(body, '🔥 Лучший Combo', '×' + stats.bestCombo);
      this.appendRow(body, '🎮 Сыграно игр', String(stats.gamesPlayed));
      this.appendRow(body, '📄 Собрано документов', Number(stats.totalDocuments).toLocaleString('ru-RU'));
      this.appendRow(body, '🏅 Достижения', AchievementService.count() + ' / ' + AchievementService.total());
      this.appendRow(body, '🔥 Текущая серия', (stats.currentStreak || 0) + ' дн.');
      this.appendRow(body, '🏆 Лучшая серия', (stats.bestStreak || 0) + ' дн.');

      const cloud = document.createElement('p');
      cloud.className = 'cloud-status';
      if (global.SyncService && SyncService.isOnline()) {
        cloud.textContent = '☁ Синхронизация доступна';
      } else if (APP_CONFIG.apiBaseUrl) {
        cloud.textContent = '☁ Играем локально';
      } else {
        cloud.textContent = '☁ Играем локально';
      }
      body.appendChild(cloud);

      const careerTitle = document.createElement('h3');
      careerTitle.textContent = 'Карьера';
      body.appendChild(careerTitle);
      this.appendRow(body, 'Всего очков', Number(stats.totalScore).toLocaleString('ru-RU'));
      this.appendRow(body, 'Получено оплат', String(stats.totalPayments || 0));
      this.appendRow(body, 'Штрафов поймано', String(stats.totalPenalties || 0));
      this.appendRow(body, 'Выполнено заданий', String(stats.dailyChallengesCompleted || 0));
    },

    makeBar: function (ratio) {
      const wrap = document.createElement('div');
      wrap.className = 'xp-bar';
      const fill = document.createElement('div');
      fill.className = 'xp-bar-fill';
      fill.style.width = Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%';
      wrap.appendChild(fill);
      return wrap;
    },

    appendBlock: function (root, text) {
      const p = document.createElement('p');
      p.className = 'profile-level';
      p.textContent = text;
      root.appendChild(p);
    },

    setupDebug: function () {
      if (!this.els.debugPanel) return;
      this.els.debugPanel.hidden = !global.DEBUG;
      const tools = document.getElementById('debug-tools');
      if (tools) tools.hidden = !global.DEBUG;
      this.updateDebug();
    },

    updateDebug: function (fps) {
      if (!global.DEBUG || !this.els.debugPanel) return;
      const env = global.appEnvironment || {};
      const profile = global.playerProfile || {};
      const stats = PlayerDataService.getStats();
      const daily = DailyChallengeService.view();
      const set = function (id, text) {
        const node = document.getElementById(id);
        if (node) node.textContent = text;
      };
      set('dbg-env', env.mode === 'vk' ? 'VK' : 'browser');
      set('dbg-plat', env.platform || '—');
      set('dbg-user', profile.source === 'vk' && profile.firstName ? 'loaded' : (profile.source === 'mock' ? 'mock' : 'guest'));
      if (fps != null) set('dbg-fps', String(fps));
      set('dbg-plevel', String(stats.playerLevel || 1));
      set('dbg-xp', String(stats.playerXP || 0));
      set('dbg-daily', daily.id + ' ' + daily.progress + '/' + daily.target);
      set('dbg-streak', String(stats.currentStreak || 0));
      set('dbg-storage', String(StorageService.getStorageVersion()));
      set('dbg-api', (global.SyncService && SyncService.mode) || (APP_CONFIG.apiBaseUrl ? 'offline' : 'local'));
    },

    updateSoundButton: function () {
      const on = AudioManager.enabled;
      const label = on ? '🔊 Звук вкл' : '🔇 Звук выкл';
      if (this.els.soundBtn) this.els.soundBtn.textContent = label;
      const hudSound = document.getElementById('hud-sound');
      if (hudSound) hudSound.textContent = on ? '🔊' : '🔇';
      const pauseSound = document.getElementById('pause-sound');
      if (pauseSound) pauseSound.textContent = label;
    },

    updateHud: function (data) {
      this.els.hudScore.textContent = Number(data.score).toLocaleString('ru-RU');
      this.els.hudLevel.textContent = String(data.level);
      this.els.hudCombo.textContent = '×' + data.combo;
      this.els.hudRecord.textContent = Number(data.record).toLocaleString('ru-RU');
      this.els.hudLives.textContent = String(data.lives);
      this.els.hudCombo.classList.toggle('is-fire', !!data.ninja);
      if (this.els.hudXp) this.els.hudXp.style.width = Math.round((data.xp || 0) * 100) + '%';
      document.getElementById('screen-play').classList.toggle('ninja-mode', !!data.ninja);

      const chips = [];
      if (data.ninja) chips.push('НИНДЗЯ-РЕЖИМ');
      if (data.coffee) chips.push('Кофе');
      if (data.slow) chips.push('1С думает...');
      if (data.delay) chips.push('Отсрочка');
      this.els.hudEffects.textContent = '';
      chips.forEach(function (label) {
        const span = document.createElement('span');
        span.className = 'chip';
        span.textContent = label;
        UI.els.hudEffects.appendChild(span);
      });
    },

    showPause: function () {
      this.els.gameover.classList.remove('is-active');
      this.hideConfirm();
      this.updateSoundButton();
      this.els.pause.classList.add('is-active');
    },

    hidePause: function () {
      this.els.pause.classList.remove('is-active');
    },

    showGameOver: function (stats, isNewRecord) {
      this.els.pause.classList.remove('is-active');
      this.hideConfirm();
      this.els.goRecord.hidden = !isNewRecord;
      const rank = stats.rank || PlayerDataService.getRank();
      const best = PlayerDataService.getStats().highScore || stats.score || 0;
      if (this.els.goScore) this.els.goScore.textContent = Number(stats.score || 0).toLocaleString('ru-RU');
      if (this.els.goBest) this.els.goBest.textContent = 'Рекорд: ' + Number(best).toLocaleString('ru-RU');
      if (this.els.goRank) this.els.goRank.textContent = (rank.icon || '🥷') + ' ' + rank.title;
      if (this.els.rcScore) this.els.rcScore.textContent = Number(stats.score || 0).toLocaleString('ru-RU') + ' ОЧКОВ';
      this.els.rcRank.textContent = (rank.icon || '') + ' ' + rank.title;
      this.els.rcCombo.textContent = 'COMBO ×' + stats.maxCombo;
      this.els.rcLevel.textContent = 'Уровень ' + stats.level;
      const foot = document.querySelector('#result-card .rc-foot');
      if (foot) foot.textContent = '«' + ((APP_CONFIG && APP_CONFIG.communityName) || 'Налоговая не страшна') + '»';
      this.lastShare = {
        score: stats.score,
        rank: rank,
        combo: stats.maxCombo,
        level: stats.level,
        isNewRecord: !!isNewRecord
      };
      this.els.goStats.textContent = '';
      this.els.goStats.hidden = true;
      if (this.els.goDetailsBtn) this.els.goDetailsBtn.textContent = 'Подробнее';
      this.appendStat(this.els.goStats, 'Документов собрано', String(stats.documentsCaught || stats.documentsCollected || 0));
      this.appendStat(this.els.goStats, 'Оплат получено', String(stats.paymentsCaught || 0));
      this.appendStat(this.els.goStats, 'Лучшее Combo', '×' + stats.maxCombo);
      this.appendStat(this.els.goStats, 'Игровой уровень', stats.level + ' · ' + getLevelName(stats.level));
      if (stats.xpGained != null) this.appendStat(this.els.goStats, 'Опыт', '+' + stats.xpGained + ' XP');
      if (stats.unlocked && stats.unlocked.length) {
        this.appendStat(this.els.goStats, 'Достижение', stats.unlocked[0].title);
      }
      if (this.els.goInvite) this.els.goInvite.hidden = stats.score < 400 && !isNewRecord;
      this.renderGoProgress(stats);
      this.paintResultCard(stats, rank, isNewRecord);
      this.els.gameover.classList.add('is-active');
    },

    renderGoProgress: function (stats) {
      const xp = stats.xpResult || {};
      if (this.els.goXpLabel) {
        this.els.goXpLabel.textContent = 'Уровень профиля ' + (xp.toLevel || PlayerDataService.getLevel()) +
          ' · ' + (xp.playerXP || 0) + ' / ' + (xp.nextLevelXP || PlayerDataService.nextLevelXP()) + ' XP';
      }
      if (this.els.goXpFill) {
        this.els.goXpFill.style.width = '0%';
        const ratio = (xp.playerXP || 0) / (xp.nextLevelXP || 1);
        const fill = this.els.goXpFill;
        requestAnimationFrame(function () {
          fill.style.width = Math.round(Math.max(0.04, Math.min(1, ratio)) * 100) + '%';
        });
      }
      if (this.els.goDaily && stats.daily) {
        if (stats.daily.completed) this.els.goDaily.textContent = '✅ ЗАДАНИЕ ВЫПОЛНЕНО';
        else this.els.goDaily.textContent = '🎯 Задание дня ' + stats.daily.progress + ' / ' + stats.daily.target;
      }
    },

    showReward: function (item) {
      this.currentReward = item;
      const overlay = this.els.reward;
      if (!overlay) {
        RewardQueue.showNextReward();
        return;
      }
      document.getElementById('reward-title').textContent = item.title || '';
      document.getElementById('reward-sub').textContent = item.subtitle || '';
      document.getElementById('reward-extra').textContent = item.extra || '';
      const btn = document.getElementById('reward-action');
      if (btn) btn.textContent = item.actionLabel || 'Отлично';
      overlay.classList.add('is-active');
    },

    claimCurrentReward: function () {
      if (this._claimLock) return;
      const item = this.currentReward;
      if (!item) return;
      this._claimLock = true;
      if (item.daily) {
        const res = DailyChallengeService.claimReward();
        if (res && res.ok) {
          this.toast('+' + res.xp + ' XP');
          this.renderDailyCard();
          this.renderProfile();
        } else if (res && res.already) {
          this.toast('Награда уже получена');
        }
      }
      this.currentReward = null;
      if (this.els.reward) this.els.reward.classList.remove('is-active');
      const self = this;
      setTimeout(function () {
        self._claimLock = false;
        RewardQueue.showNextReward();
      }, 280);
    },

    appendStat: function (root, label, value) {
      const row = document.createElement('div');
      row.appendChild(document.createTextNode(label + ': '));
      const strong = document.createElement('strong');
      strong.textContent = value;
      row.appendChild(strong);
      root.appendChild(row);
    },

    hideGameOver: function () {
      this.els.gameover.classList.remove('is-active');
      if (this.els.reward) this.els.reward.classList.remove('is-active');
    },

    hideConfirm: function () {
      if (this.els.confirm) this.els.confirm.classList.remove('is-active');
      this.pendingConfirm = null;
    },

    askConfirm: function (kind) {
      this.pendingConfirm = kind;
      const title = document.getElementById('confirm-title');
      const text = document.getElementById('confirm-text');
      if (kind === 'menu') {
        if (title) title.textContent = 'В главное меню?';
        if (text) text.textContent = 'Текущий забег будет потерян.';
      } else {
        if (title) title.textContent = 'Начать заново?';
        if (text) text.textContent = 'Текущий забег будет потерян.';
      }
      if (this.els.confirm) this.els.confirm.classList.add('is-active');
    },

    resolveConfirm: function (yes) {
      const kind = this.pendingConfirm;
      this.hideConfirm();
      if (!yes) return;
      if (kind === 'restart') {
        RewardQueue.clear();
        this.game.restartGame();
      } else if (kind === 'menu') {
        this.game.backToMenu();
      }
    },

    showTutorialHint: function (title, sub) {
      if (!this.els.tutorialHint) return;
      if (this.els.tutorialHintTitle) this.els.tutorialHintTitle.textContent = title || '';
      if (this.els.tutorialHintSub) this.els.tutorialHintSub.textContent = sub || '';
      this.els.tutorialHint.hidden = false;
    },

    hideTutorialHint: function () {
      if (this.els.tutorialHint) this.els.tutorialHint.hidden = true;
    },

    showTutorialDone: function () {
      this.hideTutorialHint();
      if (this.els.tutorialDone) this.els.tutorialDone.classList.add('is-active');
    },

    hideTutorialDone: function () {
      if (this.els.tutorialDone) this.els.tutorialDone.classList.remove('is-active');
    },

    toggleGoDetails: function () {
      if (!this.els.goStats) return;
      const open = this.els.goStats.hidden;
      this.els.goStats.hidden = !open;
      if (this.els.goDetailsBtn) this.els.goDetailsBtn.textContent = open ? 'Скрыть' : 'Подробнее';
    },

    updatePlaytestLog: function (log) {
      const node = document.getElementById('dbg-last');
      if (!node || !log) return;
      node.textContent = log.score + ' · L' + log.level + ' · ×' + log.maxCombo + ' · ' + log.playTime + 'с';
    },

    renderRecords: function () {
      const stats = PlayerDataService.getStats();
      const body = this.els.recordsBody;
      if (!body) return;
      body.textContent = '';
      this.appendRow(body, '🏆 Лучший результат', Number(stats.highScore).toLocaleString('ru-RU'));
      this.appendRow(body, '🔥 Лучший Combo', '×' + stats.bestCombo);
      this.appendRow(body, '📈 Максимальный игровой уровень', String(stats.maxLevel));
      this.appendRow(body, '⚡ Самая длинная серия', (stats.bestStreak || 0) + ' дн.');
      this.appendRow(body, '🎮 Всего игр', String(stats.gamesPlayed));
    },

    renderLeaderboard: function () {
      const body = this.els.leaderboardBody || this.els.recordsBody;
      if (!body) return;
      body.textContent = '';
      const period = LeaderboardService.period || 'all';
      document.querySelectorAll('[data-action="board-period"]').forEach(function (btn) {
        btn.classList.toggle('is-on', btn.getAttribute('data-period') === period);
      });
      if (this.els.leaderboardStatus) this.els.leaderboardStatus.textContent = 'Загружаем рейтинг...';
      if (this.els.leaderboardMe) this.els.leaderboardMe.textContent = '';
      const self = this;
      LeaderboardService.getLeaderboard(period).then(function (board) {
        body.textContent = '';
        const rows = board.rows || [];
        if (self.els.leaderboardStatus) {
          if (board.stale) {
            self.els.leaderboardStatus.textContent = board.notice || 'Показана сохранённая таблица.';
          } else if (board.mode === 'local') {
            self.els.leaderboardStatus.textContent = board.notice || 'Личный локальный рекорд.';
          } else if (!rows.length) {
            self.els.leaderboardStatus.textContent = 'Пока никто не попал в рейтинг за этот период. Играть всё равно можно.';
          } else {
            self.els.leaderboardStatus.textContent = 'Часовой пояс: Europe/Moscow. Ничья: выше Combo, затем кто раньше.';
          }
        }
        if (self.els.leaderboardMe) {
          if (board.me && board.me.position) {
            self.els.leaderboardMe.textContent = 'Ваше место: #' + board.me.position +
              ' · ' + Number(board.me.score || 0).toLocaleString('ru-RU') + ' очков';
          } else if (board.mode === 'online') {
            self.els.leaderboardMe.textContent = 'Вас ещё нет в общем рейтинге за этот период.';
          } else {
            const personal = board.personal || GameStorage.getRecords();
            self.els.leaderboardMe.textContent = 'Личный локальный рекорд: ' +
              Number(personal.highScore || 0).toLocaleString('ru-RU') + ' очков';
          }
        }
        rows.forEach(function (row) {
          const item = document.createElement('div');
          item.className = 'board-row' + (row.isMe ? ' is-me' : '');
          const pos = document.createElement('span');
          const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
          pos.className = 'board-pos' + (medals[row.position] ? ' is-medal' : '');
          pos.textContent = medals[row.position] || String(row.position);
          const who = document.createElement('div');
          who.className = 'board-who';
          if (row.avatarUrl) {
            const img = document.createElement('img');
            img.className = 'board-avatar';
            img.width = 28;
            img.height = 28;
            img.alt = '';
            img.src = row.avatarUrl;
            who.appendChild(img);
          }
          const name = document.createElement('span');
          name.className = 'board-name';
          name.textContent = row.displayName || 'Игрок';
          who.appendChild(name);
          const score = document.createElement('strong');
          score.className = 'board-score';
          score.textContent = Number(row.score || 0).toLocaleString('ru-RU');
          item.appendChild(pos);
          item.appendChild(who);
          item.appendChild(score);
          body.appendChild(item);
        });
        if (!rows.length && board.mode === 'local') {
          const personal = board.personal || GameStorage.getRecords();
          self.appendRow(body, 'Ваш лучший результат', Number(personal.highScore || 0).toLocaleString('ru-RU') + ' очков');
          self.appendRow(body, 'Лучший Combo', '×' + (personal.maxCombo || 0));
        }
      }).catch(function () {
        if (self.els.leaderboardStatus) {
          self.els.leaderboardStatus.textContent = 'Рейтинг временно недоступен. Играть всё равно можно.';
        }
      });
    },

    maybeShowMerge: function () {
      if (!this.els.merge) return;
      if (global.SyncService && SyncService.mergeNeeded) {
        this.els.merge.classList.add('is-active');
      }
    },

    confirmMerge: function () {
      const self = this;
      if (!global.SyncService) return;
      SyncService.migrateLocal().then(function () {
        if (self.els.merge) self.els.merge.classList.remove('is-active');
        self.renderProfile();
        self.toast('Прогресс перенесён');
      }).catch(function (err) {
        self.toast((err && err.friendly) || 'Не удалось перенести прогресс');
      });
    },

    skipMerge: function () {
      if (global.SyncService) SyncService.skipMerge();
      if (this.els.merge) this.els.merge.classList.remove('is-active');
    },

    appendRow: function (root, label, value) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      row.appendChild(span);
      row.appendChild(strong);
      root.appendChild(row);
    },

    renderAchievements: function () {
      const items = AchievementService.list(this.achFilter);
      this.els.achCount.textContent = 'Получено: ' + AchievementService.count() + ' / ' + AchievementService.total();
      const body = this.els.achievementsBody;
      body.textContent = '';

      document.querySelectorAll('[data-action="ach-filter"]').forEach(function (btn) {
        btn.classList.toggle('is-on', btn.getAttribute('data-filter') === UI.achFilter);
      });

      const cats = AchievementService.categories();
      cats.forEach(function (cat) {
        const group = items.filter(function (i) { return i.category === cat.id; });
        if (!group.length) return;
        const h = document.createElement('h3');
        h.className = 'ach-cat';
        h.textContent = cat.title;
        body.appendChild(h);
        group.forEach(function (item) {
          const wrap = document.createElement('div');
          wrap.className = 'ach ' + (item.unlocked ? 'is-on' : 'is-off');
          const ico = document.createElement('div');
          ico.className = 'ach-ico';
          ico.textContent = (item.unlocked ? '✅ ' : '🔒 ') + item.icon;
          const info = document.createElement('div');
          const title = document.createElement('div');
          title.className = 'ach-title';
          title.textContent = item.title;
          const hint = document.createElement('div');
          hint.className = 'ach-hint';
          hint.textContent = item.description || item.hint;
          info.appendChild(title);
          info.appendChild(hint);
          if (item.progress && !item.unlocked) {
            const prog = document.createElement('div');
            prog.className = 'ach-progress';
            prog.textContent = item.progress.current + ' / ' + item.progress.target;
            info.appendChild(prog);
            info.appendChild(UI.makeBar(item.progress.current / item.progress.target));
          }
          wrap.appendChild(ico);
          wrap.appendChild(info);
          body.appendChild(wrap);
        });
      });
    },

    showAchievement: function (def) {
      if (!def || !this.els.achPop) return;
      this.els.achPopTitle.textContent = def.title;
      this.els.achPopHint.textContent = def.hint || def.description || '';
      this.els.achPop.classList.add('is-active');
      const el = this.els.achPop;
      clearTimeout(this.achTimer);
      this.achTimer = setTimeout(function () {
        el.classList.remove('is-active');
      }, 2800);
    },

    paintResultCard: function (stats, rank, isNewRecord) {
      const self = this;
      if (typeof generateResultCard !== 'function') return;
      generateResultCard({
        score: stats.score,
        level: stats.level,
        combo: stats.maxCombo,
        rank: rank,
        isNewRecord: !!isNewRecord
      }).then(function (card) {
        self.lastCardDataUrl = card && card.dataURL ? card.dataURL : '';
      });
    },

    toast: function (text) {
      const el = this.els.toast;
      el.textContent = String(text || '');
      el.classList.add('is-active');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(function () {
        el.classList.remove('is-active');
      }, 2200);
    },

    share: function () {
      const pack = this.lastShare || {
        score: this.game.lastScore || 0,
        rank: PlayerDataService.getRank(),
        combo: this.game.maxCombo || 0,
        level: this.game.level || 1
      };
      const self = this;
      shareGameResult(pack).then(function (res) {
        if (res && res.copied) self.toast('Результат скопирован!');
        else if (res && res.shared) self.toast('Готово!');
        else if (res && res.text) self.toast('Скопируйте результат вручную');
      });
    },

    invite: function () {
      const self = this;
      VKService.inviteFriends().then(function (res) {
        if (res && res.copied) self.toast('Текст вызова скопирован');
        else if (res && res.shared) self.toast('Вызов отправлен');
      });
    }
  };

  global.UI = UI;
})(window);
