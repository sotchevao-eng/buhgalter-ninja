# API reference — Бухгалтер-ниндзя 0.9.0

Только существующие маршруты из `server/src/index.js` и `server/src/routes.js`.
Базовый префикс API: `/api/v1`.
Ошибки: `{ "error": { "code": "...", "message": "..." } }`.
Сессия игрока: заголовок `Authorization: Bearer <token>` после `POST /api/v1/auth/vk`.

Общие коды: `RATE_LIMIT` (429), `MAINTENANCE` (503), `NOT_FOUND` (404), `SERVER_ERROR` (500), `UNAUTHORIZED` (401).

---

## GET /api/health

**Auth:** нет.

**Purpose:** проверка процесса и PostgreSQL.

**Request:** без тела.

**Response:** `{ "status": "ok" }` или `{ "status": "maintenance" }`. При недоступной БД: HTTP 503 `{ "status": "error", "db": false }`.

**Errors:** 503 если БД не отвечает.

---

## POST /api/v1/events

**Auth:** нет.

**Purpose:** техническое событие аналитики (имя из белого списка).

**Request:** `{ "name": "game_open", "gameVersion": "0.9.0" }`

Разрешённые `name`: `game_open`, `game_start`, `game_over`, `share_click`, `community_click`, `leaderboard_open`, `daily_complete`, `tutorial_start`, `achievement_unlock`, `level_up`.

**Response:** `{ "ok": true }`

**Errors:** `INVALID_EVENT` (400).

---

## POST /api/v1/auth/vk

**Auth:** нет. Нужны launch-параметры VK и `VK_APP_SECRET` на сервере.

**Purpose:** проверка подписи Mini Apps (HMAC-SHA256 по `vk_*`) и выдача сессии.

**Request:** `{ "launchSearch": "?vk_user_id=...&sign=...", "displayName": "Имя", "avatarUrl": "https://..." }`

**Response:** `{ "token": "...", "player": { "id", "displayName", "avatarUrl" }, "progress": {...}, "serverDate": "YYYY-MM-DD" }`

**Errors:** `SERVER_MISCONFIGURED` (503) если нет `VK_APP_SECRET`; `401` если подпись неверна (`verified.code` из `vkSign`).

---

## GET /api/v1/me

**Auth:** Bearer.

**Purpose:** текущий игрок.

**Request:** нет тела.

**Response:** `{ "id", "displayName", "avatarUrl", "createdAt", "lastSeenAt" }`

**Errors:** `UNAUTHORIZED`.

---

## GET /api/v1/me/progress

**Auth:** Bearer.

**Purpose:** прогресс, достижения, задание дня, серверная дата.

**Request:** нет тела.

**Response:** `{ "progress": {...}, "achievements": [{ "id", "unlockedAt" }], "daily": {...}, "serverDate" }`

**Errors:** `UNAUTHORIZED`.

---

## PUT /api/v1/me/progress

**Auth:** Bearer.

**Purpose:** безопасное слияние рекордов и списка достижений (только рост, allowlist id).

**Request:** `{ "highScore": 0, "bestCombo": 0, "maxGameLevel": 1, "achievements": ["id"] }`

**Response:** `{ "progress": {...}, "serverDate" }`

**Errors:** `UNAUTHORIZED`.

---

## POST /api/v1/me/migrate-local

**Auth:** Bearer.

**Purpose:** перенос локальных рекордов в облако без обнуления XP.

**Request:** `{ "highScore", "bestCombo", "maxGameLevel", "playerLevel", "achievements" }`

**Response:** `{ "ok": true, "progress": {...} }`

**Errors:** `UNAUTHORIZED`.

---

## GET /api/v1/me/achievements

**Auth:** Bearer.

**Purpose:** список открытых достижений.

**Request:** нет тела.

**Response:** `{ "achievements": [{ "id", "unlockedAt" }] }`

**Errors:** `UNAUTHORIZED`.

---

## POST /api/v1/me/daily/claim

**Auth:** Bearer.

**Purpose:** забрать награду задания дня один раз.

**Request:** без обязательного тела.

**Response:** `{ "ok": true, "xp", "progress", "daily", "serverDate" }`

**Errors:** `NOT_COMPLETED` (400), `ALREADY_CLAIMED` (409), `UNAUTHORIZED`.

---

## POST /api/v1/game/session

**Auth:** Bearer.

**Purpose:** начать игровую сессию.

**Request:** `{ "gameVersion": "0.9.0" }`

**Response:** `{ "sessionId": "<uuid>", "startedAt": "..." }`

**Errors:** `UNAUTHORIZED`.

---

## POST /api/v1/game/session/:id/finish

**Auth:** Bearer.

**Purpose:** закрыть сессию, проверить результат, начислить XP. Повторный finish той же сессии идемпотентен.

**Request:** поля партии (`score`, `level`, `bestCombo` / `maxCombo`, `durationMs`, `gameVersion` и связанные счётчики). Сервер сверяет их в `scoreRules`.

**Response (ok):** `{ "ok": true, "status": "completed", "scoreFlag", "score", "xpGained", "progress", "public" }`

**Response (повтор):** `{ "ok", "idempotent": true, "status", "scoreFlag", "score" }`

**Errors:** `SESSION_NOT_FOUND` (404), `FORBIDDEN` (403), `IMPOSSIBLE_RESULT` / код `scoreRules` (400), `UNAUTHORIZED`.

---

## GET /api/v1/leaderboard

**Auth:** необязательно. Bearer добавляет поле `me`.

**Purpose:** топ-25. Период: `?period=today|week|all` (иначе `all`). Часовой пояс: `LEADERBOARD_TIMEZONE`.

**Request:** query `period`.

**Response:** `{ "period", "timezone", "weekStart": "monday", "me": { "position", "score", "bestCombo" } | null, "rows": [...] }`

**Errors:** обычные 5xx / maintenance.

---

## GET /api/v1/leaderboard/me

**Auth:** Bearer.

**Purpose:** позиция текущего игрока.

**Request:** query `period` как выше.

**Response:** `{ "period", "timezone", "position", "score", "bestCombo" }`

**Errors:** `UNAUTHORIZED`.
