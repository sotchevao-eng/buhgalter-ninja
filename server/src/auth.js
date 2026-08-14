'use strict';

const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const { sendError } = require('./http');

function hashToken(token) {
  const pepper = config.SESSION_SECRET || '';
  return crypto.createHash('sha256').update(pepper + String(token)).digest('hex');
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(playerId) {
  const token = newToken();
  const tokenHash = hashToken(token);
  const days = config.SESSION_TTL_DAYS;
  await db.query(
    `INSERT INTO auth_sessions (token_hash, player_id, expires_at)
     VALUES ($1, $2, NOW() + ($3::text || ' days')::interval)`,
    [tokenHash, playerId, String(days)]
  );
  return token;
}

async function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return sendError(res, 401, 'UNAUTHORIZED', 'authorization required');
  }
  const tokenHash = hashToken(match[1].trim());
  try {
    const result = await db.query(
      `SELECT s.player_id, s.expires_at, p.vk_user_id, p.display_name, p.avatar_url, p.is_leaderboard_eligible
       FROM auth_sessions s
       JOIN players p ON p.id = s.player_id
       WHERE s.token_hash = $1`,
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) {
      return sendError(res, 401, 'UNAUTHORIZED', 'session is invalid');
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return sendError(res, 401, 'UNAUTHORIZED', 'session expired');
    }
    req.player = {
      id: row.player_id,
      vkUserId: row.vk_user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      isLeaderboardEligible: row.is_leaderboard_eligible
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  hashToken,
  newToken,
  createSession,
  requireAuth
};
