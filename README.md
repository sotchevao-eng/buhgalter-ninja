# Бухгалтер-ниндзя

Динамичная браузерная аркада на бухгалтерскую тематику: ловите документы и оплаты, избегайте штрафов, сдавайте отчётность и держите Combo.

Подзаголовок: **«Спаси отчётность. Победи дедлайны.»**

Версия: **0.9.0** (PRODUCTION CANDIDATE; игрокам показывается только номер версии)

Игра готова к пользовательскому тесту в браузере. Для публикации нужны реальные VK ID, HTTPS-домен и прогон на телефонах — см. `PRODUCTION_BLOCKERS.md`. Frontend не собирается.

## Как запустить

1. Откройте папку проекта в Cursor / VS Code.
2. Запустите локальный HTTP-сервер — так надёжнее, чем `file://`.

Примеры:

- расширение **Live Server**: «Open with Live Server» на `index.html`;
- либо в терминале из папки проекта:

```text
python -m http.server 8080
```

3. Откройте в браузере адрес локального сервера, например `http://localhost:8080`.

Для быстрой проверки можно открыть `index.html` двойным щелчком. Для публикации, шаринга и VK Mini Apps нужен **HTTPS**.

## Управление

```text
← → или A/D — движение
P — пауза
Space — начать / продолжить
```

На телефоне внизу экрана две крупные кнопки ◀ ▶. Можно удерживать.

## Структура проекта

```text
accountant-ninja/
├── index.html
├── privacy.html
├── terms.html
├── css/style.css
├── js/
│   ├── config.js
│   ├── runtime-config.js
│   ├── storage.js
│   ├── playerData.js
│   ├── api.js
│   ├── analytics.js
│   ├── leaderboard.js
│   ├── vk.js
│   ├── audio.js
│   ├── sprites.js
│   ├── player.js
│   ├── objects.js
│   ├── achievements.js
│   ├── daily.js
│   ├── sync.js
│   ├── rewards.js
│   ├── events.js
│   ├── resultCard.js
│   ├── ui.js
│   └── game.js
├── assets/
├── server/
├── deploy/
├── docker-compose.dev.yml
├── DEPLOY.md
├── FIRST_DEPLOY.md
├── DEPLOY_MANIFEST.md
├── PRE_PUBLISH_CHECKLIST.md
├── PRODUCTION_BLOCKERS.md
├── VK_SETUP_CHECKLIST.md
├── VK_VALUES_REQUIRED.md
├── API_REFERENCE.md
├── DATABASE_SCHEMA.md
├── ASSET_INVENTORY.md
├── PHONE_TEST_PLAN.md
├── RELEASE_STATUS.md
├── RELEASE_NOTES_v0.9.md
├── USER_TEST_INSTRUCTIONS.md
├── BUG_AUDIT.md
├── TEST_MATRIX.md
├── QA_REPORT.md
├── RELEASE_CHECKLIST.md
├── USER_TEST_PLAN.md
├── USER_FEEDBACK_TEMPLATE.md
└── README.md
```

- `js/game.js` — игровая логика и цикл Canvas. Не вызывает VK Bridge и SQL напрямую.
- `js/vk.js` — `VKService` и `EnvAdapter`. Вне VK игра работает в гостевом режиме.
- `js/api.js` — HTTP-клиент. Если `apiBaseUrl` пустой, сеть не вызывается.
- `js/sync.js` — `SyncService` / гибридный профиль. Не блокирует кнопку «Играть».
- `js/storage.js` — `StorageService` / `AchievementStorage`, ключи `accountantNinja_*`.
- `js/leaderboard.js` — `LeaderboardService`: LOCAL MODE или онлайн TOP.
- `js/analytics.js` — технические события на свой backend, без сторонних трекеров и без профиля VK.
- `js/config.js` — флаги, плейсхолдеры VK, `APP_VERSION`, `DEBUG`, `apiBaseUrl`.
- `js/runtime-config.js` — публичные production URL/ID без секретов.
- `server/` — Express + PostgreSQL. Подробности в `server/README.md`.
- `DEPLOY.md` — пошаговая выкладка на сервер.
- `PRE_PUBLISH_CHECKLIST.md` — проверка перед публикацией.

Сборщик (webpack/vite) не используется и не нужен. Команды `npm run build` нет: статические файлы отдаются как есть.

---

# Development

Локально:

```text
python -m http.server 8080
```

Backend (по желанию):

```text
docker compose -f docker-compose.dev.yml up -d
cd server
copy .env.example .env
npm install
npm test
npm run preflight
npm start
```

`localhost` допустим только в development. В production его быть не должно.

# Production

