/**
 * Собственные технические события. Без сторонних трекеров и без VK-профиля.
 */
(function (global) {
  'use strict';

  const ALLOWED = {
    game_open: true,
    game_start: true,
    game_over: true,
    share_click: true,
    community_click: true,
    leaderboard_open: true,
    daily_complete: true,
    tutorial_start: true,
    achievement_unlock: true,
    level_up: true
  };

  function safeName(eventName) {
    const name = String(eventName || '');
    return ALLOWED[name] ? name : '';
  }

  const AnalyticsService = {
    track: function (eventName, payload) {
      const name = safeName(eventName);
      if (!name) return;
      if (global.DEBUG) {
        try { console.warn('[analytics]', name); } catch (err) {}
      }
      if (!global.FEATURES || FEATURES.analytics === false) return;
      if (!global.ApiClient || !ApiClient.isConfigured()) return;
      ApiClient.post('/api/v1/events', {
        name: name,
        gameVersion: global.APP_VERSION || ''
      }).catch(function () {});
    }
  };

  global.AnalyticsService = AnalyticsService;
})(window);
