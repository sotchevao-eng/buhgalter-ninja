# QA Report — Бухгалтер-ниндзя 0.9.0

PRODUCTION CANDIDATE. Игрокам показывается только «Версия 0.9.0».

## Что проверено

Код frontend/backend этапа 8 плюс production-сборка этапа 9: версия, cache bust, `validateConfig`, `mockVKUser = null`, preflight, документация API/БД/VK/деплоя. Игровая механика не менялась.

Автотесты backend: запустить `cd server && npm test`.
Preflight: `cd server && npm run preflight`.
`innerHTML` в клиенте нет. Секреты во frontend не клались.

## Итог багов

Аудит этапа 8 (`BUG_AUDIT.md`) остаётся в силе: Critical/High из того списка закрыты. Новых игровых багов на этапе 9 не вводилось.

Открытые внешние блокеры: пустые VK/URL и отсутствие физического телефона. См. `PRODUCTION_BLOCKERS.md`.

## Smoke (по коду)

Open → Menu → Tutorial → Play → Pause → Resume → Event → Achievement → Daily → Game Over → XP → Leaderboard (local) → Share fallback → Profile → Play Again.

Offline: пустой `apiBaseUrl` = Local Mode.

VK failure: Guest Mode.

Phone: **NOT TESTED**.

```text
READY FOR USER TESTING: YES
READY FOR SERVER DEPLOYMENT: YES
READY FOR VK CONFIGURATION: YES
READY FOR PRODUCTION: NO
```
