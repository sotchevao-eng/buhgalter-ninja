# Release notes — Бухгалтер-ниндзя 0.9.0

PRODUCTION CANDIDATE. Игрокам видна только версия **0.9.0**.

## Gameplay

Игровая механика не менялась относительно 0.8.0: обучение на поле, справедливый спавн, ниндзя-режим с Combo ×20, подтверждение выхода с паузы.

## VK

Подготовка к Mini Apps: единый публичный `js/runtime-config.js`, чеклист кабинета, список значений для владельца. Реальные ID и секрет не подставлялись. Без VK игра остаётся в Guest Mode.

## Online

Backend 0.9.0: те же маршруты `/api/health` и `/api/v1/*`. Пустой `apiBaseUrl` = Local Mode. Preflight: `cd server && npm run preflight`.

## Mobile

План теста Android / iPhone (VK + браузер) записан в `PHONE_TEST_PLAN.md`. Фактический прогон: **NOT TESTED**.

## Security

DEBUG и PLAYTEST выключены. `mockVKUser` в production отключён. Нет URL-бэкдоров `?debug=` / `?admin=`. Секреты только в server `.env`. Подпись VK по-прежнему HMAC-SHA256.

## Fixes

Снижен шум в консоли (параметры запуска и guest-предупреждения только при DEBUG). События аналитики на сервере в production не логируются. Конфиг проверяется `validateConfig()` без блокировки локальной разработки.

## Known limitations

- Нет реальных VK / доменных значений.
- Нет спрайтов `.webp` и файла логотипа: Canvas и текст.
- Нет звуковых файлов: синтез Web Audio.
- Юридические поля оператора не заполнены.
- Физические телефоны не проверены.
