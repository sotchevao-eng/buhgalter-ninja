CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vk_user_id BIGINT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  is_leaderboard_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_progress (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  player_level INTEGER NOT NULL DEFAULT 1,
  rank TEXT NOT NULL DEFAULT 'Стажёр',
  high_score INTEGER NOT NULL DEFAULT 0,
  best_combo INTEGER NOT NULL DEFAULT 0,
  max_game_level INTEGER NOT NULL DEFAULT 1,
  games_played INTEGER NOT NULL DEFAULT 0,
  total_score BIGINT NOT NULL DEFAULT 0,
  total_documents INTEGER NOT NULL DEFAULT 0,
  total_payments INTEGER NOT NULL DEFAULT 0,
  total_bonuses INTEGER NOT NULL DEFAULT 0,
  total_penalties INTEGER NOT NULL DEFAULT 0,
  events_completed INTEGER NOT NULL DEFAULT 0,
  achievements_unlocked INTEGER NOT NULL DEFAULT 0,
  daily_challenges_completed INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_play_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_achievements (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS player_daily_challenges (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  challenge_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (player_id, date)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  score INTEGER,
  level INTEGER,
  best_combo INTEGER,
  documents_caught INTEGER,
  bonuses_caught INTEGER,
  penalties_hit INTEGER,
  payments_caught INTEGER,
  events_completed INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'started',
  game_version TEXT,
  score_flag TEXT NOT NULL DEFAULT 'normal',
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_vk_user_id ON players (vk_user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player_id ON game_sessions (player_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_score ON game_sessions (score);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions (created_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_finished_at ON game_sessions (finished_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_board
  ON game_sessions (status, score_flag, finished_at DESC, score DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_player ON auth_sessions (player_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements (player_id);
