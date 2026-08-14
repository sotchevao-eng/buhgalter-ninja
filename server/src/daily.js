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

function runValue(run, key) {
  run = run || {};
  if (key === 'cleanScore') {
    return run.lostLifeThisRun ? 0 : (Number(run.score) || 0);
  }
  const map = {
    documentsCaught: Number(run.documentsCaught) || 0,
    maxCombo: Number(run.bestCombo || run.maxCombo) || 0,
    paymentsCaught: Number(run.paymentsCaught) || 0,
    bonusesCaught: Number(run.bonusesCaught) || 0,
    level: Number(run.level) || 0,
    score: Number(run.score) || 0
  };
  return map[key] || 0;
}

module.exports = {
  POOL,
  hashDate,
  pickForDate,
  runValue
};
