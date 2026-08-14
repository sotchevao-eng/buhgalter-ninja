# TEST_MATRIX — Бухгалтер-ниндзя 0.8.0

Актуально и для 0.9.0: игровая механика не менялась. Новые пункты этапа 9 — в `RELEASE_CHECKLIST.md` и `PHONE_TEST_PLAN.md`.

Статусы: Pass / Fail / Blocked / Not Run.

| ID | Сценарий | Статус | Заметки |
|---|---|---|---|
| TM-01 | Первый запуск, пустой storage | Pass | Код создаёт defaults; повреждённый JSON ловится |
| TM-02 | Миграция старого storage | Pass | `migrateStorage` + sanitize |
| TM-03 | Повреждённый JSON / неверный тип | Pass | fallback + `sanitizePlayerStats` |
| TM-04 | Loading → Menu | Pass | Код пути boot |
| TM-05 | Двойной ИГРАТЬ / НАЧАТЬ | Pass | `_startLock` в `startGame` |
| TM-06 | Один game loop | Pass | `stopLoop` перед новым RAF |
| TM-07 | Pause / Resume | Pass | Без автопродолжения |
| TM-08 | visibilitychange | Pass | Пауза, не resume |
| TM-09 | Game Over один раз | Pass | Guard `state === gameover` |
| TM-10 | Restart сбрасывает run | Pass | `resetRun` |
| TM-11 | Столкновения / double hit | Pass | `dead` до `handleCatch` |
| TM-12 | Fair spawn | Pass | Три дорожки, лимит плохих |
| TM-13 | Клавиатура / touch / pointercancel | Pass | `bindPad` |
| TM-14 | Combo ×10 / ×20 ниндзя | Pass | HUD ≥ 20 |
| TM-15 | Счёт без NaN | Pass | sanitize + `Number()` в UI |
| TM-16 | События / боссы | Pass | reset recentIds; FNS bias |
| TM-17 | Обучение 4 шага | Pass | Не отнимает жизнь на шаге 3 |
| TM-18 | Достижения один раз | Pass | `unlocked[id]` guard |
| TM-19 | Очередь наград | Pass | Debounce claim |
| TM-20 | Daily claim / double claim | Pass | Клиент `rewardClaimed`; сервер FOR UPDATE |
| TM-21 | Streak | Pass | Локально по дате; сервер в finish |
| TM-22 | XP / ранг / рекорд | Pass | Merge XP не понижает |
| TM-23 | XSS имён | Pass | Только `textContent` |
| TM-24 | VK timeout → Guest | Pass | Существующий fallback v0.6 |
| TM-25 | Backend down → Local | Pass | Пустой `apiBaseUrl` / catch |
| TM-26 | Finish race / impossible score | Pass | FOR UPDATE; duration/level rules |
| TM-27 | Leaderboard sort / one row | Pass | Unit-тесты uniqueness |
| TM-28 | Health + DB | Pass | `SELECT 1`, 503 если БД нет |
| TM-29 | Секреты во frontend | Pass | Нет `VK_APP_SECRET` |
| TM-30 | DEBUG=false | Pass | Панель скрыта |
| TM-31 | Мобильные 360/390/430 | Not Run | Нужен ручной прогон в браузере |
| TM-32 | Десктоп 1366 / 1920 | Not Run | Нужен ручной прогон |
| TM-33 | VK внутри приложения | Blocked | Нет реального App ID |
| TM-34 | Онлайн рейтинг live | Blocked | Нет production API |
| TM-35 | npm audit | Pass | 0 vulnerabilities |
| TM-36 | Unit tests | Pass | 15/15 |
