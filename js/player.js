/**
 * Бухгалтер-ниндзя: состояния, спрайты и fallback-отрисовка одного героя.
 * Образ: офисный бухгалтер с золотой повязкой, без маски и без оружия.
 */
(function (global) {
  'use strict';

  function Player() {
    this.width = 92;
    this.height = 124;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.baseSpeed = 7.2;
    this.facing = 1;
    this.bob = 0;
    this.blink = 0;
    this.playerState = 'idle';
    this.stateUntil = 0;
    this.lean = 0;
  }

  Player.prototype.reset = function (fieldWidth, fieldHeight) {
    this.x = fieldWidth / 2;
    this.y = fieldHeight - 18;
    this.vx = 0;
    this.facing = 1;
    this.bob = 0;
    this.playerState = 'idle';
    this.stateUntil = 0;
    this.lean = 0;
  };

  Player.prototype.setState = function (state, ms, now) {
    const t = now || (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.playerState = state;
    this.stateUntil = ms ? t + ms : 0;
  };

  Player.prototype.getSpeed = function (boosted, slowed) {
    let speed = this.baseSpeed;
    if (boosted) speed *= 1.38;
    if (slowed) speed *= 0.72;
    return speed;
  };

  Player.prototype.update = function (dt, bounds, moveLeft, moveRight, boosted, slowed, now) {
    const speed = this.getSpeed(boosted, slowed);
    this.vx = 0;
    if (moveLeft && !moveRight) {
      this.vx = -speed;
      this.facing = -1;
    } else if (moveRight && !moveLeft) {
      this.vx = speed;
      this.facing = 1;
    }

    this.x += this.vx * dt * 60;
    const half = this.width / 2;
    const minX = half + 8;
    const maxX = bounds.width - half - 8;
    if (this.x < minX) this.x = minX;
    if (this.x > maxX) this.x = maxX;

    this.y = bounds.floor || (bounds.height - 18);
    this.bob += dt * 5.2;
    this.blink += dt;
    this.lean += ((this.vx !== 0 ? this.facing * 0.1 : 0) - this.lean) * Math.min(1, dt * 10);

    const locked = this.stateUntil && now < this.stateUntil &&
      (this.playerState === 'hit' || this.playerState === 'happy' ||
        this.playerState === 'victory' || this.playerState === 'worried' ||
        this.playerState === 'tired');
    if (!locked) {
      if (this.vx < 0) this.playerState = 'moveLeft';
      else if (this.vx > 0) this.playerState = 'moveRight';
      else if (this.playerState === 'moveLeft' || this.playerState === 'moveRight' ||
        (this.stateUntil && now >= this.stateUntil)) {
        this.playerState = 'idle';
        this.stateUntil = 0;
      }
    }
  };

  Player.prototype.getBounds = function () {
    return {
      x: this.x - this.width / 2 + 8,
      y: this.y - this.height + 18,
      w: this.width - 16,
      h: this.height - 22
    };
  };

  Player.prototype.draw = function (ctx, time, ninjaMode) {
    const sprite = PlayerSprites && PlayerSprites.get(this.playerState);
    const y = this.y + Math.sin(this.bob) * 2.2;
    ctx.save();
    ctx.translate(this.x, y);
    if (ninjaMode) {
      ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
      ctx.shadowBlur = 14;
    }
    if (sprite) {
      const w = this.width + 8;
      const h = this.height + 8;
      const flipIdle = this.playerState === 'moveLeft' && !PlayerSprites.ready.moveLeft;
      if (flipIdle) ctx.scale(-1, 1);
      ctx.drawImage(sprite, -w / 2, -h + 8, w, h);
    } else {
      this.drawFallback(ctx);
    }
    ctx.restore();
  };

  Player.prototype.drawFallback = function (ctx) {
    const state = this.playerState;
    ctx.scale(this.facing, 1);
    ctx.rotate(this.lean * this.facing);

    const skin = '#E6C4A3';
    const skinShadow = '#D4AE8A';
    const hair = '#2C241C';
    const navy = '#0A1F44';
    const navyMid = '#16325C';
    const gold = '#D4AF37';
    const shirt = '#F7F4EE';
    const blinking = (this.blink % 4.4) > 4.22 && state === 'idle';
    const folderY = state === 'victory' ? -78 : -46;

    ctx.fillStyle = 'rgba(10, 31, 68, 0.14)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 28, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = navy;
    roundRect(ctx, -16, -24, 14, 28, 5);
    ctx.fill();
    roundRect(ctx, 2, -24, 14, 28, 5);
    ctx.fill();
    ctx.fillStyle = '#1A1A1A';
    roundRect(ctx, -17, 2, 15, 8, 3);
    ctx.fill();
    roundRect(ctx, 2, 2, 15, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#F5F7FA';
    ctx.fillRect(-15, 2, 11, 2);
    ctx.fillRect(4, 2, 11, 2);

    ctx.fillStyle = shirt;
    roundRect(ctx, -18, -62, 36, 42, 8);
    ctx.fill();
    ctx.fillStyle = navy;
    roundRect(ctx, -19, -56, 38, 34, 8);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(-8, -56);
    ctx.lineTo(0, -34);
    ctx.lineTo(8, -56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.fillRect(-2, -54, 4, 20);

    ctx.fillStyle = skin;
    roundRect(ctx, -6, -70, 12, 12, 4);
    ctx.fill();

    ctx.fillStyle = shirt;
    roundRect(ctx, -26, -54, 11, 26, 6);
    ctx.fill();
    roundRect(ctx, 15, -54, 11, 26, 6);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(-20, -26, 5.2, 0, Math.PI * 2);
    ctx.arc(20, -26, 5.2, 0, Math.PI * 2);
    ctx.fill();

    drawFolder(ctx, folderY, gold, shirt);

    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(0, -88, 21, 20, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-16, -80, 7, 12, -0.35, 0, Math.PI * 2);
    ctx.ellipse(16, -80, 7, 12, 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, -80, 18, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skinShadow;
    ctx.beginPath();
    ctx.ellipse(8, -74, 7, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(-10, -94, 9, 6, -0.4, 0, Math.PI * 2);
    ctx.ellipse(6, -96, 11, 7, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-18, -88);
    ctx.quadraticCurveTo(-4, -94, 4, -88);
    ctx.quadraticCurveTo(-6, -86, -18, -88);
    ctx.fill();

    ctx.fillStyle = gold;
    roundRect(ctx, -19, -87, 38, 7, 3);
    ctx.fill();
    ctx.fillStyle = navy;
    ctx.fillRect(-19, -85, 38, 2);
    ctx.fillStyle = gold;
    roundRect(ctx, 14, -94, 10, 16, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, -88);
    ctx.lineTo(34, -78);
    ctx.lineTo(31, -76);
    ctx.lineTo(22, -82);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22, -84);
    ctx.lineTo(36, -90);
    ctx.lineTo(34, -93);
    ctx.lineTo(22, -86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = navy;
    ctx.fillRect(17, -92, 4, 12);

    drawFace(ctx, state, blinking);

    if (state === 'tired') {
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(26, -38, 8, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6F4E37';
      roundRect(ctx, 22, -50, 8, 12, 2);
      ctx.fill();
    }

    if (state === 'hit') {
      ctx.fillStyle = 'rgba(192, 57, 43, 0.18)';
      ctx.beginPath();
      ctx.ellipse(0, -48, 36, 48, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  function drawFolder(ctx, y, gold, paper) {
    ctx.fillStyle = 'rgba(10, 31, 68, 0.08)';
    roundRect(ctx, -26, y + 8, 52, 6, 2);
    ctx.fill();
    ctx.fillStyle = paper;
    roundRect(ctx, -24, y, 48, 14, 4);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#EEF3F8';
    ctx.fillRect(-18, y + 3, 36, 2);
    ctx.fillRect(-18, y + 7, 28, 2);
    ctx.fillStyle = gold;
    roundRect(ctx, -6, y - 3, 12, 5, 1);
    ctx.fill();
  }

  function drawFace(ctx, state, blinking) {
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(-7, -80, 6.2, 0, Math.PI * 2);
    ctx.arc(7, -80, 6.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1, -80);
    ctx.lineTo(1, -80);
    ctx.stroke();

    if (blinking) {
      ctx.beginPath();
      ctx.moveTo(-11, -80);
      ctx.lineTo(-3, -80);
      ctx.moveTo(3, -80);
      ctx.lineTo(11, -80);
      ctx.stroke();
    } else if (state === 'tired') {
      ctx.beginPath();
      ctx.arc(-7, -79, 3.2, 0.15, Math.PI - 0.15);
      ctx.arc(7, -79, 3.2, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath();
      ctx.arc(-7, -80, 2.1, 0, Math.PI * 2);
      ctx.arc(7, -80, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-6, -81, 0.8, 0, Math.PI * 2);
      ctx.arc(8, -81, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (state === 'worried') {
      ctx.moveTo(-12, -90);
      ctx.lineTo(-4, -87);
      ctx.moveTo(12, -90);
      ctx.lineTo(4, -87);
      ctx.stroke();
    } else if (state === 'happy' || state === 'victory') {
      ctx.moveTo(-12, -88);
      ctx.quadraticCurveTo(-7, -91, -3, -88);
      ctx.moveTo(12, -88);
      ctx.quadraticCurveTo(7, -91, 3, -88);
      ctx.stroke();
    }

    ctx.beginPath();
    if (state === 'happy' || state === 'victory') {
      ctx.arc(0, -71, 6.5, 0.15, Math.PI - 0.15);
    } else if (state === 'worried' || state === 'hit') {
      ctx.moveTo(-5, -70);
      ctx.quadraticCurveTo(0, -67, 5, -70);
    } else if (state === 'tired') {
      ctx.arc(0, -71, 5, 0.3, Math.PI - 0.3);
    } else {
      ctx.arc(0, -71, 5.2, 0.22, Math.PI - 0.22);
    }
    ctx.stroke();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  global.Player = Player;
})(window);
