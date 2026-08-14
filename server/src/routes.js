'use strict';

const express = require('express');
const db = require('./db');
const config = require('./config');
const { verifyLaunchParams } = require('./vkSign');
const { createSession, requireAuth, hashToken } = require('./auth');
const { sendError, asyncHandler, sanitizeName, sanitizeAvatar } = require('./http');
const { validateFinish, simpleAchievements, isKnownAchievement } = require('./scoreRules');
const { applyXP, xpFromRun, getCareerRank } = require('./xp');
const { pickForDate, runValue } = require('./daily');

function finiteInt(value, fallback, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  let out = n;
  if (min != null && out < min) out = min;
  if (max != null && out > max) out = max;
  return out;
}

const router = express.Router();
const TOP_SIZE = 25;

function serverDate(client) {
  const q = client && client.query ? client : db;
  return q.query(
    'SELECT (now() AT TIME ZONE $1)::date::text AS d',
    [config.LEADERBOARD_TIMEZONE]
  ).then((res) => res.rows[0].d);
}

async function ensureProgress(client, playerId) {
  await client.query(
    `INSERT INTO player_progress (player_id) VALUES ($1)
     ON CONFLICT (player_id) DO NOTHING`,
    [playerId]
  );
}

async function getProgress(client, playerId) {
  await ensureProgress(client, playerId);
  const res = await client.query('SELECT * FROM player_progress WHERE player_id = $1', [playerId]);
  return res.rows[0];
}

