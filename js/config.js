/**
 * Конфигурация игры «Бухгалтер-ниндзя».
 * Игровая логика читает константы отсюда, а не из интеграционного слоя.
 */
(function (global) {
  'use strict';

  const APP_VERSION = '0.9.0';
  const DEBUG = false;
  const PLAYTEST_MODE = false;
  const STORAGE_VERSION = 2;

  const APP_STATE = {
    LOADING: 'boot',
    MENU: 'menu',
    TUTORIAL: 'tutorial',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
    ACHIEVEMENTS: 'achievements',
    LEADERBOARD: 'leaderboard',
    ABOUT: 'about',
    HOWTO: 'howto',
    PROFILE: 'profile'
  };

  const APP_CONFIG = {
    appName: 'Бухгалтер-ниндзя',
    communityName: 'Налоговая не страшна',
    version: APP_VERSION,
    environment: '',
    communityUrl: '',
    vkAppId: '',
    vkGroupId: '',
    appLaunchUrl: '',
    vkEnabled: true,
    vkProfileEnabled: true,
    sharingEnabled: true,
    apiBaseUrl: '',
    leaderboardEnabled: true,
    challengesEnabled: false,
    achievementsEnabled: true,
    shareEnabled: true,
    playerSpritesEnabled: false,
    vkInitTimeoutMs: 2500,
    debug: false,
    mockVKUser: null,
    configIssues: []
  };

  const FEATURES = {
    onlineLeaderboard: true,
    cloudSync: true,
    sharing: true,
    challenges: false,
    vkProfile: true,
    analytics: true
  };

  function isLocalHostName(host) {
    const value = String(host || '').toLowerCase();
    return !value || value === 'localhost' || value === '127.0.0.1';
  }

  function isUnsafeProductionUrl(url) {
    const value = String(url || '');
    if (!value) return false;
    return /localhost|127\.0\.0\.1|^http:\/\/|^file:/i.test(value);
  }

  function applyRuntimeConfig(raw) {
    raw = raw || global.RUNTIME_CONFIG || {};
    ['environment', 'apiBaseUrl', 'communityUrl', 'vkAppId', 'vkGroupId', 'appLaunchUrl'].forEach(function (key) {
      if (raw[key]) APP_CONFIG[key] = String(raw[key]);
    });
    if (!APP_CONFIG.environment) {
      try {
        APP_CONFIG.environment = isLocalHostName(window.location.hostname) ? 'development' : 'production';
      } catch (err) {
        APP_CONFIG.environment = 'development';
      }
    }
    if (APP_CONFIG.environment === 'production') {
      global.DEBUG = false;
      global.PLAYTEST_MODE = false;
      APP_CONFIG.debug = false;
      APP_CONFIG.mockVKUser = null;
      if (isUnsafeProductionUrl(APP_CONFIG.apiBaseUrl)) APP_CONFIG.apiBaseUrl = '';
      if (isUnsafeProductionUrl(APP_CONFIG.communityUrl)) APP_CONFIG.communityUrl = '';
      if (isUnsafeProductionUrl(APP_CONFIG.appLaunchUrl)) APP_CONFIG.appLaunchUrl = '';
    }
    FEATURES.onlineLeaderboard = APP_CONFIG.leaderboardEnabled !== false;
    FEATURES.cloudSync = !!APP_CONFIG.apiBaseUrl;
    FEATURES.sharing = APP_CONFIG.sharingEnabled !== false && APP_CONFIG.shareEnabled !== false;
    FEATURES.challenges = !!APP_CONFIG.challengesEnabled;
    FEATURES.vkProfile = APP_CONFIG.vkProfileEnabled !== false;
    APP_CONFIG.version = APP_VERSION;
    APP_CONFIG.debug = !!global.DEBUG;
    validateConfig();
    return APP_CONFIG;
  }

  function validateConfig() {
    const issues = [];
    const production = APP_CONFIG.environment === 'production';
    if (production) {
      if (global.DEBUG) {
        issues.push({ level: 'error', code: 'DEBUG_ON', message: 'DEBUG must be false in production' });
      }
      if (global.PLAYTEST_MODE) {
        issues.push({ level: 'error', code: 'PLAYTEST_ON', message: 'PLAYTEST_MODE must be false in production' });
      }
      if (APP_CONFIG.mockVKUser) {
        issues.push({ level: 'error', code: 'MOCK_VK', message: 'mockVKUser must be disabled in production' });
      }
      if (!APP_CONFIG.apiBaseUrl) {
        issues.push({ level: 'warn', code: 'NO_API', message: 'apiBaseUrl empty: Local Mode' });
      } else if (isUnsafeProductionUrl(APP_CONFIG.apiBaseUrl)) {
        issues.push({ level: 'error', code: 'UNSAFE_API', message: 'apiBaseUrl is not a production HTTPS URL' });
      }
      if (!APP_CONFIG.vkAppId) {
        issues.push({ level: 'warn', code: 'NO_VK_APP', message: 'vkAppId empty: Guest Mode' });
      }
      if (!APP_CONFIG.communityUrl) {
        issues.push({ level: 'warn', code: 'NO_COMMUNITY', message: 'communityUrl empty' });
      }
      if (!APP_CONFIG.appLaunchUrl) {
        issues.push({ level: 'warn', code: 'NO_FRONTEND', message: 'appLaunchUrl empty' });
      }
    }
    APP_CONFIG.configIssues = issues;
    return issues;
  }

  const COLORS = {
    navy: '#0A1F44',
    gold: '#D4AF37',
    blue: '#4A90C4',
    light: '#F5F7FA',
    white: '#FFFFFF',
    graphite: '#1A1A1A',
    danger: '#C0392B',
    success: '#2E8B57'
  };

  const LEVEL_NAMES = {
    1: 'Обычный рабочий день',
    2: 'Закрытие месяца',
    3: 'Зарплата',
    4: 'НДС',
    5: 'Отчётный период',
    6: 'Квартальная отчётность',
    7: 'Годовой отчёт'
  };

  function getLevelName(level) {
    if (level >= 8) return 'Режим главбуха';
    return LEVEL_NAMES[level] || 'Рабочий день';
  }

  const GOOD_MESSAGES = ['+10', '+20', 'Отлично!', 'Есть!', 'Сошлось!'];
  const BAD_MESSAGES = ['-1 ❤️', 'Ой!', 'Нет подписи!', 'Штраф!'];

  const OBJECT_TYPES = {
    pervichka: {
      id: 'pervichka',
      category: 'good',
      emoji: '📄',
      label: 'Первичка',
      score: 10,
      message: 'Первичка спасена!'
    },
    akt: {
      id: 'akt',
      category: 'good',
      emoji: '🧾',
      label: 'Акт сверки',
      shortLabel: 'Акт',
      score: 15,
      message: 'Сверка закрыта!'
    },
    schet: {
      id: 'schet',
      category: 'good',
      emoji: '📑',
      label: 'Счёт',
      score: 10,
      message: 'Всё сошлось!'
    },
    oplata: {
      id: 'oplata',
      category: 'good',
      emoji: '💰',
      label: 'Оплата',
      score: 20,
      message: 'Деньги пришли!',
      boostCombo: true
    },
    otchet: {
      id: 'otchet',
      category: 'good',
      emoji: '✅',
      label: 'Отчёт сдан',
      shortLabel: 'Отчёт',
      score: 25,
      message: 'Отчёт принят!'
    },
    edo: {
      id: 'edo',
      category: 'good',
      emoji: '📨',
      label: 'ЭДО',
      score: 15,
      message: 'Красиво!'
    },
    zakryvashka: {
      id: 'zakryvashka',
      category: 'good',
      emoji: '📋',
      label: 'Закрывашка',
      score: 15,
      message: 'Баланс идеален!'
    },
    fns: {
      id: 'fns',
      category: 'bad',
      emoji: '🚨',
      label: 'Требование ФНС',
      shortLabel: 'ФНС',
      effect: 'life',
      message: 'Требование пришло.'
    },
    kassoviy: {
      id: 'kassoviy',
      category: 'bad',
      emoji: '📉',
      label: 'Кассовый разрыв',
      shortLabel: 'Касса',
      effect: 'life',
      message: 'Касса не сходится!'
    },
    shtraf: {
      id: 'shtraf',
      category: 'bad',
      emoji: '💸',
      label: 'Штраф',
      effect: 'life',
      message: 'Опять штраф...'
    },
    noSign: {
      id: 'noSign',
      category: 'bad',
      emoji: '⚠️',
      label: 'Нет подписи',
      effect: 'life',
      message: 'Где подпись?!'
    },
    hang1c: {
      id: 'hang1c',
      category: 'bad',
      emoji: '💻',
      label: '1С зависла',
      shortLabel: '1С',
      effect: 'slow',
      message: '1С решила подумать.'
    },
    proverka: {
      id: 'proverka',
      category: 'bad',
      emoji: '🕵️',
      label: 'Проверка',
      effect: 'life',
      message: 'Вот и закончился спокойный день.'
    },
    coffee: {
      id: 'coffee',
      category: 'bonus',
      emoji: '☕',
      label: 'Кофе',
      effect: 'speed',
      message: 'Кофе активирован!'
    },
    ideal: {
      id: 'ideal',
      category: 'bonus',
      emoji: '🌟',
      label: 'Идеальная первичка',
      shortLabel: 'Идеал',
      score: 50,
      message: 'Главбух одобряет.'
    },
    autosverka: {
      id: 'autosverka',
      category: 'bonus',
      emoji: '🔄',
      label: 'Автосверка',
      shortLabel: 'Сверка',
      effect: 'collectAll',
      message: 'Всё сошлось!'
    },
    otsrochka: {
      id: 'otsrochka',
      category: 'bonus',
      emoji: '⏰',
      label: 'Отсрочка',
      effect: 'slowFall',
      message: 'Отсрочка получена!'
    },
    pereplata: {
      id: 'pereplata',
      category: 'bonus',
      emoji: '💎',
      label: 'Переплата',
      effect: 'life',
      message: 'Жизнь восстановлена!'
    },
    srochno: {
      id: 'srochno',
      category: 'good',
      emoji: '🔥',
      label: 'Срочно',
      score: 30,
      urgent: true,
      message: 'Срочный документ принят!'
    },
    goldDoc: {
      id: 'goldDoc',
      category: 'good',
      emoji: '🌟',
      label: 'Золотая первичка',
      shortLabel: 'Золото',
      score: 100,
      gold: true,
      message: 'ИДЕАЛЬНЫЙ ДОКУМЕНТ!'
    },
    zeroDecl: {
      id: 'zeroDecl',
      category: 'bonus',
      emoji: '✨',
      label: 'Всё по нулям',
      shortLabel: 'Нули',
      score: 40,
      message: '✨ Всё по нулям'
    }
  };

  const GOOD_IDS = ['pervichka', 'akt', 'schet', 'oplata', 'otchet', 'edo', 'zakryvashka'];
  const BAD_IDS = ['fns', 'kassoviy', 'shtraf', 'noSign', 'hang1c', 'proverka'];
  const BONUS_IDS = ['coffee', 'ideal', 'autosverka', 'otsrochka', 'pereplata'];
  const MONTH_CLOSE_IDS = ['akt', 'zakryvashka', 'oplata', 'pervichka'];

  const EVENTS = {
    clientDocs: {
      id: 'clientDocs',
      title: 'КЛИЕНТ ПРИСЛАЛ ПЕРВИЧКУ',
      message: 'И всё это, конечно, вечером.',
      duration: 9000,
      kind: 'event'
    },
    friday: {
      id: 'friday',
      title: 'ПЯТНИЦА  17:55',
      message: 'Тут совсем немного документов...',
      duration: 8000,
      hold: 1400,
      kind: 'event'
    },
    monthClose: {
      id: 'monthClose',
      title: 'ЗАКРЫТИЕ МЕСЯЦА',
      message: 'Акты, закрывашки, оплаты — не зевайте.',
      duration: 12000,
      kind: 'event'
    },
    update1c: {
      id: 'update1c',
      title: '1С ОБНОВЛЯЕТСЯ...',
      message: 'Подождите, это может занять минуту. Или две.',
      duration: 5000,
      kind: 'event'
    },
    fnsDemand: {
      id: 'fnsDemand',
      title: 'ТРЕБОВАНИЕ ФНС',
      message: 'Проверка усилилась. Будьте осторожны!',
      duration: 8000,
      kind: 'event'
    },
    payday: {
      id: 'payday',
      title: 'День зарплаты',
      message: 'Оплаты идут — следите за кассой!',
      duration: 9000,
      kind: 'event'
    },
    nds: {
      id: 'nds',
      title: 'Сдаём НДС',
      message: 'До сдачи декларации осталось совсем немного!',
      duration: 8000,
      kind: 'event'
    }
  };

  const RANKS = [
    { min: 0, title: 'Стажёр', icon: '📎' },
    { min: 500, title: 'Бухгалтер', icon: '📘' },
    { min: 1500, title: 'Опытный бухгалтер', icon: '📊' },
    { min: 3000, title: 'Главбух', icon: '🏅' },
    { min: 5000, title: 'Бухгалтер-ниндзя', icon: '🥷' },
    { min: 10000, title: 'Легенда отчётного периода', icon: '🏆' }
  ];

  function getRank(score) {
    let rank = RANKS[0];
    for (let i = 0; i < RANKS.length; i++) {
      if (score >= RANKS[i].min) rank = RANKS[i];
    }
    return rank;
  }

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

  function getCareerRank(playerLevel) {
    let rank = CAREER_RANKS[0];
    const level = Math.max(1, Number(playerLevel) || 1);
    for (let i = 0; i < CAREER_RANKS.length; i++) {
      if (level >= CAREER_RANKS[i].min) rank = CAREER_RANKS[i];
    }
    return rank;
  }

  function getXPRequiredForLevel(level) {
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    return Math.round(48 * Math.pow(lv, 1.27) + 18 * lv);
  }

  const COMBO_MILESTONES = {
    5: 'Отличная работа!',
    10: 'Бухгалтер-профи!',
    20: 'БУХГАЛТЕР-НИНДЗЯ!'
  };

  function getComboMultiplier(combo) {
    if (combo >= 20) return 2;
    if (combo >= 10) return 1.5;
    if (combo >= 5) return 1.25;
    return 1;
  }

  function getDifficulty(level, playTime) {
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    const t = Number(playTime) || 0;
    const early = t < 20;
    const bad = early ? 0.14 : Math.min(0.30, 0.16 + (lv - 1) * 0.016);
    const bonus = early ? 0.055 : Math.min(0.09, 0.07);
    return {
      level: lv,
      early: early,
      fallSpeed: Math.min(3.15, (early ? 1.59 : 1.96) + (lv - 1) * 0.11),
      spawnMs: Math.max(520, (early ? 1450 : 1120) - (lv - 1) * 40),
      good: Math.max(0.55, 1 - bad - bonus),
      bad: bad,
      bonus: bonus,
      maxObjects: early ? 4 : Math.min(9, 5 + Math.floor((lv - 1) / 2)),
      goldChance: 0.006,
      srochnoChance: early ? 0.018 : 0.042,
      zeroDeclChance: 0.0035
    };
  }

  function getSpawnWeights(level, eventId, playTime) {
    const d = getDifficulty(level, playTime);
    let good = d.good;
    let bad = d.bad;
    let bonus = d.bonus;

    if (eventId === 'fnsDemand' || eventId === 'bossFns') {
      bad += 0.1;
      good -= 0.07;
      bonus -= 0.03;
    } else if (eventId === 'payday') {
      bad += 0.06;
      good -= 0.04;
      bonus -= 0.02;
    } else if (eventId === 'monthClose' || eventId === 'friday' || eventId === 'clientDocs' || eventId === 'bossDeadline' || eventId === 'bossQuarter') {
      good += 0.08;
      bad -= 0.05;
      bonus -= 0.03;
    }

    const sum = Math.max(0.01, good + bad + bonus);
    return { good: good / sum, bad: bad / sum, bonus: bonus / sum };
  }

  function pickGoodId(eventId) {
    if (eventId === 'payday' && Math.random() < 0.55) return 'oplata';
    if (eventId === 'nds' && Math.random() < 0.35) return 'otchet';
    if (eventId === 'monthClose') {
      return MONTH_CLOSE_IDS[Math.floor(Math.random() * MONTH_CLOSE_IDS.length)];
    }
    if (eventId === 'clientDocs' && Math.random() < 0.5) return 'pervichka';
    if ((eventId === 'bossFns' || eventId === 'fnsDemand') && Math.random() < 0.62) {
      const need = ['pervichka', 'akt', 'otchet'];
      return need[Math.floor(Math.random() * need.length)];
    }
    return GOOD_IDS[Math.floor(Math.random() * GOOD_IDS.length)];
  }

  function pickBadId(eventId) {
    if (eventId === 'payday' && Math.random() < 0.5) return 'kassoviy';
    if (eventId === 'fnsDemand' && Math.random() < 0.45) return 'fns';
    return BAD_IDS[Math.floor(Math.random() * BAD_IDS.length)];
  }

  function pickBonusId() {
    return BONUS_IDS[Math.floor(Math.random() * BONUS_IDS.length)];
  }

  function getSpawnInterval(level, eventId, playTime) {
    let base = getDifficulty(level, playTime).spawnMs;
    if (eventId === 'monthClose' || eventId === 'friday' || eventId === 'clientDocs') return Math.max(480, base * 0.55);
    if (eventId === 'bossDeadline' || eventId === 'bossQuarter') return Math.max(460, base * 0.52);
    if (eventId === 'payday') return Math.max(500, base * 0.7);
    if (eventId === 'fnsDemand' || eventId === 'bossFns') return Math.max(500, base * 0.78);
    if (eventId === 'update1c') return base * 1.2;
    return base;
  }

  function getFallSpeed(level, eventId, delayed, playTime) {
    let speed = getDifficulty(level, playTime).fallSpeed;
    if (eventId === 'nds' || eventId === 'friday' || eventId === 'clientDocs') speed *= 1.18;
    if (eventId === 'monthClose' || eventId === 'bossQuarter') speed *= 1.12;
    if (eventId === 'update1c') speed *= 0.88;
    if (delayed) speed *= 0.62;
    return Math.min(3.2, speed);
  }

  global.APP_VERSION = APP_VERSION;
  global.DEBUG = DEBUG;
  global.PLAYTEST_MODE = PLAYTEST_MODE;
  global.STORAGE_VERSION = STORAGE_VERSION;
  global.APP_STATE = APP_STATE;
  global.APP_CONFIG = APP_CONFIG;
  global.FEATURES = FEATURES;
  global.applyRuntimeConfig = applyRuntimeConfig;
  global.validateConfig = validateConfig;
  global.COLORS = COLORS;
  global.OBJECT_TYPES = OBJECT_TYPES;
  global.GOOD_IDS = GOOD_IDS;
  global.BAD_IDS = BAD_IDS;
  global.BONUS_IDS = BONUS_IDS;
  global.EVENTS = EVENTS;
  global.COMBO_MILESTONES = COMBO_MILESTONES;
  global.GOOD_MESSAGES = GOOD_MESSAGES;
  global.BAD_MESSAGES = BAD_MESSAGES;
  global.getLevelName = getLevelName;
  global.getComboMultiplier = getComboMultiplier;
  global.getDifficulty = getDifficulty;
  global.getSpawnWeights = getSpawnWeights;
  global.pickGoodId = pickGoodId;
  global.pickBadId = pickBadId;
  global.pickBonusId = pickBonusId;
  global.getSpawnInterval = getSpawnInterval;
  global.getFallSpeed = getFallSpeed;
  global.getRank = getRank;
  global.getCareerRank = getCareerRank;
  global.getXPRequiredForLevel = getXPRequiredForLevel;
  global.CAREER_RANKS = CAREER_RANKS;
  global.MONTH_CLOSE_IDS = MONTH_CLOSE_IDS;
  applyRuntimeConfig();
})(window);
