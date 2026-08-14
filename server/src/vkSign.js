'use strict';

/**
 * Проверка подписи параметров запуска VK Mini Apps.
 * Алгоритм — официальный: HMAC-SHA256 защищённым ключом приложения,
 * затем Base64URL. Источник: https://dev.vk.com/ru/mini-apps/development/launch-params-sign
 *
 * Секрет никогда не уходит на клиент.
 */
const crypto = require('crypto');
const querystring = require('querystring');

function toBase64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseLaunchSearch(search) {
  const raw = String(search || '');
  const stripped = raw.startsWith('?') ? raw.slice(1) : raw;
  return querystring.parse(stripped);
}

function buildCheckString(params) {
  return Object.keys(params)
    .filter((key) => key.startsWith('vk_'))
    .sort()
    .map((key) => key + '=' + encodeURIComponent(params[key] == null ? '' : String(params[key])))
    .join('&');
}

function computeSign(params, secret) {
  const checkString = buildCheckString(params);
  return toBase64Url(crypto.createHmac('sha256', String(secret)).update(checkString).digest());
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyLaunchParams(search, secret, options) {
  options = options || {};
  if (!secret) {
    return { ok: false, code: 'SERVER_MISCONFIGURED', message: 'VK_APP_SECRET is not set' };
  }

  const parsed = parseLaunchSearch(search);
  const sign = parsed.sign;
  if (!sign) {
    return { ok: false, code: 'INVALID_SIGN', message: 'sign is missing' };
  }

  const params = Object.assign({}, parsed);
  delete params.sign;

  const expected = computeSign(params, secret);
  if (!safeEqual(expected, sign)) {
    return { ok: false, code: 'INVALID_SIGN', message: 'launch params signature is invalid' };
  }

  const vkUserId = Number(params.vk_user_id);
  if (!Number.isInteger(vkUserId) || vkUserId <= 0) {
    return { ok: false, code: 'INVALID_SIGN', message: 'vk_user_id is invalid' };
  }

  if (options.appId) {
    if (String(params.vk_app_id || '') !== String(options.appId)) {
      return { ok: false, code: 'INVALID_APP', message: 'vk_app_id does not match' };
    }
  }

  if (params.vk_ts == null || params.vk_ts === '') {
    return { ok: false, code: 'STALE_LAUNCH', message: 'launch params timestamp is required' };
  }
  const ts = Number(params.vk_ts);
  const now = Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSec || 48 * 60 * 60;
  if (!Number.isFinite(ts) || Math.abs(now - ts) > maxAge) {
    return { ok: false, code: 'STALE_LAUNCH', message: 'launch params are too old' };
  }

  return {
    ok: true,
    params: params,
    vkUserId: vkUserId
  };
}

module.exports = {
  parseLaunchSearch,
  buildCheckString,
  computeSign,
  verifyLaunchParams
};
