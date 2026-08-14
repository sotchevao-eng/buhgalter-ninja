'use strict';

const CAREER_RANKS = [
  { min: 1, title: 'Стажёр', icon: '📎' },
  { min: 3, title: 'Помощник бухгалтера', icon: '🗂️' },
  { min: 5, title: 'Бухгалтер', icon: '📘' },
  { min: 10, title: 'Опытный бухгалтер', icon: '📊' },
  { min: 15, title: 'Ведущий бухгалтер', icon: '📁' },
  { min: 20, title: 'Главбух', icon: '🏅' },
  { min: 30, title: 'Бухгалтер-ниндзя', icon: '🥷' },
  { min: 50, title: 'Легенда отчётности', icon: '🏆' }
];

function getXPRequiredForLevel(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return Math.round(48 * Math.pow(lv, 1.27) + 18 * lv);
}

function getCareerRank(playerLevel) {
  let rank = CAREER_RANKS[0];
  const level = Math.max(1, Number(playerLevel) || 1);
  for (let i = 0; i < CAREER_RANKS.length; i++) {
    if (level >= CAREER_RANKS[i].min) rank = CAREER_RANKS[i];
  }
  return rank;
}

function applyXP(xp, playerLevel, amount) {
  let nextXp = Math.max(0, Number(xp) || 0) + Math.max(0, Math.floor(Number(amount) || 0));
  let nextLevel = Math.max(1, Math.floor(Number(playerLevel) || 1));
  let guard = 0;
  while (guard < 80) {
    const need = getXPRequiredForLevel(nextLevel);
    if (nextXp < need) break;
    nextXp -= need;
    nextLevel += 1;
    guard += 1;
  }
  return {
    xp: nextXp,
    playerLevel: nextLevel,
    rank: getCareerRank(nextLevel).title
  };
}

function xpFromRun(score, eventsCompleted, extraAchievements) {
  const base = Math.floor(Math.max(0, Number(score) || 0) / 10);
  const events = Math.max(0, Number(eventsCompleted) || 0) * 10;
  const ach = Math.max(0, Number(extraAchievements) || 0) * 20;
  return base + events + ach;
}

module.exports = {
  CAREER_RANKS,
  getXPRequiredForLevel,
  getCareerRank,
  applyXP,
  xpFromRun
};
