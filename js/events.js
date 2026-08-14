/**
 * Игровые события и босс-раунды. Не смешивается с VK-слоем.
 */
(function (global) {
  'use strict';

  const EVENT_POOL = ['clientDocs', 'friday', 'monthClose', 'update1c', 'fnsDemand', 'payday', 'nds'];
  const BOSS_ROTATION = ['bossDeadline', 'bossFns', 'bossQuarter'];

  function GameEventManager(game) {
    this.game = game;
    this.active = null;
    this.cooldown = 28000 + Math.random() * 12000;
    this.lastBossLevel = 0;
    this.bossIndex = 0;
    this.recentIds = [];
  }

  GameEventManager.prototype.reset = function () {
    this.active = null;
    this.cooldown = 28000 + Math.random() * 12000;
    this.lastBossLevel = 0;
    this.bossIndex = 0;
    this.recentIds = [];
  };

  GameEventManager.prototype.id = function () {
    return this.active ? this.active.id : null;
  };

  GameEventManager.prototype.isBoss = function () {
    return !!(this.active && this.active.kind === 'boss');
  };

  GameEventManager.prototype.isFrozen = function (now) {
    return !!(this.active && this.active.holdUntil && now < this.active.holdUntil);
  };

  GameEventManager.prototype.update = function (dt, now) {
    const game = this.game;
    if (this.active) {
      if (this.active.id === 'bossDeadline' || this.active.id === 'bossFns' || this.active.id === 'bossQuarter') {
        this.active.left = Math.max(0, this.active.until - now);
      }
      if (now >= this.active.until) this.complete(true);
      return;
    }

    if (game.level >= 4 && game.level % 4 === 0 && this.lastBossLevel !== game.level) {
      this.startBoss(now);
      return;
    }

    if (game.level < 2 || game.playTime < 22) return;
    this.cooldown -= dt * 1000;
    if (this.cooldown <= 0) {
      this.cooldown = 28000 + Math.random() * 12000;
      this.startRandom(now);
    }
  };

  GameEventManager.prototype.startRandom = function (now) {
    let pool = EVENT_POOL.filter(function (id) {
      return this.recentIds.indexOf(id) === -1;
    }, this);
    if (!pool.length) pool = EVENT_POOL.slice();
    const id = pool[Math.floor(Math.random() * pool.length)];
    this.recentIds.push(id);
    if (this.recentIds.length > 3) this.recentIds.shift();
    this.start(id, now);
  };

  GameEventManager.prototype.startBoss = function (now) {
    this.lastBossLevel = this.game.level;
    const id = BOSS_ROTATION[this.bossIndex % BOSS_ROTATION.length];
    this.bossIndex += 1;
    this.start(id, now);
  };

  GameEventManager.prototype.start = function (id, now) {
    const game = this.game;
    const def = EVENTS[id];
    let event;

    if (id === 'bossDeadline') {
      event = {
        id: id,
        kind: 'boss',
        until: now + 16000,
        left: 16000,
        need: 7,
        got: 0,
        livesAtStart: game.lives
      };
      game.showBanner('ДЕДЛАЙН', 'Соберите 7 документов за 16 секунд', 1600);
      game.player.setState('worried', 1800);
      game.burstLeft = 6;
    } else if (id === 'bossFns') {
      event = {
        id: id,
        kind: 'boss',
        until: now + 18000,
        left: 18000,
        quest: { pervichka: false, akt: false, otchet: false },
        livesAtStart: game.lives
      };
      game.showBanner('ТРЕБОВАНИЕ', 'Соберите первичку, акт и отчёт', 1600);
      game.player.setState('worried', 2000);
    } else if (id === 'bossQuarter') {
      event = {
        id: id,
        kind: 'boss',
        until: now + 20000,
        left: 20000,
        livesAtStart: game.lives
      };
      game.showBanner('ЗАКРЫТИЕ КВАРТАЛА', 'Переживите поток документов', 1600);
      game.player.setState('worried', 1600);
      game.burstLeft = 8;
    } else {
      event = {
        id: id,
        kind: 'event',
        until: now + (def ? def.duration : 8000) + (def && def.hold ? def.hold : 0),
        livesAtStart: game.lives,
        holdUntil: def && def.hold ? now + def.hold : 0
      };
      game.showBanner(def.title, def.message, def.hold ? Math.min(1600, def.hold + 200) : 1600);
      if (id === 'fnsDemand' || id === 'monthClose') game.player.setState('worried', 1600);
      if (id === 'friday' || id === 'clientDocs' || id === 'monthClose') {
        game.burstLeft = 5;
        game.burstAcc = 0;
      }
      if (id === 'update1c') {
        game.slowUntil = Math.max(game.slowUntil, now + 5000);
        game.player.setState('worried', 2000);
      }
    }

    this.active = event;
    game.hudDirty = true;
  };

  GameEventManager.prototype.onCatch = function (obj) {
    const ev = this.active;
    if (!ev) return;
    const def = obj.def;
    if (ev.id === 'bossDeadline' && def.category === 'good') {
      ev.got += 1;
      if (ev.got >= ev.need) this.complete(true);
    }
    if (ev.id === 'bossFns' && ev.quest && Object.prototype.hasOwnProperty.call(ev.quest, obj.id)) {
      ev.quest[obj.id] = true;
      const all = ev.quest.pervichka && ev.quest.akt && ev.quest.otchet;
      if (all) this.complete(true);
    }
  };

  GameEventManager.prototype.complete = function (finished) {
    const ev = this.active;
    if (!ev) return;
    const game = this.game;
    const survived = game.lives > 0 && game.lives >= ev.livesAtStart;
    this.active = null;
    this.cooldown = 28000 + Math.random() * 12000;
    game.runFlags = game.runFlags || {};

    if (ev.id === 'monthClose' && finished && game.lives > 0) {
      game.addScoreRaw(100);
      game.showBanner('Месяц закрыт', '+100 бонусных очков', 1600);
      game.player.setState('victory', 1400);
      game.runFlags.monthClosed = true;
      game.stats.eventsCompleted += 1;
      AchievementManager.unlock('monthClosed');
    } else if (ev.id === 'fnsDemand' && finished && survived) {
      game.survivedFnsEvent = true;
      game.stats.fnsEventsCompleted += 1;
      game.stats.eventsCompleted += 1;
      game.addScoreRaw(150);
      game.showBanner('ФНС не догнала', '+150 очков', 1600);
      game.player.setState('victory', 1400);
      AchievementManager.unlock('fnsEscaped');
    } else if (ev.id === 'friday' && finished && game.lives > 0) {
      game.runFlags.fridaySurvived = true;
      game.stats.eventsCompleted += 1;
      AchievementManager.unlock('fridaySurvived');
      game.player.setState('happy', 1200);
    } else if (ev.id === 'update1c' && finished) {
      const msg = Math.random() < 0.55
        ? '1С открылась с первого раза. Подозрительно...'
        : 'Удивительно, но всё работает.';
      game.showBanner(msg, '', 1600);
      game.player.setState('happy', 1200);
      game.runFlags.update1cOk = true;
      game.stats.eventsCompleted += 1;
      if (survived) game.runFlags.miracle1c = true;
    } else if (ev.id === 'clientDocs' && finished && game.lives > 0) {
      game.runFlags.clientOnTime = true;
      game.stats.eventsCompleted += 1;
      if (Math.random() < 0.4) {
        game.showBanner('Клиент прислал всё вовремя', 'Кто-то подменил вселенную.', 1600);
      }
    } else if (ev.id === 'bossDeadline') {
      if (ev.got >= ev.need) {
        game.addScoreRaw(200);
        game.showBanner('ОТЧЁТ СДАН!', '+200 очков', 1800);
        game.player.setState('victory', 1600);
        game.runFlags.deadlineDone = true;
        game.stats.eventsCompleted += 1;
      } else {
        game.resetCombo();
        game.score = Math.max(0, game.score - 40);
        game.showBanner('Дедлайн сдвинули', 'Combo сброшен, небольшой штраф', 1600);
        game.hudDirty = true;
      }
    } else if (ev.id === 'bossFns') {
      const done = ev.quest && ev.quest.pervichka && ev.quest.akt && ev.quest.otchet;
      if (done) {
        game.addScoreRaw(250);
        game.showBanner('ОТВЕТ ОТПРАВЛЕН', '+250 очков', 1800);
        game.player.setState('victory', 1600);
        game.survivedFnsEvent = true;
        game.stats.fnsEventsCompleted += 1;
        game.stats.eventsCompleted += 1;
        game.runFlags.fnsReply = true;
        AchievementManager.unlock('fnsEscaped');
      }
    } else if (ev.id === 'bossQuarter' && game.lives >= 1) {
      game.addScoreRaw(180);
      game.showBanner('Квартал закрыт', '+180 очков', 1600);
      game.player.setState('victory', 1400);
      game.runFlags.quarterClosed = true;
      game.stats.eventsCompleted += 1;
    }

    game.flushAchievements();
    game.hudDirty = true;
  };

  GameEventManager.prototype.drawHud = function (ctx, w) {
    const ev = this.active;
    if (!ev) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    if (ev.id === 'bossDeadline') {
      const sec = Math.ceil((ev.left || 0) / 1000);
      const mm = '00:' + (sec < 10 ? '0' : '') + sec;
      roundPanel(ctx, w / 2 - 110, 8, 220, 52);
      ctx.fillStyle = '#D4AF37';
      ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(mm, w / 2, 12);
      ctx.fillStyle = '#F5F7FA';
      ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Соберите ' + ev.need + '  ·  ' + ev.got + '/' + ev.need, w / 2, 34);
    } else if (ev.id === 'bossFns') {
      roundPanel(ctx, w / 2 - 130, 8, 260, 58);
      ctx.fillStyle = '#D4AF37';
      ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('НУЖНО', w / 2, 12);
      ctx.fillStyle = '#F5F7FA';
      ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
      const q = ev.quest;
      const line = (q.pervichka ? '✅' : '📄') + ' Первичка   ' +
        (q.akt ? '✅' : '🧾') + ' Акт   ' +
        (q.otchet ? '✅' : '📋') + ' Отчёт';
      ctx.fillText(line, w / 2, 34);
    } else if (ev.id === 'bossQuarter') {
      const sec = Math.ceil((ev.left || 0) / 1000);
      roundPanel(ctx, w / 2 - 110, 8, 220, 40);
      ctx.fillStyle = '#D4AF37';
      ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Квартал · ' + sec + ' с', w / 2, 18);
    } else if (ev.id === 'update1c') {
      roundPanel(ctx, w / 2 - 120, 8, 240, 32);
      ctx.fillStyle = '#F5F7FA';
      ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('1С ОБНОВЛЯЕТСЯ...', w / 2, 16);
    }

    ctx.restore();
  };

  function roundPanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 31, 68, 0.78)';
    ctx.beginPath();
    const r = 10;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  global.GameEventManager = GameEventManager;
})(window);