См. `FIRST_DEPLOY.md` и `DEPLOY.md`. Кратко: Node.js 18+, PostgreSQL, Nginx, HTTPS, systemd. API проксируется на `/api/`. Переменные — `server/.env`. Публичные URL — `js/runtime-config.js`. Перед выкладкой: `cd server && npm run preflight`.

# VK

Официальные источники (проверять перед публикацией):

- https://dev.vk.com/ru/mini-apps/getting-started
- https://dev.vk.com/ru/mini-apps/settings/general/information
- https://dev.vk.com/ru/mini-apps/settings/moderation
- https://dev.vk.com/ru/mini-apps/development/launch-params-sign
- https://dev.vk.com/ru/bridge/overview
- https://dev.vk.com/ru/mini-apps-rules

## Создание приложения VK

1. Откройте официальный кабинет разработчика VK.
2. Создайте приложение подходящего типа для Mini Apps.
3. Получите ID приложения.
4. Добавьте production HTTPS URL.
5. Настройте разрешённый домен.
6. При необходимости укажите URL backend.
7. Проверьте launch params.
8. Настройте связь с сообществом.
9. Протестируйте приложение.
10. Отправьте на публикацию/модерацию, если это требуется текущими правилами.

Точные названия пунктов кабинета могут измениться. **Этот шаг необходимо проверить в актуальной документации VK.**

## Привязка игры к сообществу VK

По актуальной документации в настройках информации приложения выбирается официальное сообщество, в котором создатель является администратором. Отдельно включается запуск приложения из сообщества. Сменить сообщество после модерации можно ограниченно — срок указан в документации VK.

Не придумывайте ID сообщества по URL. Числовой ID вставляется в `VK_GROUP_ID` и `vkGroupId`, ссылка — в `VK_COMMUNITY_URL` / `communityUrl`.

# Backend

`cd server && npm start` поднимает API и применяет миграции. Health: `GET /api/health`. Секреты только в ENV.

# Database

PostgreSQL. Миграции: `cd server && npm run migrate`. Перед серьёзной миграцией на живых данных — `pg_dump`. Текущие миграции таблицы не удаляют.

# Environment variables

Шаблон: `server/.env.example`. Нужно заполнить владельцу проекта: `DATABASE_URL`, `CORS_ORIGIN`, `VK_APP_ID`, `VK_GROUP_ID`, `VK_APP_SECRET`, `VK_COMMUNITY_URL`, `FRONTEND_URL`, `API_PUBLIC_URL`, `SESSION_SECRET` (по желанию, как перец токенов).

# Deployment

Пошагово: `DEPLOY.md`. Пример Nginx: `deploy/nginx/accountant-ninja.conf.example`. systemd: `deploy/accountant-ninja.service.example`.

# Troubleshooting

- Белый экран: открывайте через HTTP(S), не `file://`.
- Нет рейтинга: проверьте `apiBaseUrl`, `/api/health` и CORS.
- Игра есть, синхронизации нет: это нормальный LOCAL MODE.
- VK не открывается в iframe: не ставьте `X-Frame-Options: DENY`.
- После обновления старый JS: увеличьте `?v=` в `index.html`.

---

# Онлайн-режим

Пока `APP_CONFIG.apiBaseUrl` в `js/config.js` пустой, игра **не обращается к серверу**.

Чтобы включить API локально:

1. Поднимите PostgreSQL: `docker compose -f docker-compose.dev.yml up -d`
2. В `server/` скопируйте `.env.example` → `.env`, затем `npm install` и `npm start`
3. Укажите `APP_CONFIG.apiBaseUrl = 'http://localhost:3001'`
4. Игру по-прежнему раздавайте: `python -m http.server 8080`

Глобальный рейтинг доступен только идентифицированным пользователям VK после проверки подписи launch-параметров. Гость и офлайн-партия без сессии сохраняют **личный локальный рекорд**, но не попадают в общую таблицу автоматически.

`LEADERBOARD_TIMEZONE=Europe/Moscow`. Неделя начинается в понедельник. Ничья: выше score → выше Combo → кто раньше получил результат.

Проверка результатов на сервере — **базовая защита, не anti-cheat**. Невозможные партии отклоняются, подозрительные помечаются и скрываются из публичного TOP. Автобан нет.

Секреты (`VK_APP_SECRET`, `DATABASE_URL`) только в ENV сервера, не во frontend.

`VK_APP_ID` и `VK_APP_SECRET` нужно взять в кабинете разработчика VK Mini Apps и вставить в `server/.env`. Production URL / HTTPS домен — когда они будут выданы, не выдумывать заранее.

---

# Подготовка к публикации во ВКонтакте

**Перед публикацией необходимо ещё раз проверить актуальные требования VK Mini Apps.** Требования площадки могут измениться.