function yesterdayKey(iso) {
  const parts = String(iso || '').split('-');
  if (parts.length !== 3) return '';
  const dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function applyStreak(progress, today) {
  const last = progress.last_play_date
    ? new Date(progress.last_play_date).toISOString().slice(0, 10)
    : null;
  if (last === today) {
    return {
      current_streak: progress.current_streak,
      best_streak: progress.best_streak,
      last_play_date: today
    };
  }
  let current = 1;
  if (last && last === yesterdayKey(today)) current = (Number(progress.current_streak) || 0) + 1;
  const best = Math.max(Number(progress.best_streak) || 0, current);
  return { current_streak: current, best_streak: best, last_play_date: today };
}

function progressDto(row) {
  if (!row) return null;
  return {
    xp: row.xp,
    playerLevel: row.player_level,
    rank: row.rank,
    highScore: row.high_score,
    bestCombo: row.best_combo,
    maxGameLevel: row.max_game_level,
    gamesPlayed: row.games_played,
    totalScore: Number(row.total_score) || 0,
    totalDocuments: row.total_documents,
    totalPayments: row.total_payments,
    totalBonuses: row.total_bonuses,
    totalPenalties: row.total_penalties,
    eventsCompleted: row.events_completed,
    achievementsUnlocked: row.achievements_unlocked,
    dailyChallengesCompleted: row.daily_challenges_completed,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    lastPlayDate: row.last_play_date
  };
}

async function getOrCreateDaily(client, playerId, today) {
  const def = pickForDate(today);
  const existing = await client.query(
    'SELECT * FROM player_daily_challenges WHERE player_id = $1 AND date = $2',
    [playerId, today]
  );
  if (existing.rows[0] && existing.rows[0].challenge_id === def.id) {
    return { row: existing.rows[0], def: def };
  }
  await client.query(
    `INSERT INTO player_daily_challenges (player_id, date, challenge_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, date) DO UPDATE
       SET challenge_id = EXCLUDED.challenge_id
     WHERE player_daily_challenges.challenge_id IS DISTINCT FROM EXCLUDED.challenge_id
       AND player_daily_challenges.reward_claimed = FALSE`,
    [playerId, today, def.id]
  );
  const again = await client.query(
    'SELECT * FROM player_daily_challenges WHERE player_id = $1 AND date = $2',
    [playerId, today]
  );
  return { row: again.rows[0], def: def };
}

function dailyDto(row, def) {
  return {
    date: row.date,
    id: def.id,
    title: def.title,
    description: def.description,
    target: def.target,
    progress: row.progress,
    completed: row.completed || row.progress >= def.target,
    rewardClaimed: row.reward_claimed,
    xp: def.xp
  };
}

router.post('/auth/vk', asyncHandler(async (req, res) => {
  if (!config.VK_APP_SECRET) {
    return sendError(res, 503, 'SERVER_MISCONFIGURED', 'VK auth is not configured');
  }
  const launchSearch = req.body && (req.body.launchSearch || req.body.search || '');
  const verified = verifyLaunchParams(launchSearch, config.VK_APP_SECRET, {
    appId: config.VK_APP_ID || null
  });
  if (!verified.ok) {
    console.warn('invalid vk auth', verified.code);
    return sendError(res, 401, verified.code, verified.message);
  }

  const displayName = sanitizeName(req.body && req.body.displayName);
  const avatarUrl = sanitizeAvatar(req.body && req.body.avatarUrl);

  const result = await db.withTransaction(async (client) => {
    const existing = await client.query(
      'SELECT * FROM players WHERE vk_user_id = $1',
      [verified.vkUserId]
    );
    let player = existing.rows[0];
    if (!player) {
      const inserted = await client.query(
        `INSERT INTO players (vk_user_id, display_name, avatar_url)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [verified.vkUserId, displayName || 'Игрок', avatarUrl]
      );
      player = inserted.rows[0];
      await ensureProgress(client, player.id);
    } else {
      await client.query(
        `UPDATE players
         SET display_name = COALESCE(NULLIF($2, ''), display_name),
             avatar_url = COALESCE(NULLIF($3, ''), avatar_url),
             last_seen_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [player.id, displayName, avatarUrl]
      );
      await ensureProgress(client, player.id);
      const refreshed = await client.query('SELECT * FROM players WHERE id = $1', [player.id]);
      player = refreshed.rows[0];
    }
    return player;
  });

  const token = await createSession(result.id);
  const progress = await db.query('SELECT * FROM player_progress WHERE player_id = $1', [result.id]);
  res.json({
    token: token,
    player: {
      id: result.id,
      displayName: result.display_name,
      avatarUrl: result.avatar_url || ''
    },
    progress: progressDto(progress.rows[0]),
    serverDate: await serverDate()
  });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const player = await db.query('SELECT * FROM players WHERE id = $1', [req.player.id]);
  const row = player.rows[0];
  res.json({
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  });
}));

router.get('/me/progress', requireAuth, asyncHandler(async (req, res) => {
  const today = await serverDate();
  const payload = await db.withTransaction(async (client) => {
    const progress = await getProgress(client, req.player.id);
    const daily = await getOrCreateDaily(client, req.player.id, today);
    const ach = await client.query(
      'SELECT achievement_id, unlocked_at FROM player_achievements WHERE player_id = $1',
      [req.player.id]
    );
    return { progress, daily, ach: ach.rows };
  });
  res.json({
    progress: progressDto(payload.progress),
    achievements: payload.ach.map((row) => ({
      id: row.achievement_id,
      unlockedAt: row.unlocked_at
    })),
    daily: dailyDto(payload.daily.row, payload.daily.def),
    serverDate: today
  });
}));

router.put('/me/progress', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const achievements = Array.isArray(body.achievements) ? body.achievements : [];
  const today = await serverDate();
  const updated = await db.withTransaction(async (client) => {
    let progress = await getProgress(client, req.player.id);
    const highScore = Math.max(progress.high_score, finiteInt(body.highScore, 0, 0, 1500000));
    const bestCombo = Math.max(progress.best_combo, finiteInt(body.bestCombo, 0, 0, 400));
    const maxGameLevel = Math.max(progress.max_game_level, finiteInt(body.maxGameLevel, 1, 1, 200));
    await client.query(
      `UPDATE player_progress
       SET high_score = $2, best_combo = $3, max_game_level = $4, updated_at = NOW()
       WHERE player_id = $1`,
      [req.player.id, highScore, bestCombo, maxGameLevel]
    );
    for (const rawId of achievements) {
      const id = String(rawId || '').slice(0, 64);
      if (!id || !isKnownAchievement(id)) continue;
      await client.query(
        `INSERT INTO player_achievements (player_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.player.id, id]
      );
    }
    const count = await client.query(
      'SELECT COUNT(*)::int AS n FROM player_achievements WHERE player_id = $1',
      [req.player.id]
    );
    await client.query(
      'UPDATE player_progress SET achievements_unlocked = $2 WHERE player_id = $1',
      [req.player.id, count.rows[0].n]
    );
    progress = await getProgress(client, req.player.id);
    return progress;
  });
  res.json({ progress: progressDto(updated), serverDate: today });
}));

router.post('/me/migrate-local', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const updated = await db.withTransaction(async (client) => {
    const progress = await getProgress(client, req.player.id);
    const highScore = Math.max(progress.high_score, finiteInt(body.highScore, 0, 0, 1500000));
    const bestCombo = Math.max(progress.best_combo, finiteInt(body.bestCombo, 0, 0, 400));
    const maxGameLevel = Math.max(progress.max_game_level, finiteInt(body.maxGameLevel, 1, 1, 200));
    let playerLevel = progress.player_level;
    let xp = progress.xp;
    const localLevel = finiteInt(body.playerLevel, 1, 1, 50);
    if (localLevel > playerLevel) {
      playerLevel = localLevel;
    }
    const rank = getCareerRank(playerLevel).title;
    await client.query(
      `UPDATE player_progress
       SET high_score = $2, best_combo = $3, max_game_level = $4,
           player_level = $5, xp = $6, rank = $7, updated_at = NOW()
       WHERE player_id = $1`,
      [req.player.id, highScore, bestCombo, maxGameLevel, playerLevel, xp, rank]
    );
    const achievements = Array.isArray(body.achievements) ? body.achievements : [];
    for (const rawId of achievements) {
      const id = String(rawId || '').slice(0, 64);
      if (!id || !isKnownAchievement(id)) continue;
      await client.query(
        `INSERT INTO player_achievements (player_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.player.id, id]
      );
    }
    const count = await client.query(
      'SELECT COUNT(*)::int AS n FROM player_achievements WHERE player_id = $1',
      [req.player.id]
    );
    await client.query(
      'UPDATE player_progress SET achievements_unlocked = $2 WHERE player_id = $1',
      [req.player.id, count.rows[0].n]
    );
    return getProgress(client, req.player.id);
  });
  res.json({ ok: true, progress: progressDto(updated) });
}));

