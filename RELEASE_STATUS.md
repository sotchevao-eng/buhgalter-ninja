# Статус релиза — Бухгалтер-ниндзя 0.9.0

Внутренний статус: **PRODUCTION CANDIDATE**.
Игрокам показывать только «Версия 0.9.0», без «RC».

```text
READY FOR USER TESTING: YES

READY FOR PRODUCTION: NO
```

## Почему тестирование уже можно

Локальный запуск через `index.html` / HTTP-сервер работает без VK и без backend.
Guest Mode и Local Mode предусмотрены. Автотесты backend проходят.

## Почему production ещё нельзя

См. `PRODUCTION_BLOCKERS.md`: нет реальных VK ID, HTTPS URL, защищённого ключа на сервере и прогона на физических телефонах.

## Для READY FOR PRODUCTION: YES необходимо

- [ ] заполнен production URL (`FRONTEND_URL` / `appLaunchUrl`)
- [ ] HTTPS работает
- [ ] backend доступен (`GET /api/health` → ok)
- [ ] production DB работает
- [ ] `VK_APP_ID` получен
- [ ] `VK_GROUP_ID` получен
- [ ] `VK_APP_SECRET` задан только в server `.env`
- [ ] VK Mini App указывает на HTTPS URL
- [ ] игра открывается внутри VK
- [ ] Android test пройден
- [ ] iPhone test пройден или ограничение зафиксировано
- [ ] Critical bugs = 0
- [ ] High release blockers = 0
- [ ] заполнены оператор / контакт / дата в `privacy.html` и `terms.html`

Этот файл не переводить в YES автоматически: нужны внешние факты, не только код.
