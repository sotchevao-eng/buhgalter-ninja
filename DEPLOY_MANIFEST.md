# Deploy manifest — Бухгалтер-ниндзя 0.9.0

Фактическая раскладка проекта: frontend лежит в корне, не в папке `frontend/`.

## Загружать на сервер

```text
index.html
privacy.html
terms.html
css/
js/
assets/
server/package.json
server/package-lock.json
server/src/
server/migrations/
server/.env.example
deploy/
docker-compose.dev.yml   (только если нужен локальный Postgres на этой машине)
README.md
DEPLOY.md
FIRST_DEPLOY.md
```

Frontend не собирается. Отдельного `dist/` нет.

## Не загружать

```text
node_modules/
.git/
server/.env
*.log
backups/*.sql
dev screenshots
временные файлы редактора
локальную тестовую базу PostgreSQL
```

`server/.env` создаётся на сервере из `.env.example`, секреты туда не копируются из рабочей машины разработчика без необходимости.

## После загрузки

```bash
cd YOUR_PROJECT_PATH/server
npm ci --omit=dev
npm run migrate
```

Nginx и systemd: примеры в `deploy/nginx/accountant-ninja.conf.example` и `deploy/accountant-ninja.service.example`.
Скрипт обновления: `deploy/deploy.sh.example` — не удаляет БД, `.env` и uploads; `git pull` сам не делает.