router.get('/me/achievements', requireAuth, asyncHandler(async (req, res) => {
  const ach = await db.query(
    'SELECT achievement_id, unlocked_at FROM player_achievements WHERE player_id = $1 ORDER BY unlocked_at',
    [req.player.id]
  );
  res.json({
    achievements: ach.rows.map((row) => ({
      id: row.achievement_id,
      unlockedAt: row.unlocked_at
    }))
  });
}));

router.post('/me/daily/claim', requireAuth, asyncHandler(async (req, res) => {
  const today = await serverDate();
  const result = await db.withTransaction(async (client) => {
    const daily = await getOrCreateDaily(client, req.player.id, today);
    await client.query(
      'SELECT 1 FROM player_daily_challenges WHERE player_id = $1 AND date = $2 FOR UPDATE',
      [req.player.id, today]
    );
    const locked = await getOrCreateDaily(client, req.player.id, today);
    if (!locked.row.completed && locked.row.progress < locked.def.target) {
      return { ok: false, code: 'NOT_COMPLETED' };
    }
    if (locked.row.reward_claimed) {
      return { ok: false, already: true, code: 'ALREADY_CLAIMED' };
    }
    const claimed = await client.query(
      `UPDATE player_daily_challenges
       SET reward_claimed = TRUE, completed = TRUE
       WHERE player_id = $1 AND date = $2 AND reward_claimed = FALSE
       RETURNING player_id`,
      [req.player.id, today]
    );
    if (!claimed.rowCount) {
      return { ok: false, already: true, code: 'ALREADY_CLAIMED' };
    }
    let progress = await getProgress(client, req.player.id);
    const next = applyXP(progress.xp, progress.player_level, locked.def.xp);
    await client.query(
      `UPDATE player_progress
       SET xp = $2, player_level = $3, rank = $4,
           daily_challenges_completed = daily_challenges_completed + 1,
           updated_at = NOW()
       WHERE player_id = $1`,
      [req.player.id, next.xp, next.playerLevel, next.rank]
    );
    progress = await getProgress(client, req.player.id);
    const refreshed = await getOrCreateDaily(client, req.player.id, today);
    return { ok: true, xp: locked.def.xp, progress, daily: refreshed };
  });
  if (!result.ok) {
    const status = result.code === 'ALREADY_CLAIMED' ? 409 : 400;
    return sendError(res, status, result.code, result.already ? 'reward already claimed' : 'challenge is not completed');
  }
  res.json({
    ok: true,
    xp: result.xp,
    progress: progressDto(result.progress),
    daily: dailyDto(result.daily.row, result.daily.def),
    serverDate: today
  });
}));

