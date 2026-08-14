/**
 * Единственный публичный production-config без секретов.
 * На сервере подставьте реальные HTTPS URL и VK App ID.
 * Пустые значения = локальный режим (Guest / Local).
 *
 * Соответствие ENV:
 *   apiBaseUrl    ← API_PUBLIC_URL
 *   appLaunchUrl  ← FRONTEND_URL
 *   communityUrl  ← VK_COMMUNITY_URL
 *   vkAppId       ← VK_APP_ID
 *   vkGroupId     ← VK_GROUP_ID
 *
 * Не вписывайте сюда VK_APP_SECRET, SESSION_SECRET, DATABASE_URL.
 */
(function (global) {
  'use strict';

  global.RUNTIME_CONFIG = {
    environment: '',
    apiBaseUrl: '',
    communityUrl: '',
    vkAppId: '',
    vkGroupId: '',
    appLaunchUrl: ''
  };

  if (typeof applyRuntimeConfig === 'function') {
    applyRuntimeConfig(global.RUNTIME_CONFIG);
  }
})(window);
