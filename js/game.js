/**
 * Ядро игры. Не вызывает VK Bridge напрямую — только EnvAdapter / VKService / UI.
 */
(function (global) {
  'use strict';

  function Game() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.wrap = document.getElementById('canvas-wrap');

    this.state = 'boot';
    this.width = 360;
    this.height = 640;
    this.dpr = 1;

    this.player = new Player();
    this.objects = [];
    this.particles = [];
    this.texts = [];

    this.keysLeft = false;
    this.keysRight = false;
    this.ptrLeft = false;
    this.ptrRight = false;

    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.combo = 0;
    this.maxCombo = 0;
    this.documentsCollected = 0;
    this.problemsAvoided = 0;
    this.lostLifeThisRun = false;
    this.survivedFnsEvent = false;
    this.lastScore = 0;
    this.record = 0;

    this.spawnAcc = 0;
    this.eventAcc = 0;
    this.nextEventIn = 22000;
    this.activeEvent = null;
    this.burstLeft = 0;
    this.burstAcc = 0;

    this.coffeeUntil = 0;
    this.slowUntil = 0;
    this.delayUntil = 0;
    this.flashUntil = 0;
    this.shakeUntil = 0;
    this.shakeMag = 0;

    this.bannerUntil = 0;
    this.bannerTitle = '';
    this.bannerSub = '';

    this.lastTs = 0;
    this.raf = 0;
    this.hudDirty = true;
    this.playTime = 0;
    this.goldFlashUntil = 0;
    this.comboPop = 1;
    this.lowFx = detectLowFx();
    this.particleCap = this.lowFx ? 36 : 70;
    this.events = new GameEventManager(this);
    this.stats = emptyStats();
    this.menuBits = [];
    this.idleRaf = 0;
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsStamp = 0;
    this._historyArmed = false;
    this._startLock = false;
    this.tutorialActive = false;
    this.tutorialStep = 0;
    this.happyUntil = 0;
    this.recordAnnounced = false;
    this.playtestLog = null;

    this.bindInput();
    this.resize();
  }

  Game.prototype.bindInput = function () {
    const self = this;

    window.addEventListener('resize', function () { self.resize(); self.syncRotateHint(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () {
        self.resize();
        self.syncRotateHint();
      }, 80);
    });

    document.addEventListener('keydown', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        self.keysLeft = true;
        e.preventDefault();
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        self.keysRight = true;
        e.preventDefault();
      }
      if (e.code === 'KeyP') {
        e.preventDefault();
        if (self.state === 'playing') self.pauseGame('manual');
        else if (self.state === 'paused') self.resumeGame();
      }
      if (e.code === 'Space') {
        e.preventDefault();
        self.onSpace();
      }
    });

    document.addEventListener('keyup', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') self.keysLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') self.keysRight = false;
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (self.state === 'playing') self.pauseGame('hidden');
        PlayerDataService.save();
      }
    });

    window.addEventListener('pagehide', function () {
      PlayerDataService.save();
    });

    window.addEventListener('blur', function () {
      if (self.state === 'playing') self.pauseGame('blur');
    });

    window.addEventListener('popstate', function () {
      self.onSystemBack();
    });

    this.bindPad(document.getElementById('pad-left'), 'left');
    this.bindPad(document.getElementById('pad-right'), 'right');

    const play = document.getElementById('screen-play');
    play.addEventListener('touchmove', function (e) {
      if (self.state === 'playing' || self.state === 'paused') e.preventDefault();
    }, { passive: false });
    play.addEventListener('contextmenu', function (e) {
      if (self.state === 'playing') e.preventDefault();
    });
  };

  Game.prototype.bindPad = function (el, side) {
    if (!el) return;
    const self = this;
    const set = function (down) {
      if (side === 'left') self.ptrLeft = down;
      else self.ptrRight = down;
    };
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      set(true);
      AudioManager.unlock();
    });
    el.addEventListener('pointerup', function (e) {
      e.preventDefault();
      set(false);
    });
    el.addEventListener('pointercancel', function () { set(false); });
    el.addEventListener('pointerleave', function (e) {
      if (e.buttons === 0) set(false);
    });
  };

  Game.prototype.onSpace = function () {
    AudioManager.unlock();
    if (UI.els && UI.els.confirm && UI.els.confirm.classList.contains('is-active')) return;
    if (this.tutorialActive && this.tutorialStep >= 4) {
      this.finishTutorial();
      return;
    }
    if (this.state === 'menu' || this.state === 'boot') this.requestStart();
    else if (this.state === 'paused') this.resumeGame();
    else if (this.state === 'gameover') this.restartGame();
  };

  Game.prototype.resize = function () {
    const rect = this.wrap.getBoundingClientRect();
    this.width = Math.max(280, Math.floor(rect.width));
    this.height = Math.max(320, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.state !== 'playing') {
      this.player.x = this.width / 2;
      this.player.y = this.height - this.deskHeight() + 8;
    }
  };

  Game.prototype.requestStart = function () {
    if (this._startLock) return;
    if (!GameStorage.isTutorialCompleted()) {
      this.startTutorial();
      return;
    }
    this.startGame();
  };

  Game.prototype.startTutorial = function () {
    if (this._startLock) return;
    AudioManager.unlock();
    this._armStartLock();
    this.stopIdle();
    this.resetRun();
    this.tutorialActive = true;
    this.tutorialStep = 1;
    this.tutorialMoved = false;
    this.tutorialArmed = false;
    this.tutorialNextAt = 0;
    this._tutObj = null;
    this.state = 'playing';
    this.cloudSessionId = null;
    this.sessionPromise = null;
    UI.hidePause();
    UI.hideGameOver();
    UI.hideConfirm();
    UI.hideTutorialDone();
    UI.show('play');
    UI.showTutorialHint('ДВИГАЙТЕСЬ', '← →  ·  A D  ·  ◀ ▶');
    this.resize();
    this.player.reset(this.width, this.height);
    this.player.y = this.height - this.deskHeight() + 8;
    this.hudDirty = true;
    this.syncHud();
    this.lastTs = 0;
    this.armHistory();
    AnalyticsService.track('tutorial_start');
    this.loop();
  };

  Game.prototype.startGame = function () {
    if (this._startLock) return;
    AudioManager.unlock();
    this._armStartLock();
    this.stopIdle();
    this.resetRun();
    this.tutorialActive = false;
    this.tutorialStep = 0;
    this.state = 'playing';
    this.cloudSessionId = null;
    this.runStartedAt = Date.now();
    this.sessionPromise = null;
    if (global.SyncService && SyncService.isOnline()) {
      const self = this;
      this.sessionPromise = SyncService.startSession().then(function (data) {
        if (data && data.sessionId) self.cloudSessionId = data.sessionId;
        return data;
      });
    }
    UI.show('play');
    UI.hidePause();
    UI.hideGameOver();
    UI.hideConfirm();
    UI.hideTutorialDone();
    UI.hideTutorialHint();
    this.resize();
    this.player.reset(this.width, this.height);
    this.player.y = this.height - this.deskHeight() + 8;
    this.hudDirty = true;
    this.syncHud();
    this.lastTs = 0;
    this.armHistory();
    AnalyticsService.track('game_start');
    this.loop();
  };

  Game.prototype._armStartLock = function () {
    const self = this;
    this._startLock = true;
    setTimeout(function () { self._startLock = false; }, 450);
  };

  Game.prototype.restartGame = function () {
    if (this._startLock) return;
    UI.hideGameOver();
    UI.hidePause();
    UI.hideConfirm();
    this.startGame();
  };

  Game.prototype.backToMenu = function () {
    this.state = 'menu';
    this.tutorialActive = false;
    this.stopLoop();
    UI.hidePause();
    UI.hideGameOver();
    UI.hideConfirm();
    UI.hideTutorialDone();
    UI.hideTutorialHint();
    UI.renderProfile();
    UI.renderDailyCard();
    UI.show('menu');
    UI.maybeShowMerge();
    UI.updateSoundButton();
    this.ensureIdle();
  };

  Game.prototype.armHistory = function () {
    try {
      history.pushState({ bn: 'play' }, '');
      this._historyArmed = true;
    } catch (err) {
      this._historyArmed = false;
    }
  };

  Game.prototype.onSystemBack = function () {
    if (this.tutorialActive) {
      this.backToMenu();
      return;
    }
    if (this.state === 'playing') {
      this.pauseGame('back');
      return;
    }
    if (this.state === 'paused' || this.state === 'gameover') {
      this.backToMenu();
    }
  };

  Game.prototype.resetRun = function () {
    this.objects.length = 0;
    this.particles.length = 0;
    this.texts.length = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.combo = 0;
    this.maxCombo = 0;
    this.documentsCollected = 0;
    this.problemsAvoided = 0;
    this.lostLifeThisRun = false;
    this.survivedFnsEvent = false;
    this.runFlags = {};
    this.coffeeCaught = 0;
    this.spawnAcc = 0;
    this.burstLeft = 0;
    this.burstAcc = 0;
    this.coffeeUntil = 0;
    this.slowUntil = 0;
    this.delayUntil = 0;
    this.flashUntil = 0;
    this.shakeUntil = 0;
    this.bannerUntil = 0;
    this.playTime = 0;
    this.goldFlashUntil = 0;
    this.comboPop = 1;
    this.stats = emptyStats();
    this.runFlags = {};
    this.coffeeCaught = 0;
    this.happyUntil = 0;
    this.recordAnnounced = false;
    this.playtestLog = null;
    this.tutorialMoved = false;
    this.tutorialArmed = false;
    this._tutObj = null;
    this.record = GameStorage.loadHighScore();
    this.events.reset();
  };

  Game.prototype.pauseGame = function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.stopLoop();
    AudioManager.play('pause');
    UI.showPause();
  };

  Game.prototype.syncRotateHint = function () {
    const awkward = window.matchMedia &&
      window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
    const hint = document.getElementById('rotate-hint');
    if (hint) {
      hint.setAttribute('aria-hidden', awkward ? 'false' : 'true');
    }
    if (awkward && this.state === 'playing') this.pauseGame('rotate');
  };

  Game.prototype.resumeGame = function () {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    UI.hidePause();
    UI.hideConfirm();
    AudioManager.play('resume');
    this.lastTs = 0;
    this.loop();
  };

  Game.prototype.stopLoop = function () {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  };

  Game.prototype.loop = function () {
    const self = this;
    this.stopLoop();
    const frame = function (ts) {
      if (self.state !== 'playing') return;
      const dt = self.lastTs ? Math.min(0.05, (ts - self.lastTs) / 1000) : 0.016;
      self.lastTs = ts;
      self.update(dt);
      self.draw();
      self.trackFps(ts);
      self.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  };

  Game.prototype.trackFps = function (ts) {
    this._fpsFrames += 1;
    if (!this._fpsStamp) this._fpsStamp = ts;
    if (ts - this._fpsStamp >= 1000) {
      this.fps = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsStamp = ts;
      if (global.DEBUG || global.PLAYTEST_MODE) UI.updateDebug(this.fps);
    }
  };

  Game.prototype.now = function () {
    return performance.now();
  };

  Game.prototype.eventId = function () {
    return this.events.id();
  };

  Game.prototype.update = function (dt) {
    const now = this.now();
    const boosted = now < this.coffeeUntil;
    const slowed = now < this.slowUntil || this.eventId() === 'update1c';
    const delayed = now < this.delayUntil;
    const frozen = this.events.isFrozen(now);
    const animScale = this.eventId() === 'update1c' ? 0.72 : 1;
    this.playTime += dt;
    if (this.playTime > 180 && this.player.playerState === 'idle') {
      this.player.setState('tired', 800, now);
    }

    this.player.update(dt, {
      width: this.width,
      height: this.height,
      floor: this.height - this.deskHeight() + 8
    },
      this.keysLeft || this.ptrLeft,
      this.keysRight || this.ptrRight,
      boosted, slowed, now);

    if (this.tutorialActive) {
      this.updateTutorial(dt, now);
    } else if (!frozen) {
      this.events.update(dt, now);
      this.spawnAcc += dt * 1000;
      const interval = getSpawnInterval(this.level, this.eventId(), this.playTime);
      const cap = getDifficulty(this.level, this.playTime).maxObjects;
      if (this.spawnAcc >= interval && this.objects.length < cap) {
        this.spawnAcc = 0;
        this.spawnObject();
      }

      if (this.burstLeft > 0 && this.objects.length < cap) {
        this.burstAcc += dt * 1000;
        if (this.burstAcc >= 140) {
          this.burstAcc = 0;
          this.burstLeft -= 1;
          this.spawnObject();
        }
      }

      for (let i = 0; i < this.objects.length; i++) this.objects[i].update(dt, animScale);
    }

    if (this.tutorialActive) {
      for (let i = 0; i < this.objects.length; i++) this.objects[i].update(dt, 0.85);
    }

    for (let i = 0; i < this.particles.length; i++) this.particles[i].update(dt);
    for (let i = 0; i < this.texts.length; i++) this.texts[i].update(dt);
    if (this.comboPop > 1) this.comboPop = Math.max(1, this.comboPop - dt * 1.8);

    this.checkCollisions();
    this.reapMissed();

    this.objects = this.objects.filter(function (o) { return !o.dead; });
    this.particles = this.particles.filter(function (p) { return !p.dead; });
    this.texts = this.texts.filter(function (t) { return !t.dead; });

    if (this.objects.length > 48) this.objects.length = 48;
    if (this.particles.length > this.particleCap) {
      this.particles.splice(0, this.particles.length - this.particleCap);
    }
    if (this.texts.length > 24) this.texts.splice(0, this.texts.length - 24);

    const coffee = now < this.coffeeUntil;
    const slowFx = now < this.slowUntil;
    const delayFx = now < this.delayUntil;
    if (coffee !== this._hudCoffee || slowFx !== this._hudSlow || delayFx !== this._hudDelay) {
      this._hudCoffee = coffee;
      this._hudSlow = slowFx;
      this._hudDelay = delayFx;
      this.hudDirty = true;
    }

    if (this.hudDirty) this.syncHud();
  };

  Game.prototype.updateTutorial = function (dt, now) {
    if (this.tutorialStep === 1) {
      if (this.keysLeft || this.keysRight || this.ptrLeft || this.ptrRight) this.tutorialMoved = true;
      if (this.tutorialMoved && !this.tutorialArmed) {
        this.tutorialArmed = true;
        this.tutorialNextAt = now + 400;
      }
      if (this.tutorialArmed && now >= this.tutorialNextAt) this.tutorialGo(2);
      return;
    }
    if (this.tutorialStep === 2 && !this._tutObj) {
      this._tutObj = this._spawnTutorial('pervichka', 0.52);
      UI.showTutorialHint('Поймайте полезный документ', '📄 Первичка');
    }
    if (this.tutorialStep === 3 && !this._tutObj) {
      this._tutObj = this._spawnTutorial('noSign', 0.5);
      UI.showTutorialHint('А этого лучше избегать', '⚠️ Нет подписи');
    }
  };

  Game.prototype.tutorialGo = function (step) {
    this.tutorialStep = step;
    this._tutObj = null;
    this.objects.length = 0;
    if (step === 4) {
      UI.hideTutorialHint();
      UI.showTutorialDone();
    }
  };

  Game.prototype._spawnTutorial = function (id, speed) {
    const obj = new FallingObject(id, this.width / 2, speed, this.width);
    this.objects.push(obj);
    return obj;
  };

  Game.prototype.finishTutorial = function () {
    GameStorage.setTutorialCompleted();
    this.tutorialActive = false;
    UI.hideTutorialDone();
    UI.hideTutorialHint();
    if (this._startLock) return;
    this.startGame();
  };

  Game.prototype.replayTutorial = function () {
    GameStorage.resetTutorial();
    this.startTutorial();
  };

  Game.prototype.spawnObject = function () {
    const d = getDifficulty(this.level, this.playTime);
    if (this.objects.length >= d.maxObjects) return;
    const rare = Math.random();
    let id;
    if (rare < d.goldChance) id = 'goldDoc';
    else if (rare < d.goldChance + d.zeroDeclChance) id = 'zeroDecl';
    else if (rare < d.goldChance + d.zeroDeclChance + d.srochnoChance) id = 'srochno';
    else {
      const weights = getSpawnWeights(this.level, this.eventId(), this.playTime);
      const r = Math.random();
      if (r < weights.good) id = pickGoodId(this.eventId());
      else if (r < weights.good + weights.bad) id = pickBadId(this.eventId());
      else id = pickBonusId();
    }
    this._pushObject(id);
  };

  Game.prototype.spawnBonus = function () {
    this._pushObject(pickBonusId());
  };

  Game.prototype._laneXs = function () {
    const margin = 48;
    const usable = Math.max(48, this.width - margin * 2);
    return [margin, margin + usable / 2, margin + usable];
  };

  Game.prototype._pushObject = function (id) {
    const def = OBJECT_TYPES[id];
    const lanes = this._laneXs();
    const occupied = [false, false, false];
    const badNear = [false, false, false];
    for (let i = 0; i < this.objects.length; i++) {
      const o = this.objects[i];
      if (o.dead || o.y > 170) continue;
      let best = 0;
      let bestD = 1e9;
      for (let L = 0; L < 3; L++) {
        const dist = Math.abs(o.x - lanes[L]);
        if (dist < bestD) {
          bestD = dist;
          best = L;
        }
      }
      occupied[best] = true;
      if (o.category === 'bad') badNear[best] = true;
    }

    let laneIdx;
    if (def && def.category === 'bad') {
      const badCount = badNear.filter(Boolean).length;
      if (badCount >= 2) return;
      const safe = [0, 1, 2].filter(function (i) { return !badNear[i]; });
      if (!safe.length) return;
      const freeSafe = safe.filter(function (i) { return !occupied[i]; });
      const pool = freeSafe.length ? freeSafe : safe;
      laneIdx = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const free = [0, 1, 2].filter(function (i) { return !occupied[i]; });
      const pool = free.length ? free : [0, 1, 2];
      laneIdx = pool[Math.floor(Math.random() * pool.length)];
    }

    const delayed = this.now() < this.delayUntil;
    const speed = getFallSpeed(this.level, this.eventId(), delayed, this.playTime) * (0.92 + Math.random() * 0.18);
    this.objects.push(new FallingObject(id, lanes[laneIdx], speed, this.width));
  };

  Game.prototype.checkCollisions = function () {
    const pb = this.player.getBounds();
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (obj.dead) continue;
      if (aabb(pb, obj.getBounds())) {
        obj.dead = true;
        this.handleCatch(obj);
      }
    }
  };

  Game.prototype.handleCatch = function (obj) {
    if (this.state !== 'playing') return;
    const def = obj.def;

    if (this.tutorialActive) {
      obj.dead = true;
      this._tutObj = null;
      if (this.tutorialStep === 2 && def.category === 'good') {
        this.float(obj.x, obj.y, '+10', '#0A1F44');
        this.float(obj.x, obj.y - 22, 'Отлично!', '#2E8B57');
        this.burst(obj.x, obj.y, '#4A90C4', 8);
        AudioManager.play('good_collect');
        this.tutorialGo(3);
      } else if (this.tutorialStep === 3) {
        this.float(obj.x, obj.y, 'Плохие документы отнимают жизнь', '#C0392B');
        AudioManager.play('bad_hit');
        this.tutorialGo(4);
      }
      return;
    }

    if (def.category === 'good') {
      this.increaseCombo(def.boostCombo ? 2 : 1);
      this.addScore(def.score);
      this.documentsCollected += 1;
      this.stats.documentsCaught += 1;
      if (obj.id === 'oplata') this.stats.paymentsCaught += 1;
      if (obj.id === 'otchet') this.stats.reportsCaught += 1;
      GameStorage.addLifetimeDocs(1);
      this.burst(obj.x, obj.y, def.gold ? '#D4AF37' : '#4A90C4', def.gold ? 18 : 8);
      let msg = def.score >= 20 ? '+' + def.score : (def.message || '+10');
      if (obj.id === 'akt' && Math.random() < 0.12) msg = 'Сошлось с первого раза!';
      this.float(obj.x, obj.y, msg, def.gold ? '#8A7020' : '#0A1F44');
      AudioManager.play(def.gold ? 'bonus_collect' : 'good_collect');
      if (def.gold) {
        this.goldFlashUntil = this.now() + 280;
        this.maybeHappy(700);
      } else if (obj.id === 'oplata' || obj.id === 'otchet' || def.urgent) {
        this.maybeHappy(500);
      }
      this.events.onCatch(obj);
      this.flushAchievements();
    } else if (def.category === 'bad') {
      this.stats.penaltiesHit += 1;
      if (def.effect === 'slow') this.applySlow();
      else this.loseLife(obj.x, obj.y, def.message);
    } else {
      this.stats.bonusesCaught += 1;
      this.applyBonus(def, obj);
      this.maybeHappy(600);
    }
  };

  Game.prototype.maybeHappy = function (ms) {
    const now = this.now();
    if (now < (this.happyUntil || 0)) return;
    this.happyUntil = now + 1800;
    this.player.setState('happy', ms || 500, now);
  };

  Game.prototype.applyBonus = function (def, obj) {
    AudioManager.play('bonus');
    this.burst(obj.x, obj.y, '#D4AF37', 14);
    this.float(obj.x, obj.y, def.message, '#8A7020');
    if (def.score) {
      this.increaseCombo(1);
      this.addScore(def.score);
      this.documentsCollected += 1;
      GameStorage.addLifetimeDocs(1);
    }
    EnvAdapter.haptic('success');
    if (def.effect === 'speed') {
      this.coffeeUntil = this.now() + 5000;
      this.coffeeCaught += 1;
      this.showBanner('Кофе активирован!', 'Скорость бухгалтера повышена', 1400);
    } else if (def.effect === 'slowFall') {
      this.delayUntil = this.now() + 5000;
      this.showBanner('Отсрочка', 'Документы падают медленнее', 1400);
    } else if (def.effect === 'life') {
      if (this.lives < 3) this.lives += 1;
      this.hudDirty = true;
    } else if (def.effect === 'collectAll') {
      this.autoCollect();
    }
    this.flushAchievements();
  };

  Game.prototype.autoCollect = function () {
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (obj.dead) continue;
      if (obj.category === 'good' || (obj.def && obj.def.score)) {
        obj.dead = true;
        this.increaseCombo(1);
        this.addScore(obj.def.score || 10);
        this.documentsCollected += 1;
        GameStorage.addLifetimeDocs(1);
        this.burst(obj.x, obj.y, '#4A90C4', 8);
      }
    }
  };

  Game.prototype.applySlow = function () {
    this.slowUntil = this.now() + 2200;
    this.resetCombo();
    this.showBanner('1С думает...', 'Движение замедлено', 1400);
    AudioManager.play('error');
    this.hudDirty = true;
  };

  Game.prototype.reapMissed = function () {
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (obj.dead) continue;
      if (obj.expired || obj.y - obj.h / 2 > this.height + 20) {
        obj.dead = true;
        if (this.tutorialActive) {
          this._tutObj = null;
          continue;
        }
        if (obj.category === 'good' || obj.expired) this.resetCombo();
        else if (obj.category === 'bad') this.problemsAvoided += 1;
      }
    }
  };

  Game.prototype.addScore = function (base) {
    const gained = Math.round(base * getComboMultiplier(this.combo));
    this.addScoreRaw(gained);
  };

  Game.prototype.addScoreRaw = function (gained) {
    this.score += gained;
    const nextLevel = Math.floor(this.score / 100) + 1;
    if (nextLevel > this.level) this.levelUp(nextLevel);
    if (!this.tutorialActive && !this.recordAnnounced && this.record > 0 && this.score > this.record) {
      this.recordAnnounced = true;
      this.showBanner('🏆 НОВЫЙ ЛИЧНЫЙ РЕКОРД', '', 1600);
      AudioManager.play('new_record');
    }
    this.hudDirty = true;
  };

  Game.prototype.increaseCombo = function (by) {
    this.combo += by || 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.stats.bestCombo = this.maxCombo;
    this.comboPop = this.combo >= 10 ? 1.35 : 1.22;
    const msg = COMBO_MILESTONES[this.combo];
    if (msg) {
      this.showBanner('COMBO ×' + this.combo, msg, 1400);
      AudioManager.play(this.combo >= 20 ? 'ninja_mode' : 'combo');
      if (this.combo >= 20) this.player.setState('victory', 1400);
    }
    this.flushAchievements();
    this.hudDirty = true;
  };

  Game.prototype.resetCombo = function () {
    if (this.combo !== 0) {
      this.combo = 0;
      this.hudDirty = true;
    }
  };

  Game.prototype.loseLife = function (x, y, message) {
    if (this.state !== 'playing') return;
    this.lives -= 1;
    this.lostLifeThisRun = true;
    this.resetCombo();
    this.player.setState('hit', 420);
    this.flashUntil = this.now() + 180;
    this.shakeUntil = this.now() + 320;
    this.shakeMag = 7;
    this.burst(x, y, '#C0392B', 12);
    this.float(x, y, message || 'Ошибка!', '#C0392B');
    AudioManager.play('life');
    EnvAdapter.haptic('error');
    this.hudDirty = true;
    this.syncHud();
    if (this.lives <= 0) this.gameOver();
  };

  Game.prototype.levelUp = function (next) {
    this.level = next;
    this.player.setState('victory', 1400);
    this.showBanner('УРОВЕНЬ ' + this.level, getLevelName(this.level), 1600);
    AudioManager.play('level');
    AnalyticsService.track('level_up', { level: this.level });
    this.hudDirty = true;
  };

  Game.prototype.gameOver = function () {
    if (this.state === 'gameover') return;
    if (this.tutorialActive) return;
    this.state = 'gameover';
    this.stopLoop();
    this.player.setState('tired', 0);
    this.lastScore = this.score;
    this.stats.bestCombo = this.maxCombo;
    this.stats.playTime = this.playTime;
    const flags = this.runFlags || {};
    const prevHigh = PlayerDataService.getStats().highScore || 0;
    const isNew = this.score > prevHigh;

    const run = {
      score: this.score,
      level: this.level,
      combo: this.combo,
      maxCombo: this.maxCombo,
      lostLifeThisRun: this.lostLifeThisRun,
      survivedFnsEvent: this.survivedFnsEvent,
      documentsCaught: this.stats.documentsCaught,
      documentsCollected: this.documentsCollected,
      paymentsCaught: this.stats.paymentsCaught,
      bonusesCaught: this.stats.bonusesCaught,
      penaltiesHit: this.stats.penaltiesHit,
      eventsCompleted: this.stats.eventsCompleted || 0,
      coffeeCaught: this.coffeeCaught,
      monthClosed: !!flags.monthClosed,
      quarterClosed: !!flags.quarterClosed,
      deadlineDone: !!flags.deadlineDone,
      fnsReply: !!flags.fnsReply,
      fridaySurvived: !!flags.fridaySurvived,
      update1cOk: !!flags.update1cOk,
      miracle1c: !!flags.miracle1c,
      clientOnTime: !!flags.clientOnTime
    };

    PlayerDataService.updateStats(run);
    const baseXP = Math.floor(this.score / 10) + (run.eventsCompleted || 0) * 10;
    const xpResult = PlayerDataService.addXP(baseXP);
    run.playerLevel = PlayerDataService.getLevel();
    AchievementService.checkAchievements(run);
    const unlocked = AchievementService.consumeJustUnlocked();
    if (unlocked.length) {
      PlayerDataService.addXP(unlocked.length * 20);
      run.playerLevel = PlayerDataService.getLevel();
      AchievementService.checkAchievements(run);
      const extra = AchievementService.consumeJustUnlocked();
      for (let i = 0; i < extra.length; i++) unlocked.push(extra[i]);
    }

    const daily = DailyChallengeService.updateProgress(run);
    this.record = PlayerDataService.getStats().highScore;
    if (isNew) this.player.setState('victory', 0);

    const career = PlayerDataService.getRank();
    const finishPayload = {
      combo: this.maxCombo,
      bestCombo: this.maxCombo,
      level: this.level,
      rank: career,
      documentsCaught: this.stats.documentsCaught,
      documentsCollected: this.documentsCollected,
      bonusesCaught: this.stats.bonusesCaught,
      penaltiesHit: this.stats.penaltiesHit,
      paymentsCaught: this.stats.paymentsCaught,
      eventsCompleted: this.stats.eventsCompleted || 0,
      duration: Date.now() - (this.runStartedAt || Date.now()),
      lostLifeThisRun: this.lostLifeThisRun,
      sessionId: this.cloudSessionId
    };
    const self = this;
    function sendBoard(sessionId) {
      finishPayload.sessionId = sessionId || self.cloudSessionId;
      LeaderboardService.submitScore(self.score, finishPayload).then(function (result) {
        if (result && result.local && result.notice && UI && UI.toast) {
          UI.toast(result.notice);
        } else if (result && result.error && UI && UI.toast) {
          UI.toast(result.error);
        }
      });
    }
    if (this.cloudSessionId) {
      sendBoard(this.cloudSessionId);
    } else if (this.sessionPromise) {
      Promise.race([
        this.sessionPromise,
        new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 1200); })
      ]).then(function (data) {
        sendBoard(data && data.sessionId);
      });
    } else {
      sendBoard(null);
    }
    AnalyticsService.track('game_over', { score: this.score, level: this.level });
    AudioManager.play('game_over');
    if (isNew) AudioManager.play('new_record');

    this.playtestLog = {
      score: this.score,
      level: this.level,
      maxCombo: this.maxCombo,
      playTime: Math.round(this.playTime * 10) / 10,
      documents: this.stats.documentsCaught,
      penalties: this.stats.penaltiesHit,
      events: this.stats.eventsCompleted || 0,
      fps: this.fps
    };
    if (global.DEBUG || global.PLAYTEST_MODE) {
      try { console.info('[PLAYTEST]', this.playtestLog); } catch (err) {}
      if (UI && UI.updatePlaytestLog) UI.updatePlaytestLog(this.playtestLog);
    }

    UI.showGameOver({
      score: this.score,
      level: this.level,
      maxCombo: this.maxCombo,
      documentsCollected: this.documentsCollected,
      documentsCaught: this.stats.documentsCaught,
      paymentsCaught: this.stats.paymentsCaught,
      reportsCaught: this.stats.reportsCaught,
      problemsAvoided: this.problemsAvoided,
      rank: career,
      isNewRecord: isNew,
      xpGained: xpResult.gained,
      xpResult: xpResult,
      daily: daily,
      unlocked: unlocked
    }, isNew);

    RewardQueue.clear();
    if (daily.completed && !daily.rewardClaimed) {
      RewardQueue.enqueueReward({
        type: 'daily',
        title: '🎉 ЗАДАНИЕ ВЫПОЛНЕНО!',
        subtitle: daily.description,
        extra: 'Награда: +' + daily.xp + ' XP',
        actionLabel: 'ЗАБРАТЬ НАГРАДУ',
        daily: true
      });
    }
    if (xpResult.levelsGained && xpResult.levelsGained.length) {
      RewardQueue.enqueueReward({
        type: 'level',
        title: '⭐ НОВЫЙ УРОВЕНЬ!',
        subtitle: 'Уровень ' + xpResult.toLevel,
        extra: getCareerRank(xpResult.toLevel).title,
        actionLabel: 'Отлично'
      });
    }
    if (xpResult.rankChanged) {
      RewardQueue.enqueueReward({
        type: 'rank',
        title: '🏆 НОВОЕ ЗВАНИЕ',
        subtitle: String(getCareerRank(xpResult.toLevel).title).toUpperCase(),
        extra: getCareerRank(xpResult.toLevel).icon || '',
        actionLabel: 'Отлично'
      });
    }
    setTimeout(function () { RewardQueue.start(); }, 900);

    for (let i = 0; i < unlocked.length; i++) {
      UI.showAchievement(unlocked[i]);
      EnvAdapter.haptic('success');
      AnalyticsService.track('achievement_unlock', { id: unlocked[i].id });
    }
  };

  Game.prototype.flushAchievements = function () {
    const flags = this.runFlags || {};
    AchievementService.checkAchievements({
      score: this.score,
      level: this.level,
      combo: this.combo,
      maxCombo: this.maxCombo,
      lostLifeThisRun: this.lostLifeThisRun,
      documentsCaught: this.stats.documentsCaught,
      paymentsCaught: this.stats.paymentsCaught,
      bonusesCaught: this.stats.bonusesCaught,
      coffeeCaught: this.coffeeCaught,
      survivedFnsEvent: this.survivedFnsEvent,
      monthClosed: !!flags.monthClosed,
      quarterClosed: !!flags.quarterClosed,
      deadlineDone: !!flags.deadlineDone,
      fnsReply: !!flags.fnsReply,
      fridaySurvived: !!flags.fridaySurvived,
      update1cOk: !!flags.update1cOk,
      miracle1c: !!flags.miracle1c,
      clientOnTime: !!flags.clientOnTime,
      playerLevel: PlayerDataService.getLevel()
    });
    DailyChallengeService.updateProgress({
      score: this.score,
      level: this.level,
      maxCombo: this.maxCombo,
      documentsCaught: this.stats.documentsCaught,
      paymentsCaught: this.stats.paymentsCaught,
      bonusesCaught: this.stats.bonusesCaught,
      lostLifeThisRun: this.lostLifeThisRun
    });
    UI.updateDailyHud();
    const unlocked = AchievementService.consumeJustUnlocked();
    for (let i = 0; i < unlocked.length; i++) {
      UI.showAchievement(unlocked[i]);
      EnvAdapter.haptic('success');
      AnalyticsService.track('achievement_unlock', { id: unlocked[i].id });
    }
  };

  Game.prototype.saveHighScore = function () {
    return GameStorage.saveHighScore(this.score);
  };

  Game.prototype.loadHighScore = function () {
    return GameStorage.loadHighScore();
  };

  Game.prototype.showBanner = function (title, sub, ms) {
    this.bannerTitle = title;
    this.bannerSub = sub || '';
    this.bannerUntil = this.now() + Math.min(1600, ms || 1400);
  };

  Game.prototype.burst = function (x, y, color, n) {
    spawnParticles(this.particles, x, y, color, this.lowFx ? Math.min(n, 6) : n, this.particleCap);
  };

  Game.prototype.float = function (x, y, text, color) {
    this.texts.push(new FloatingText(x, y - 10, text, color));
  };

  Game.prototype.syncHud = function () {
    const now = this.now();
    UI.updateHud({
      score: this.score,
      lives: this.lives,
      level: this.level,
      combo: this.combo,
      record: this.record,
      xp: (this.score % 100) / 100,
      ninja: this.combo >= 20,
      coffee: now < this.coffeeUntil,
      slow: now < this.slowUntil || this.eventId() === 'update1c',
      delay: now < this.delayUntil
    });
    UI.updateDailyHud();
    this.hudDirty = false;
  };

  Game.prototype.draw = function () {
    const ctx = this.ctx;
    const now = this.now();
    let sx = 0;
    let sy = 0;
    if (now < this.shakeUntil) {
      sx = (Math.random() - 0.5) * this.shakeMag;
      sy = (Math.random() - 0.5) * this.shakeMag;
    }

    ctx.save();
    ctx.translate(sx, sy);
    this.drawBackground(ctx);

    for (let i = 0; i < this.objects.length; i++) this.objects[i].draw(ctx);
    this.player.draw(ctx, now, this.combo >= 20);
    for (let i = 0; i < this.particles.length; i++) this.particles[i].draw(ctx);
    for (let i = 0; i < this.texts.length; i++) this.texts[i].draw(ctx);

    this.events.drawHud(ctx, this.width);
    if (now < this.bannerUntil) this.drawBanner(ctx, now);
    ctx.restore();

    if (now < this.flashUntil) {
      ctx.fillStyle = 'rgba(192, 57, 43, 0.28)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
    if (now < this.goldFlashUntil) {
      ctx.fillStyle = 'rgba(212, 175, 55, 0.22)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  };

  Game.prototype.deskHeight = function () {
    return Math.max(22, Math.round(this.height * 0.055));
  };

  Game.prototype.drawBackground = function (ctx) {
    const w = this.width;
    const h = this.height;
    const deskH = this.deskHeight();
    const wallBottom = h - deskH;

    const wall = ctx.createLinearGradient(0, 0, 0, wallBottom);
    wall.addColorStop(0, '#D9E3EE');
    wall.addColorStop(0.55, '#E7EDF4');
    wall.addColorStop(1, '#F2EFE8');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, wallBottom);

    ctx.fillStyle = 'rgba(10, 31, 68, 0.05)';
    ctx.fillRect(0, wallBottom * 0.52, w, 10);

    const winW = Math.min(180, w * 0.42);
    const winH = Math.min(150, h * 0.26);
    const winX = 18;
    const winY = 28;
    this.drawWindow(ctx, winX, winY, winW, winH);

    ctx.save();
    ctx.globalAlpha = this.lowFx ? 0.12 : 0.18;
    this.drawClock(ctx, w - 42, 52, this.eventId() === 'friday');
    this.drawCalendar(ctx, w - 92, 86);
    if (!this.lowFx) {
      this.drawShelf(ctx, w - 78, wallBottom - 130);
      this.drawPlant(ctx, 22, wallBottom - 78);
    }
    ctx.restore();

    const desk = ctx.createLinearGradient(0, wallBottom, 0, h);
    desk.addColorStop(0, '#C9D3DE');
    desk.addColorStop(0.35, '#B7C3D1');
    desk.addColorStop(1, '#9AABBD');
    ctx.fillStyle = desk;
    ctx.fillRect(0, wallBottom, w, deskH);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(0, wallBottom, w, 3);
    ctx.fillStyle = 'rgba(10, 31, 68, 0.12)';
    ctx.fillRect(0, h - 6, w, 6);
  };

  Game.prototype.drawWindow = function (ctx, x, y, w, h) {
    ctx.save();
    ctx.globalAlpha = this.lowFx ? 0.35 : 0.5;
    const sky = ctx.createLinearGradient(x, y, x, y + h);
    sky.addColorStop(0, '#B9D4EC');
    sky.addColorStop(1, '#F3E6C8');
    ctx.fillStyle = sky;
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x + w * 0.72, y + h * 0.28, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(10, 31, 68, 0.28)';
    ctx.lineWidth = 5;
    roundRectPath(ctx, x, y, w, h, 8);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 4);
    ctx.lineTo(x + w / 2, y + h - 4);
    ctx.moveTo(x + 4, y + h / 2);
    ctx.lineTo(x + w - 4, y + h / 2);
    ctx.stroke();
    ctx.restore();
  };

  Game.prototype.drawCalendar = function (ctx, x, y) {
    ctx.fillStyle = '#F5F7FA';
    roundRectPath(ctx, x, y, 36, 40, 4);
    ctx.fill();
    ctx.fillStyle = '#C0392B';
    ctx.fillRect(x, y, 36, 10);
    ctx.fillStyle = 'rgba(10, 31, 68, 0.2)';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillRect(x + 5 + c * 7, y + 15 + r * 7, 4, 4);
      }
    }
  };

  Game.prototype.drawShelf = function (ctx, x, y) {
    ctx.fillStyle = 'rgba(10, 31, 68, 0.18)';
    ctx.fillRect(x, y + 46, 62, 6);
    ctx.fillStyle = '#4A90C4';
    ctx.fillRect(x + 4, y + 12, 16, 34);
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(x + 22, y + 8, 14, 38);
    ctx.fillStyle = '#0A1F44';
    ctx.fillRect(x + 38, y + 16, 18, 30);
  };

  Game.prototype.drawPlant = function (ctx, x, y) {
    ctx.fillStyle = '#8A9A6A';
    ctx.beginPath();
    ctx.ellipse(x + 12, y, 8, 16, -0.4, 0, Math.PI * 2);
    ctx.ellipse(x + 20, y - 4, 7, 14, 0.3, 0, Math.PI * 2);
    ctx.ellipse(x + 15, y + 2, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C4A574';
    ctx.fillRect(x + 8, y + 14, 18, 14);
  };

  Game.prototype.drawClock = function (ctx, x, y, friday) {
    ctx.fillStyle = '#F5F7FA';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0A1F44';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    const hour = friday ? (Math.PI * 2) * (17.9 / 12) - Math.PI / 2 : -Math.PI / 2 + 0.55;
    const minute = friday ? (Math.PI * 2) * (55 / 60) - Math.PI / 2 : 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(hour) * 8, y + Math.sin(hour) * 8);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(minute) * 12, y + Math.sin(minute) * 12);
    ctx.stroke();
  };

  Game.prototype.drawBanner = function (ctx, now) {
    const t = Math.max(0, this.bannerUntil - now);
    const alpha = t > 300 ? 1 : t / 300;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10, 31, 68, 0.82)';
    const w = Math.min(this.width - 32, 360);
    const h = 76;
    const x = (this.width - w) / 2;
    const y = this.height * 0.28;
    roundRectPath(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.fillStyle = '#D4AF37';
    ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.bannerTitle, this.width / 2, y + 32);
    ctx.fillStyle = '#F5F7FA';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(this.bannerSub, this.width / 2, y + 54);
    ctx.restore();
  };

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  Game.prototype.boot = function () {
    const self = this;
    AudioManager.init();
    StorageService.migrateStorage();
    PlayerDataService.load();
    AchievementService.load();
    DailyChallengeService.getTodayChallenge();
    UI.init(this);
    UI.updateSoundButton();
    this.seedMenuBits();
    this.syncRotateHint();
    AnalyticsService.track('game_open');

    const minLoad = new Promise(function (resolve) {
      UI.runLoading(resolve);
    });
    const envInit = VKService.init();

    Promise.all([minLoad, envInit]).then(function () {
      self.state = 'menu';
      UI.renderProfile();
      UI.renderDailyCard();
      UI.show('menu');
      if (global.SyncService) {
        SyncService.syncOnBoot().then(function () {
          UI.renderProfile();
          UI.renderDailyCard();
          UI.maybeShowMerge();
        });
      }
    });

    if (APP_CONFIG.playerSpritesEnabled && PlayerSprites && PlayerSprites.preload) {
      PlayerSprites.preload();
    }

    this.loopIdle();
  };

  Game.prototype.seedMenuBits = function () {
    const kinds = ['doc', 'coin', 'calc', 'folder', 'chart'];
    this.menuBits = [];
    for (let i = 0; i < 5; i++) {
      this.menuBits.push({
        kind: kinds[i],
        x: 40 + Math.random() * 80,
        y: Math.random() * 100,
        s: 0.4 + Math.random() * 0.35,
        v: 8 + Math.random() * 10
      });
    }
  };

  Game.prototype.stopIdle = function () {
    if (this.idleRaf) {
      cancelAnimationFrame(this.idleRaf);
      this.idleRaf = 0;
    }
  };

  Game.prototype.ensureIdle = function () {
    if (this.state === 'playing') return;
    if (!this.idleRaf) this.loopIdle();
  };

  Game.prototype.loopIdle = function () {
    const self = this;
    const canvas = document.getElementById('menu-fx');
    this.stopIdle();
    const idle = function (ts) {
      if (self.state === 'playing') {
        self.idleRaf = 0;
        return;
      }
      if (!self.lowFx && canvas && (self.state === 'menu' || self.state === 'boot' || self.state === 'tutorial')) {
        self.drawMenuFx(canvas, ts);
      }
      self.idleRaf = requestAnimationFrame(idle);
    };
    this.idleRaf = requestAnimationFrame(idle);
  };

  Game.prototype.drawMenuFx = function (canvas, ts) {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const t = (ts || 0) / 1000;
    for (let i = 0; i < this.menuBits.length; i++) {
      const b = this.menuBits[i];
      const x = (b.x / 100) * w;
      const y = ((b.y + t * b.v) % 120) / 120 * (h + 40) - 20;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#D4AF37';
      if (b.kind === 'coin') {
        ctx.beginPath();
        ctx.arc(x, y, 8 * b.s * 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = b.kind === 'folder' ? '#4A90C4' : '#F5F7FA';
        ctx.fillRect(x, y, 28 * b.s, 36 * b.s);
      }
    }
    ctx.globalAlpha = 1;
  };

  function emptyStats() {
    return {
      documentsCaught: 0,
      paymentsCaught: 0,
      reportsCaught: 0,
      penaltiesHit: 0,
      fnsEventsCompleted: 0,
      bestCombo: 0,
      bonusesCaught: 0,
      eventsCompleted: 0,
      playTime: 0
    };
  }

  function detectLowFx() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return true;
      }
      const cores = navigator.hardwareConcurrency || 8;
      const narrow = Math.min(screen.width, screen.height) < 400;
      return cores <= 4 || narrow;
    } catch (err) {
      return false;
    }
  }

  global.Game = Game;

  document.addEventListener('DOMContentLoaded', function () {
    const game = new Game();
    global.game = game;
    game.boot();
  });
})(window);
