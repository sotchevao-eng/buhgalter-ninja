'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function env(name, fallback) {
  const value = process.env[name];
  if (value == null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

const NODE_ENV = env('NODE_ENV', 'development');
const isProduction = NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3001;
const DATABASE_URL = env('DATABASE_URL', '');
const VK_APP_ID = env('VK_APP_ID', '');
const VK_GROUP_ID = env('VK_GROUP_ID', '');
const VK_APP_SECRET = env('VK_APP_SECRET', '');
const VK_COMMUNITY_URL = env('VK_COMMUNITY_URL', '');
const CORS_ORIGIN = env('CORS_ORIGIN', '');
const FRONTEND_URL = env('FRONTEND_URL', '');
const API_PUBLIC_URL = env('API_PUBLIC_URL', '');
const LEADERBOARD_TIMEZONE = env('LEADERBOARD_TIMEZONE', 'Europe/Moscow');
const WEEK_START = env('WEEK_START', 'monday').toLowerCase();
const SESSION_TTL_DAYS = Math.max(1, Number(process.env.SESSION_TTL_DAYS) || 30);
const SESSION_SECRET = env('SESSION_SECRET', '');
const MAINTENANCE_MODE = env('MAINTENANCE_MODE', '') === 'true';

function validateConfig() {
  const required = [];
  const optional = [];
  const warnings = [];

  if (isProduction) {
    if (!DATABASE_URL) required.push('DATABASE_URL');
    if (!CORS_ORIGIN) required.push('CORS_ORIGIN');
    if (!SESSION_SECRET || SESSION_SECRET.length < 16) required.push('SESSION_SECRET');
    if (!FRONTEND_URL) optional.push('FRONTEND_URL');
    if (!API_PUBLIC_URL) optional.push('API_PUBLIC_URL');
    if (!VK_APP_ID) optional.push('VK_APP_ID');
    if (!VK_GROUP_ID) optional.push('VK_GROUP_ID');
    if (!VK_APP_SECRET) optional.push('VK_APP_SECRET');
    if (!VK_COMMUNITY_URL) optional.push('VK_COMMUNITY_URL');
    if (CORS_ORIGIN && /localhost|127\.0\.0\.1|^http:\/\//i.test(CORS_ORIGIN)) {
      warnings.push('CORS_ORIGIN looks unsafe for production');
    }
  }

  return {
    ok: required.length === 0,
    required: required,
    optional: optional,
    warnings: warnings
  };
}

if (isProduction) {
  const check = validateConfig();
  if (!check.ok) {
    throw new Error('Production ENV missing: ' + check.required.join(', '));
  }
  if (check.optional.indexOf('VK_APP_SECRET') !== -1) {
    console.warn('VK_APP_SECRET is empty: VK auth will stay unavailable until it is set');
  }
}

module.exports = {
  NODE_ENV,
  PORT,
  DATABASE_URL,
  VK_APP_ID,
  VK_GROUP_ID,
  VK_APP_SECRET,
  VK_COMMUNITY_URL,
  CORS_ORIGIN,
  FRONTEND_URL,
  API_PUBLIC_URL,
  LEADERBOARD_TIMEZONE,
  WEEK_START,
  SESSION_TTL_DAYS,
  SESSION_SECRET,
  MAINTENANCE_MODE,
  isProduction,
  validateConfig
};
