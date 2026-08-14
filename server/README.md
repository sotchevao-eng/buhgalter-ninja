# Backend «Бухгалтер-ниндзя»

API для онлайн-рейтинга, сессий и синхронизации прогресса. Игровой frontend не ходит в PostgreSQL напрямую — только по HTTP.

Это **базовая защита рейтинга, не anti-cheat**. Невозможные результаты отклоняются, подозрительные помечаются и не попадают в публичную таблицу. Автобан не используется.

Production: `NODE_ENV=production npm start` (через systemd, см. `DEPLOY.md`). Frontend не собирается.

## Локальный запуск

1. Поднимите PostgreSQL, например:

```text
docker compose -f docker-compose.dev.yml up -d
```

из корня проекта.

2. Скопируйте переменные:

```text
cd server
copy .env.example .env
```

На Linux/macOS: `cp .env.example .env`.

3. Установите зависимости и запустите:

```text
npm install
npm test
npm run preflight
npm start
```

API по умолчанию: `http://localhost:3001`.

4. Health-check:

```text
GET http://localhost:3001/api/health
→ { "status": "ok" }
```

5. Игру по-прежнему раздавайте статикой:

```text
python -m http.server 8080
```

В `js/config.js` укажите `APP_CONFIG.apiBaseUrl = 'http://localhost:3001'`. Пока поле пустое, игра работает полностью локально.

## ENV

| Переменная | Назначение |
| --- | --- |
| `PORT` | Порт API |
| `DATABASE_URL` | Строка подключения PostgreSQL |
| `VK_APP_ID` | ID приложения VK (не выдумывать) |
| `VK_APP_SECRET` | Защищённый ключ приложения VK. Только на сервере |
| `CORS_ORIGIN` | Разрешённые origin, через запятую. В production нельзя `*` |
| `NODE_ENV` | `development` / `production` |
| `LEADERBOARD_TIMEZONE` | Часовой пояс рейтинга и daily. По умолчанию `Europe/Moscow` |
| `WEEK_START` | Начало недели. Для аудитории РФ — понедельник |
| `SESSION_TTL_DAYS` | Срок сессии API |

`VK_APP_SECRET` и `VK_APP_ID` нужно взять в кабинете разработчика VK Mini Apps. Пока их нет, оставьте пустыми: авторизация VK вернёт ошибку, локальная игра продолжит работать.

Production нужен HTTPS. Не храните секреты во frontend.

## Рейтинг

- Периоды: `today`, `week`, `all`.
- В TOP попадает **лучший результат игрока за период**, не все партии.
- Ничья: выше score → выше Combo → кто раньше получил результат.
- День и неделя считаются в `LEADERBOARD_TIMEZONE`. Неделя начинается в понедельник (`date_trunc('week')` в PostgreSQL).
- Подозрительные (`suspicious`) и отклонённые (`rejected`) результаты в публичный рейтинг не входят.
- `is_leaderboard_eligible = false` скрывает игрока из таблицы без удаления профиля.

## Авторизация

Клиент отправляет `window.location.search` на `POST /api/v1/auth/vk`. Сервер проверяет подпись launch-параметров официальным алгоритмом HMAC-SHA256 + Base64URL и **не доверяет** голому `vk_user_id`. После проверки выдаётся собственный Bearer-токен.

## Миграции

```text
npm run migrate
```

При `npm start` миграции применяются автоматически. Файлы лежат в `server/migrations/`.
