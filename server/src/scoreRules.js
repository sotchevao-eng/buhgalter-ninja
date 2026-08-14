'use strict';

const MIN_DURATION_MS = 3000;
const REALISTIC_MIN_MS = 8000;
const MAX_DURATION_MS = 30 * 60 * 1000;
const MAX_COMBO = 400;
const MAX_SCORE = 1500000;

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function intField(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

/**
 * Базовая проверка результата. Это не anti-cheat.
 * impossible → rejected
 * odd but possible → suspicious
 */
function validateFinish(payload, session) {
  payload = payload || {};
  session = session || {};

  if (session.status === 'completed' || session.status === 'rejected') {
    return {
      ok: true,
      idempotent: true,
      status: session.status,
      scoreFlag: session.score_flag || session.scoreFlag || 'normal'
    };
  }

  const score = intField(payload.score);
  const level = intField(payload.level);
  const bestCombo = intField(payload.bestCombo != null ? payload.bestCombo : payload.maxCombo);
  const documentsCaught = intField(payload.documentsCaught != null ? payload.documentsCaught : payload.documentsCollected);
  const bonusesCaught = intField(payload.bonusesCaught);
  const penaltiesHit = intField(payload.penaltiesHit);
  const paymentsCaught = intField(payload.paymentsCaught);
  const eventsCompleted = intField(payload.eventsCompleted);
  const durationMs = intField(payload.durationMs != null ? payload.durationMs : payload.duration);

  const fields = {
    score: score,
    level: level,
    bestCombo: bestCombo,
    documentsCaught: documentsCaught,
    bonusesCaught: bonusesCaught,
    penaltiesHit: penaltiesHit,
    paymentsCaught: paymentsCaught,
    eventsCompleted: eventsCompleted,
    durationMs: durationMs
  };

  for (const key of Object.keys(fields)) {
    if (fields[key] == null) {
      return reject('INVALID_RESULT', key + ' is required');
    }
    if (fields[key] < 0) {
      return reject('IMPOSSIBLE_RESULT', key + ' cannot be negative');
    }
  }

  if (score > MAX_SCORE || bestCombo > MAX_COMBO || level > 200) {
    return reject('IMPOSSIBLE_RESULT', 'values exceed hard limits');
  }

  const startedAt = session.started_at || session.startedAt;
  let serverDuration = durationMs;
  if (startedAt) {
    const started = new Date(startedAt).getTime();
    if (Number.isFinite(started)) {
      serverDuration = Math.max(0, Date.now() - started);
    }
  }

  const useDuration = Math.min(durationMs, serverDuration || durationMs);

  if (useDuration > MAX_DURATION_MS) {
    return reject('IMPOSSIBLE_RESULT', 'session is too long');
  }

  if (useDuration < 400) {
    return reject('IMPOSSIBLE_RESULT', 'session is too short');
  }

  if (useDuration < MIN_DURATION_MS && score > 0) {
    return reject('IMPOSSIBLE_RESULT', 'session is too short for a scored run');
  }

  const expectedLevel = Math.floor(score / 100) + 1;
  if (Math.abs(level - expectedLevel) > 2) {
    return reject('IMPOSSIBLE_RESULT', 'level does not match score');
  }

  const durationSec = Math.max(1, useDuration / 1000);
  if (score > durationSec * 140) {
    return reject('IMPOSSIBLE_RESULT', 'score is impossible for duration');
  }

  if (documentsCaught === 0 && paymentsCaught === 0 && bonusesCaught === 0 && score > 2500) {
    return reject('IMPOSSIBLE_RESULT', 'score without collected objects');
  }

  let scoreFlag = 'normal';
  const reasons = [];

  if (useDuration < REALISTIC_MIN_MS && score > 400) {
    scoreFlag = 'suspicious';
    reasons.push('short_run_high_score');
  }
  if (score > durationSec * 55) {
    scoreFlag = 'suspicious';
    reasons.push('high_score_rate');
  }
  if (documentsCaught === 0 && score > 400) {
    scoreFlag = 'suspicious';
    reasons.push('score_without_docs');
  }
  if (bestCombo >= 80) {
    scoreFlag = 'suspicious';
    reasons.push('extreme_combo');
  }

  return {
    ok: true,
    idempotent: false,
    status: 'completed',
    scoreFlag: scoreFlag,
    reason: reasons.join(',') || null,
    normalized: {
      score: score,
      level: level,
      bestCombo: bestCombo,
      documentsCaught: documentsCaught,
      bonusesCaught: bonusesCaught,
      penaltiesHit: penaltiesHit,
      paymentsCaught: paymentsCaught,
      eventsCompleted: eventsCompleted,
      durationMs: useDuration,
      lostLifeThisRun: !!payload.lostLifeThisRun
    }
  };
}

function reject(code, message) {
  return {
    ok: false,
    idempotent: false,
    status: 'rejected',
    scoreFlag: 'rejected',
    code: code,
    reason: message
  };
}

function uniqueBestByPlayer(rows) {
  const best = new Map();
  (rows || []).forEach((row) => {
    const id = row.playerId || row.player_id;
    if (!id) return;
    const current = best.get(id);
    const score = num(row.score, 0);
    const combo = num(row.bestCombo != null ? row.bestCombo : row.best_combo, 0);
    const finished = new Date(row.finishedAt || row.finished_at || 0).getTime();
    if (!current) {
      best.set(id, row);
      return;
    }
    const curScore = num(current.score, 0);
    const curCombo = num(current.bestCombo != null ? current.bestCombo : current.best_combo, 0);
    const curFinished = new Date(current.finishedAt || current.finished_at || 0).getTime();
    if (score > curScore) best.set(id, row);
    else if (score === curScore && combo > curCombo) best.set(id, row);
    else if (score === curScore && combo === curCombo && finished < curFinished) best.set(id, row);
  });
  return Array.from(best.values()).sort((a, b) => {
    const scoreA = num(a.score, 0);
    const scoreB = num(b.score, 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const comboA = num(a.bestCombo != null ? a.bestCombo : a.best_combo, 0);
    const comboB = num(b.bestCombo != null ? b.bestCombo : b.best_combo, 0);
    if (comboB !== comboA) return comboB - comboA;
    return new Date(a.finishedAt || a.finished_at || 0) - new Date(b.finishedAt || b.finished_at || 0);
  });
}

function isKnownAchievement(id) {
  return !!KNOWN_ACHIEVEMENTS[String(id || '')];
}

const KNOWN_ACHIEVEMENTS = {
  firstDoc: true,
  firstHundred: true,
  firstThousand: true,
  firstBonus: true,
  firstPayment: true,
  combo10: true,
  ninjaCombo: true,
  combo30: true,
  ironNerves: true,
  noFines1000: true,
  glavbuh: true,
  monthClosed: true,
  quarterClosed: true,
  deadlineDone: true,
  fnsReply: true,
  fnsEscaped: true,
  fridaySurvived: true,
  update1cOk: true,
  coffeeSaved: true,
  rankAccountant: true,
  rankGlavbuh: true,
  rankNinja: true,
  rankLegend: true,
  docs100: true,
  docs1000: true,
  games10: true,
  miracle1c: true,
  clientOnTime: true
};

function simpleAchievements(run, progress) {
  const ids = [];
  const score = Number(run.score) || 0;
  const combo = Number(run.bestCombo) || 0;
  const docs = Number(run.documentsCaught) || 0;
  const payments = Number(run.paymentsCaught) || 0;
  const bonuses = Number(run.bonusesCaught) || 0;
  const penalties = Number(run.penaltiesHit) || 0;
  const lost = !!run.lostLifeThisRun;
  const totalDocs = (Number(progress && progress.total_documents) || 0) + docs;
  const gamesPlayed = (Number(progress && progress.games_played) || 0) + 1;
  const playerLevel = Number(progress && progress.player_level) || 1;

  if (docs >= 1) ids.push('firstDoc');
  if (score >= 100) ids.push('firstHundred');
  if (score >= 1000) ids.push('firstThousand');
  if (bonuses >= 1) ids.push('firstBonus');
  if (payments >= 1) ids.push('firstPayment');
  if (combo >= 10) ids.push('combo10');
  if (combo >= 20) ids.push('ninjaCombo');
  if (combo >= 30) ids.push('combo30');
  if (score >= 5000) ids.push('glavbuh');
  if (score >= 1000 && penalties === 0 && !lost) ids.push('noFines1000');
  if (totalDocs >= 100) ids.push('docs100');
  if (totalDocs >= 1000) ids.push('docs1000');
  if (gamesPlayed >= 10) ids.push('games10');
  if (playerLevel >= 5) ids.push('rankAccountant');
  if (playerLevel >= 20) ids.push('rankGlavbuh');
  if (playerLevel >= 30) ids.push('rankNinja');
  if (playerLevel >= 50) ids.push('rankLegend');
  return ids;
}

module.exports = {
  MIN_DURATION_MS,
  REALISTIC_MIN_MS,
  MAX_DURATION_MS,
  validateFinish,
  uniqueBestByPlayer,
  simpleAchievements,
  isKnownAchievement
};