router.post('/game/session', requireAuth, asyncHandler(async (req, res) => {
  const version = String((req.body && req.body.gameVersion) || '').slice(0, 32);
  const inserted = await db.query(
    `INSERT INTO game_sessions (player_id, game_version, status)
     VALUES ($1, $2, 'started')
     RETURNING id, started_at`,
    [req.player.id, version]
  );
  res.json({
    sessionId: inserted.rows[0].id,
    startedAt: inserted.rows[0].started_at
  });
}));

router.post('/game/session/:id/finish', requireAuth, asyncHandler(async (req, res) => {
  const sessionId = String(req.params.id || '');
  const today = await serverDate();
  const body = req.body || {};

  const saved = await db.withTransaction(async (client) => {
    const sessionRes = await client.query(
      'SELECT * FROM game_sessions WHERE id = $1 FOR UPDATE',
      [sessionId]
    );
    const session = sessionRes.rows[0];
    if (!session) {
      return { error: { status: 404, code: 'SESSION_NOT_FOUND', message: 'session not found' } };
    }
    if (session.player_id !== req.player.id) {
      return { error: { status: 403, code: 'FORBIDDEN', message: 'session belongs to another player' } };
    }

    if (session.status === 'completed' || session.status === 'rejected') {
      return {
        idempotent: true,
        ok: session.status === 'completed',
        status: session.status,
        scoreFlag: session.score_flag,
        score: session.score
      };
    }

    const check = validateFinish(body, session);
    if (!check.ok) {
      await client.query(
        `UPDATE game_sessions
         SET status = 'rejected', score_flag = 'rejected', reject_reason = $2,
             finished_at = NOW(), score = $3, level = $4, best_combo = $5,
             duration_ms = $6, game_version = COALESCE($7, game_version)
         WHERE id = $1 AND status = 'started'`,
        [
          session.id,
          check.reason,
          Number(body.score) || 0,
          Number(body.level) || 1,
          Number(body.bestCombo || body.maxCombo) || 0,
          Number(body.durationMs || body.duration) || 0,
          String(body.gameVersion || '').slice(0, 32) || null
        ]
      );
      console.warn('rejected score', { player: req.player.id, reason: check.reason });
      return { rejected: true, check };
    }

    const run = check.normalized;
    const version = String(body.gameVersion || session.game_version || '').slice(0, 32);
    const completed = await client.query(
      `UPDATE game_sessions
       SET status = 'completed', score_flag = $2, reject_reason = $3, finished_at = NOW(),
           score = $4, level = $5, best_combo = $6, documents_caught = $7,
           bonuses_caught = $8, penalties_hit = $9, payments_caught = $10,
           events_completed = $11, duration_ms = $12, game_version = $13
       WHERE id = $1 AND status = 'started'
       RETURNING id`,
      [
        session.id,
        check.scoreFlag,
        check.reason,
        run.score,
        run.level,
        run.bestCombo,
        run.documentsCaught,
        run.bonusesCaught,
        run.penaltiesHit,
        run.paymentsCaught,
        run.eventsCompleted,
        run.durationMs,
        version
      ]
    );
    if (!completed.rowCount) {
      const again = await client.query('SELECT * FROM game_sessions WHERE id = $1', [session.id]);
      const row = again.rows[0] || session;
      return {
        idempotent: true,
        ok: row.status === 'completed',
        status: row.status,
        scoreFlag: row.score_flag,
        score: row.score
      };
    }

    let progress = await getProgress(client, req.player.id);
    const streak = applyStreak(progress, today);
    const extraAch = simpleAchievements(run, progress);
    let newAchCount = 0;
    for (const id of extraAch) {
      const ins = await client.query(
        `INSERT INTO player_achievements (player_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING achievement_id`,
        [req.player.id, id]
      );
      if (ins.rowCount) newAchCount += 1;
    }
    const xpGain = xpFromRun(run.score, run.eventsCompleted, newAchCount);
    const next = applyXP(progress.xp, progress.player_level, xpGain);
    const achCount = await client.query(
      'SELECT COUNT(*)::int AS n FROM player_achievements WHERE player_id = $1',
      [req.player.id]
    );

    await client.query(
      `UPDATE player_progress SET
         xp = $2,
         player_level = $3,
         rank = $4,
         high_score = GREATEST(high_score, $5),
         best_combo = GREATEST(best_combo, $6),
         max_game_level = GREATEST(max_game_level, $7),
         games_played = games_played + 1,
         total_score = total_score + $5,
         total_documents = total_documents + $8,
         total_payments = total_payments + $9,
         total_bonuses = total_bonuses + $10,
         total_penalties = total_penalties + $11,
         events_completed = events_completed + $12,
         achievements_unlocked = $13,
         current_streak = $14,
         best_streak = $15,
         last_play_date = $16,
         updated_at = NOW()
       WHERE player_id = $1`,
      [
        req.player.id,
        next.xp,
        next.playerLevel,
        next.rank,
        run.score,
        run.bestCombo,
        run.level,
        run.documentsCaught,
        run.paymentsCaught,
        run.bonusesCaught,
        run.penaltiesHit,
        run.eventsCompleted,
        achCount.rows[0].n,
        streak.current_streak,
        streak.best_streak,
        streak.last_play_date
      ]
    );

    const daily = await getOrCreateDaily(client, req.player.id, today);
    if (!daily.row.reward_claimed) {
      const value = runValue({
        score: run.score,
        documentsCaught: run.documentsCaught,
        bestCombo: run.bestCombo,
        paymentsCaught: run.paymentsCaught,
        bonusesCaught: run.bonusesCaught,
        level: run.level,
        lostLifeThisRun: run.lostLifeThisRun
      }, daily.def.key);
      const nextProgress = Math.min(daily.def.target, Math.max(daily.row.progress, value));
      const dailyDone = nextProgress >= daily.def.target;
      await client.query(
        `UPDATE player_daily_challenges
         SET progress = $3, completed = $4
         WHERE player_id = $1 AND date = $2`,
        [req.player.id, today, nextProgress, dailyDone]
      );
    }

    progress = await getProgress(client, req.player.id);
    return {
      rejected: false,
      check,
      progress,
      xpGain,
      achievements: extraAch
    };
  });

  if (saved.error) {
    return sendError(res, saved.error.status, saved.error.code, saved.error.message);
  }
  if (saved.idempotent) {
    return res.json({
      ok: saved.ok !== false && saved.status === 'completed',
      idempotent: true,
      status: saved.status,
      scoreFlag: saved.scoreFlag,
      score: saved.score
    });
  }
  if (saved.rejected) {
    return sendError(res, 400, saved.check.code || 'IMPOSSIBLE_RESULT', saved.check.reason || 'result rejected');
  }

  res.json({
    ok: true,
    status: 'completed',
    scoreFlag: saved.check.scoreFlag,
    score: saved.check.normalized.score,
    xpGained: saved.xpGain,
    progress: progressDto(saved.progress),
    public: saved.check.scoreFlag === 'normal'
  });
}));