## 1. Архитектура VKService

```text
GAME CORE (game.js, player.js, objects.js)
    ↓
Environment Adapter (EnvAdapter / VKService)
    ↓
Browser  или  VK Bridge
```

Если Bridge недоступен, истекает таймаут или метод не поддерживается — игра продолжает работу как сайт (Guest Mode). Кнопка **ИГРАТЬ** никогда не блокируется из‑за профиля.

Вся работа с VK сосредоточена в `js/vk.js`. Игровой цикл вызывает только адаптер: пауза, haptic, шаринг через UI.

## 2. Где задаётся VK App ID

Файл `js/config.js`, поле:

```javascript
APP_CONFIG.vkAppId = ''
```

Вставьте числовой ID приложения VK, когда он будет получен в кабинете разработчика. Не придумывайте значение заранее.

## 3. Где задаётся Group ID

```javascript
APP_CONFIG.vkGroupId = ''
```

Вставьте числовой ID сообщества без минуса, например `123456789`. Пока поле пустое, игра не вызывает `VKWebAppJoinGroup`.

## 4. Где задаётся URL сообщества

```javascript
APP_CONFIG.communityUrl = ''
APP_CONFIG.appLaunchUrl = ''
```

`communityUrl` — HTTPS-ссылка на сообщество, например `https://vk.com/your_club`.

`appLaunchUrl` — HTTPS-ссылка на игру / мини-приложение после публикации. Пока пусто, шаринг во VK передаёт ссылку по умолчанию самой платформы (без localhost).

## 5. Как запускается Guest Mode

Guest Mode включается автоматически, если:

- страница открыта в обычном браузере;
- нет параметров `vk_user_id` / `vk_app_id` / `vk_platform`;
- VK Bridge не загрузился;
- `VKWebAppInit` не успел за `APP_CONFIG.vkInitTimeoutMs` (2,5 с);
- профиль получить не удалось.

Игрок видит приветствие «Добро пожаловать, Бухгалтер-ниндзя!» и может сразу нажать **ИГРАТЬ**.

## 6. Какие официальные методы VK используются

Подключается официальная библиотека `@vkontakte/vk-bridge` (browser-сборка, только внутри VK).

