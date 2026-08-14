'use strict';

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code: code,
      message: message
    }
  });
}

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sanitizeName(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 64);
}

function sanitizeAvatar(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    const ok =
      host === 'vk.com' ||
      host === 'vk.ru' ||
      host.endsWith('.vk.com') ||
      host.endsWith('.vk.ru') ||
      host.endsWith('.userapi.com');
    return ok ? parsed.toString().slice(0, 500) : '';
  } catch (err) {
    return '';
  }
}

module.exports = {
  sendError,
  asyncHandler,
  sanitizeName,
  sanitizeAvatar
};