async function loadBoard(period, playerId) {
  const allowed = period === 'today' || period === 'week' ? period : 'all';
  const tz = config.LEADERBOARD_TIMEZONE;
  let where = `gs.status = 'completed' AND gs.score_flag = 'normal' AND p.is_leaderboard_eligible = TRUE`;
  const params = [];
  if (allowed === 'today') {
    params.push(tz);
    where += ` AND (gs.finished_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date`;
  } else if (allowed === 'week') {
    params.push(tz);
    where += ` AND (gs.finished_at AT TIME ZONE $1)::date >= (date_trunc('week', now() AT TIME ZONE $1))::date`;
  }

  const sql = `
    WITH best AS (
      SELECT DISTINCT ON (gs.player_id)
        gs.player_id,
        p.display_name,
        p.avatar_url,
        gs.score,
        gs.best_combo,
        gs.level,
        gs.finished_at,
        pp.rank
      FROM game_sessions gs
      JOIN players p ON p.id = gs.player_id
      LEFT JOIN player_progress pp ON pp.player_id = p.id
      WHERE ${where}
      ORDER BY gs.player_id, gs.score DESC, gs.best_combo DESC, gs.finished_at ASC
    ),
    ordered AS (
      SELECT *,
        ROW_NUMBER() OVER (ORDER BY score DESC, best_combo DESC, finished_at ASC) AS position
      FROM best
    )
    SELECT * FROM ordered
    ORDER BY position
    LIMIT ${TOP_SIZE}
  `;
  const rows = await db.query(sql, params);
  let me = null;
  if (playerId) {
    const meSql = `
      WITH best AS (
        SELECT DISTINCT ON (gs.player_id)
          gs.player_id,
          gs.score,
          gs.best_combo,
          gs.finished_at
        FROM game_sessions gs
        JOIN players p ON p.id = gs.player_id
        WHERE ${where}
        ORDER BY gs.player_id, gs.score DESC, gs.best_combo DESC, gs.finished_at ASC
      ),
      ordered AS (
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY score DESC, best_combo DESC, finished_at ASC) AS position
        FROM best
      )
      SELECT * FROM ordered WHERE player_id = $${params.length + 1}
    `;
    const meRes = await db.query(meSql, params.concat([playerId]));
    me = meRes.rows[0] || null;
  }
  return { period: allowed, rows: rows.rows, me };
}