Методы из [документации VK Bridge](https://dev.vk.com/ru/bridge/overview):

| Метод | Зачем |
| --- | --- |
| `VKWebAppInit` | обязательная инициализация мини-приложения |
| `VKWebAppGetLaunchParams` | параметры запуска и платформа |
| `VKWebAppGetUserInfo` | имя и аватар текущего пользователя (без лишних полей) |
| `VKWebAppShare` | поделиться ссылкой на игру |
| `VKWebAppShowInviteBox` | пригласить друзей по явному нажатию |
| `VKWebAppJoinGroup` | вступить в сообщество, только если задан реальный `vkGroupId` |
| `VKWebAppTapticNotificationOccurred` | haptic при бонусе / потере жизни / достижении, если `supports()` |

Не используются: выдуманные методы, секретные ключи, автоматические приглашения, фиктивный рейтинг людей.

## 7. Какие разрешения требуются

На этом этапе **дополнительные permissions не запрашиваются**.

`VKWebAppGetUserInfo` для текущего пользователя по документации не требует отдельных прав. Не запрашиваем друзей, сообщения, email, телефон и токены.

## 8. Как проверить приложение локально

1. Откройте игру через HTTP, не через `file://`.
2. Убедитесь, что главное меню открывается без VK.
3. Нажмите **ИГРАТЬ**, сыграйте партию, проверьте паузу и Game Over.
4. **Поделиться** в браузере без Web Share копирует текст в буфер.
5. **Рейтинг** показывает только личный рекорд и сообщение, что общий рейтинг появится позже.
6. Сверните вкладку во время игры: должна открыться **ПАУЗА**, без автопродолжения и без двойного игрового цикла.

## 9. Как проверить production

1. Загрузите все файлы на **HTTPS**-хостинг, сохранив относительные пути (`./css/style.css`, `./js/game.js`).
2. В кабинете VK Mini Apps укажите этот HTTPS URL.
3. Подставьте реальные `vkAppId`, `vkGroupId`, `communityUrl`, `appLaunchUrl`.
4. Откройте приложение внутри VK и пройдите цепочку: Loading → профиль/гость → меню → игра → пауза → Game Over → шаринг → рестарт.
5. Ещё раз сверьте актуальные требования VK перед модерацией.

## 10. Как отключить DEBUG

В `js/config.js`:

```javascript
const DEBUG = false;
```

В production должно быть `false`. Тогда скрыта отладочная панель, а `mockVKUser` не применяется.

Для локальной эмуляции профиля поставьте `DEBUG = true`. Тестовый пользователь не выдаётся за настоящего VK-игрока (`source: 'mock'`).

## HTTPS

Production **обязательно** должен открываться по HTTPS. HTTP и `file://` не подходят для VK Mini Apps.

В конфигурации нет абсолютных путей компьютера и нет `localhost` / `127.0.0.1` как боевых URL.

## Безопасность рейтинга

После появления публичной таблицы лидеров потребуется защита от подмены результатов на backend. `localStorage` нельзя считать безопасным источником общего рейтинга. Сложная античит-система на этом этапе не делается.

Секреты приложения, service token и пароли в клиентский JavaScript класть нельзя.

## Чек-лист разработчика

### VK Mode

Открытие → Loading → VK init → профиль → меню → игра → Pause → Game Over → Share → Restart.

### Guest Mode

Обычный браузер → VK отсутствует → Guest Mode → игра полностью работает.

### Фокус

Начать игру → свернуть страницу → вернуться → пауза на месте → «Продолжить» → скорость не прыгает, второй `requestAnimationFrame` игрового цикла не появляется.

### Share

1. VK: `VKWebAppShare`, если метод доступен.
2. Браузер с Web Share API.
3. Браузер без Web Share: clipboard и тост «Результат скопирован!».

## Что ещё нужно перед публикацией

- получить реальные `VK_APP_ID` и ID сообщества;
- указать HTTPS URL игры и сообщества;
- заполнить `[указать оператора]`, `[указать контакт]`, `[указать дату]` в `privacy.html` и `terms.html`;
- повторно проверить актуальные требования VK Mini Apps и модерацию;
- при необходимости включить онлайн-рейтинг: задать `APP_CONFIG.apiBaseUrl` и `VK_APP_SECRET` на сервере.

## Следующие шаги (не входят в готовность кода 0.9.0)

- заполнить реальные VK ID / secret / HTTPS URL (`VK_VALUES_REQUIRED.md`);
- пройти `VK_SETUP_CHECKLIST.md` и модерацию Mini Apps;
- прогнать `PHONE_TEST_PLAN.md`;
- при желании добавить спрайты и готовые звуки.

---

# Игровой профиль

VK-профиль (id, имя, аватар) и игровой профиль (XP, уровень, статистика) — разные сущности.

Экран **Мой профиль** показывает имя/аватар из VK или «Гость» / «Бухгалтер-ниндзя», постоянное звание, уровень игрока, XP, рекорды, карьеру и серию посещений.

Сервис: `PlayerDataService` (`js/playerData.js`). Локально — `LocalPlayerDataService`; при наличии API поверх него работает `SyncService`.

# XP и уровни

После партии: `earnedXP = Math.floor(score / 10)` плюс небольшой бонус за пройденные события и новые достижения.

`getXPRequiredForLevel(level)` растёт с уровнем: первые уровни быстро, дальше медленнее. Лишний XP не теряется при повышении уровня.

Уровень партии (`LVL` в HUD) и уровень профиля — разные числа.

# Достижения

Каталог из 28 достижений в `js/achievements.js`: первые шаги, мастерство, отчётность, выживание, карьера, документооборот, секреты. Проверка по `id`. Скрытые до открытия показываются как «???».

# Задание дня

Одно задание в календарный день. Выбор стабилен (seed от даты `YYYY-MM-DD`). Награда XP выдаётся один раз (`rewardClaimed`). Ключ: `accountantNinja_dailyChallenge`.

# Серия посещений

Если игрок заходит вчерашним днём — серия +1. Если сегодня уже заходил — без изменений. Если пропуск больше дня — серия начинается с 1, без наказаний в тексте.

# Хранение данных

Ключи `accountantNinja_*`. Основной объект прогресса: `accountantNinja_playerStats`. Версия хранилища: `accountantNinja_storageVersion` = 2.

Сохранение: после партии, достижения, задания, XP и при `visibilitychange` / `pagehide`. Не каждый кадр.

# Миграция localStorage

`migrateStorage()` переносит старые `highScore`, `maxCombo`, `maxLevel`, `gamesPlayed`, `lifetimeDocs`, `achievements` в `playerStats`. Старые ключи не удаляются.

# Ограничения локального режима

Пока `apiBaseUrl` пустой или сервер недоступен, данные привязаны к браузеру и `localStorage`. Гостевая партия без VK-сессии не отправляется в глобальный рейтинг.

В online mode ежедневные задания и серия опираются на серверную дату в `LEADERBOARD_TIMEZONE`. В Local Mode — на календарь устройства.

`debugDateOverride` и кнопки DEBUG работают только при `DEBUG === true`.
