# Значения, которые нужно получить владельцу проекта

Заполняется вручную после регистрации Mini App и покупки домена.
Секреты в этот файл не писать.

VK_APP_ID:
[не заполнено]

VK_GROUP_ID:
[не заполнено]

VK_COMMUNITY_URL:
[не заполнено]

FRONTEND_URL:
[не заполнено]

API_PUBLIC_URL:
[не заполнено]

VK_APP_SECRET:
настроить в server .env

Куда вносить публичные значения после получения:

- `js/runtime-config.js`: `vkAppId`, `vkGroupId`, `communityUrl`, `appLaunchUrl`, `apiBaseUrl`
- `server/.env`: те же URL плюс секреты

Куда нельзя вносить:

- `VK_APP_SECRET`, `SESSION_SECRET`, `DATABASE_URL` — только backend `.env`
