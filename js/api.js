/**
 * HTTP-клиент к backend. Если apiBaseUrl пустой — сеть не вызывается.
 */
(function (global) {
  'use strict';

  const TIMEOUT_MS = 8000;
  const FRIENDLY = {
    INVALID_SIGN: 'Не удалось подтвердить вход ВКонтакте.',
    INVALID_APP: 'Приложение VK настроено иначе, чем сервер.',
    STALE_LAUNCH: 'Параметры запуска устарели. Откройте игру заново.',
    UNAUTHORIZED: 'Сессия истекла. Откройте игру заново.',
    RATE_LIMIT: 'Слишком много запросов. Подождите немного.',
    IMPOSSIBLE_RESULT: 'Результат не принят сервером.',
    INVALID_RESULT: 'Результат не принят сервером.',
    SESSION_NOT_FOUND: 'Игровая сессия не найдена.',
    ALREADY_CLAIMED: 'Награда уже получена.',
    NOT_COMPLETED: 'Задание ещё не выполнено.',
    SERVER_MISCONFIGURED: 'Онлайн-режим пока не настроен.',
    SERVER_ERROR: 'Синхронизация временно недоступна. Ваш прогресс сохранён на устройстве.',
    NETWORK: 'Синхронизация временно недоступна. Ваш прогресс сохранён на устройстве.',
    TIMEOUT: 'Синхронизация временно недоступна. Ваш прогресс сохранён на устройстве.',
    MAINTENANCE: 'Онлайн-рейтинг временно недоступен. Но играть можно!'
  };

  function baseUrl() {
    const raw = (APP_CONFIG && APP_CONFIG.apiBaseUrl) || '';
    return String(raw).replace(/\/+$/, '');
  }

  function friendlyError(err) {
    const code = err && err.code;
    return FRIENDLY[code] || FRIENDLY.NETWORK;
  }

  const ApiClient = {
    timeoutMs: TIMEOUT_MS,

    isConfigured: function () {
      return !!baseUrl();
    },

    getToken: function () {
      return StorageService.read('apiToken', '') || '';
    },

    setToken: function (token) {
      if (token) StorageService.write('apiToken', String(token));
      else StorageService.write('apiToken', '');
    },

    clearToken: function () {
      this.setToken('');
    },

    request: function (method, path, body, options) {
      options = options || {};
      if (!this.isConfigured()) {
        return Promise.reject({ code: 'SERVER_MISCONFIGURED', message: 'API is not configured' });
      }
      const url = baseUrl() + path;
      const headers = { Accept: 'application/json' };
      if (body != null) headers['Content-Type'] = 'application/json';
      const token = options.token !== undefined ? options.token : this.getToken();
      if (token) headers.Authorization = 'Bearer ' + token;

      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
      }, options.timeoutMs || TIMEOUT_MS);

      return fetch(url, {
        method: method,
        headers: headers,
        body: body != null ? JSON.stringify(body) : undefined,
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        return res.text().then(function (text) {
          let data = {};
          try { data = text ? JSON.parse(text) : {}; } catch (err) { data = {}; }
          if (!res.ok) {
            const err = (data && data.error) || {};
            const code = err.code || (res.status === 401 ? 'UNAUTHORIZED' : (res.status === 503 ? 'MAINTENANCE' : 'SERVER_ERROR'));
            const error = new Error(err.message || 'request failed');
            error.code = code;
            error.status = res.status;
            error.friendly = FRIENDLY[code] || FRIENDLY.SERVER_ERROR;
            throw error;
          }
          return data;
        });
      }).catch(function (err) {
        if (err && err.code) throw err;
        const error = new Error(err && err.name === 'AbortError' ? 'timeout' : 'network');
        error.code = err && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
        error.friendly = FRIENDLY[error.code];
        throw error;
      }).finally(function () {
        clearTimeout(timer);
      });
    },

    get: function (path, options) {
      return this.request('GET', path, null, options);
    },

    post: function (path, body, options) {
      return this.request('POST', path, body || {}, options);
    },

    put: function (path, body, options) {
      return this.request('PUT', path, body || {}, options);
    },

    friendlyError: friendlyError
  };

  global.ApiClient = ApiClient;
})(window);
