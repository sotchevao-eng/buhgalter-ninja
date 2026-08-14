/**
 * Карточка результата 1080×1350 (4:5) через Canvas, без скриншота DOM.
 */
(function (global) {
  'use strict';

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

  function generateResultCard(data) {
    data = data || {};
    return new Promise(function (resolve) {
      try {
        const width = 1080;
        const height = 1350;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const score = Number(data.score) || 0;
        const level = Number(data.level) || 1;
        const combo = Number(data.combo || data.maxCombo) || 0;
        const rank = data.rank || (typeof getRank === 'function' ? getRank(score) : { title: 'Бухгалтер', icon: '🥷' });
        const community = (APP_CONFIG && APP_CONFIG.communityName) || 'Налоговая не страшна';

        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, '#13284f');
        bg.addColorStop(0.55, '#0A1F44');
        bg.addColorStop(1, '#071428');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(212, 175, 55, 0.16)';
        ctx.beginPath();
        ctx.arc(180, 160, 220, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(74, 144, 196, 0.14)';
        ctx.beginPath();
        ctx.arc(940, 1180, 260, 0, Math.PI * 2);
        ctx.fill();

        roundRect(ctx, 72, 72, width - 144, height - 144, 48);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#D4AF37';
        ctx.font = '700 42px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('БУХГАЛТЕР-НИНДЗЯ', width / 2, 200);

        if (data.isNewRecord) {
          ctx.fillStyle = '#F5D76E';
          ctx.font = '800 36px "Segoe UI", system-ui, sans-serif';
          ctx.fillText('🏆 НОВЫЙ РЕКОРД', width / 2, 268);
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 132px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(score.toLocaleString('ru-RU'), width / 2, data.isNewRecord ? 460 : 430);
        ctx.fillStyle = 'rgba(245, 247, 250, 0.86)';
        ctx.font = '700 44px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('ОЧКОВ', width / 2, 500);

        ctx.font = '120px "Segoe UI Emoji", "Segoe UI", sans-serif';
        ctx.fillText(rank.icon || '🥷', width / 2, 680);

        ctx.fillStyle = '#D4AF37';
        ctx.font = '800 52px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(String(rank.title || 'Бухгалтер-ниндзя').toUpperCase(), width / 2, 770);

        ctx.fillStyle = '#F5F7FA';
        ctx.font = '700 40px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('Уровень ' + level, width / 2, 880);
        ctx.fillText('Combo ×' + combo, width / 2, 950);

        ctx.fillStyle = 'rgba(245, 247, 250, 0.7)';
        ctx.font = '600 34px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(community, width / 2, 1160);

        const dataURL = canvas.toDataURL('image/png');
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            resolve({ canvas: canvas, blob: blob || null, dataURL: dataURL });
          }, 'image/png');
        } else {
          resolve({ canvas: canvas, blob: null, dataURL: dataURL });
        }
      } catch (err) {
        resolve({ canvas: null, blob: null, dataURL: '' });
      }
    });
  }

  global.generateResultCard = generateResultCard;
})(window);