function readBearer(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

router.get('/leaderboard', asyncHandler(async (req, res) => {
  const period = String(req.query.period || 'all');
  let playerId = null;
  const token = readBearer(req);
  if (token) {
    const session = await db.query(
      `SELECT player_id FROM auth_sessions WHERE token_hash = $1 AND expires_at > NOW()`,
      [hashToken(token)]
    );
    if (session.rows[0]) playerId = session.rows[0].player_id;
  }
  const board = await loadBoard(period, playerId);
  const meId = board.me ? board.me.player_id : null;
  res.json({
    period: board.period,
    timezone: config.LEADERBOARD_TIMEZONE,
    weekStart: 'monday',
    me: board.me ? {
      position: Number(board.me.position),
      score: board.me.score,
      bestCombo: board.me.best_combo
    } : null,
    rows: board.rows.map((row) => ({
      position: Number(row.position),
      displayName: row.display_name || 'Игрок',
      avatarUrl: row.avatar_url || '',
      score: row.score,
      bestCombo: row.best_combo,
      level: row.level,
      rank: row.rank || '',
      isMe: !!(meId && row.player_id === meId)
    }))
  });
}));

router.get('/leaderboard/me', requireAuth, asyncHandler(async (req, res) => {
  const period = String(req.query.period || 'all');
  const board = await loadBoard(period, req.player.id);
  res.json({
    period: board.period,
    timezone: config.LEADERBOARD_TIMEZONE,
    position: board.me ? Number(board.me.position) : null,
    score: board.me ? board.me.score : 0,
    bestCombo: board.me ? board.me.best_combo : 0
  });
}));

module.exports = router;
