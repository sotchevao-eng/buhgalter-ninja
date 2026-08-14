/**
 * Падающие карточки документов, частицы и всплывающий текст.
 */
(function (global) {
  'use strict';

  function FallingObject(typeId, x, speed, fieldWidth) {
    const def = OBJECT_TYPES[typeId];
    this.id = typeId;
    this.def = def;
    this.category = def.category;
    this.x = x;
    this.y = -44;
    this.speed = speed * (def.urgent ? 1.35 : 1);
    const size = Math.max(58, Math.min(74, (fieldWidth || 360) * 0.145));
    this.w = size;
    this.h = size + 16;
    this.dead = false;
    this.swing = Math.random() * Math.PI * 2;
    this.rot = (Math.random() - 0.5) * 0.12;
    this.appear = 0;
    this.ttl = def.urgent ? 5200 : 0;
  }

  FallingObject.prototype.update = function (dt, animScale) {
    const k = animScale || 1;
    this.y += this.speed * dt * 60 * k;
    this.swing += dt * 2.4 * k;
    if (this.appear < 1) this.appear = Math.min(1, this.appear + dt * 4);
    if (this.ttl > 0) {
      this.ttl -= dt * 1000;
      if (this.ttl <= 0) this.expired = true;
    }
  };

  FallingObject.prototype.getBounds = function () {
    return {
      x: this.x - this.w / 2 + 6,
      y: this.y - this.h / 2 + 6,
      w: this.w - 12,
      h: this.h - 10
    };
  };

  FallingObject.prototype.draw = function (ctx) {
    const def = this.def;
    const s = 0.72 + this.appear * 0.28;
    const wobble = Math.sin(this.swing) * 4;
    const hw = this.w / 2;
    const hh = this.h / 2;

    ctx.save();
    ctx.translate(this.x + wobble, this.y);
    ctx.rotate(this.rot + Math.sin(this.swing) * 0.05);
    ctx.scale(s, s);
    ctx.globalAlpha = this.appear;

    if (def.gold) {
      ctx.shadowColor = 'rgba(212, 175, 55, 0.55)';
      ctx.shadowBlur = 14;
    } else if (def.category === 'bonus') {
      ctx.shadowColor = 'rgba(212, 175, 55, 0.28)';
      ctx.shadowBlur = 8;
    }

    const radius = def.category === 'bonus' ? Math.min(hw, hh) : def.category === 'bad' ? 5 : 12;
    ctx.fillStyle = def.category === 'bad' ? '#FFF8F6' : '#FFFFFF';
    roundRect(ctx, -hw, -hh, this.w, this.h, radius);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (def.category === 'bad') {
      ctx.beginPath();
      ctx.moveTo(-10, -hh + 2);
      ctx.lineTo(0, -hh - 8);
      ctx.lineTo(10, -hh + 2);
      ctx.closePath();
      ctx.fillStyle = '#C0392B';
      ctx.fill();
    }

    ctx.strokeStyle = def.gold
      ? '#D4AF37'
      : def.urgent
        ? '#C0392B'
        : def.category === 'bad'
          ? '#C0392B'
          : def.category === 'bonus'
            ? '#D4AF37'
            : '#4A90C4';
    ctx.lineWidth = def.category === 'bonus' ? 2.4 : 1.6;
    ctx.stroke();

    if (def.category === 'bonus' && !def.gold) {
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
      ctx.lineWidth = 1;
      roundRect(ctx, -hw + 4, -hh + 4, this.w - 8, this.h - 8, Math.max(4, radius - 4));
      ctx.stroke();
    }

    const barH = 5;
    ctx.fillStyle = def.category === 'bad'
      ? 'rgba(192, 57, 43, 0.85)'
      : def.gold || def.category === 'bonus'
        ? 'rgba(212, 175, 55, 0.9)'
        : def.urgent
          ? 'rgba(192, 57, 43, 0.8)'
          : 'rgba(74, 144, 196, 0.75)';
    roundRect(ctx, -hw, -hh, this.w, barH + 6, radius);
    ctx.fill();
    ctx.fillStyle = def.category === 'bad' ? '#FFF8F6' : '#FFFFFF';
    ctx.fillRect(-hw, -hh + barH + 2, this.w, 8);

    ctx.font = '26px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, 0, -6);

    ctx.fillStyle = def.category === 'bad' ? '#7A1F18' : '#0A1F44';
    ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
    const label = def.urgent ? '🔥 СРОЧНО' : (def.shortLabel || def.label);
    wrapLabel(ctx, label, 0, hh - 16, this.w - 10);

    if (def.urgent && this.ttl > 0) {
      const p = Math.max(0, this.ttl / 5200);
      ctx.fillStyle = 'rgba(10, 31, 68, 0.12)';
      ctx.fillRect(-hw + 8, hh - 8, this.w - 16, 3);
      ctx.fillStyle = '#C0392B';
      ctx.fillRect(-hw + 8, hh - 8, (this.w - 16) * p, 3);
    }

    ctx.restore();
  };

  function wrapLabel(ctx, text, x, y, maxW) {
    if (ctx.measureText(text).width <= maxW) {
      ctx.fillText(text, x, y);
      return;
    }
    const parts = text.split(' ');
    if (parts.length > 1) {
      ctx.fillText(parts[0], x, y - 6);
      ctx.fillText(parts.slice(1).join(' '), x, y + 6);
    } else {
      ctx.fillText(text, x, y);
    }
  }

  function Particle(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4.2;
    this.vy = (Math.random() - 0.8) * 3.8;
    this.life = 1;
    this.size = 2 + Math.random() * 3;
    this.color = color || '#D4AF37';
    this.dead = false;
  }

  Particle.prototype.update = function (dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vy += 8 * dt;
    this.life -= dt * 1.9;
    if (this.life <= 0) this.dead = true;
  };

  Particle.prototype.draw = function (ctx) {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  function FloatingText(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color || '#0A1F44';
    this.life = 1;
    this.dead = false;
  }

  FloatingText.prototype.update = function (dt) {
    this.y -= 36 * dt;
    this.life -= dt * 0.7;
    if (this.life <= 0) this.dead = true;
  };

  FloatingText.prototype.draw = function (ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 4;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  };

  function spawnParticles(list, x, y, color, count, cap) {
    const room = Math.max(0, (cap || 70) - list.length);
    const n = Math.min(count || 8, room);
    for (let i = 0; i < n; i++) list.push(new Particle(x, y, color));
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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

  global.FallingObject = FallingObject;
  global.Particle = Particle;
  global.FloatingText = FloatingText;
  global.spawnParticles = spawnParticles;
  global.aabb = aabb;
})(window);
