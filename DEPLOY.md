# Выкладка «Бухгалтер-ниндзя» на сервер

Инструкция для человека, который не занимается Linux каждый день. Не выполняйте команды, которых нет в этом файле, если не понимаете, что они делают.

**Не используйте** `rm -rf`, `DROP DATABASE` и `DROP TABLE`, если не делаете осознанный снос данных.

Перед любой миграцией на уже живой базе сделайте backup PostgreSQL.

Реальные значения VK и домена сюда не подставляются заранее. Их нужно получить отдельно и вписать в `.env` и `js/runtime-config.js`.

Frontend **не собирается**. Сборщик не нужен. Достаточно скопировать HTML/CSS/JS и запустить Node API.

---

## 1. Подготовить сервер

Нужен VPS с Ubuntu (или похожей системой), доступ по SSH и домен, который вы купите сами. Домен в этой инструкции обозначен как `YOUR_DOMAIN`.

Что должно произойти: вы можете зайти на сервер командой `ssh`.

---

## 2. Установить Node.js

На сервере:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

Что должно произойти: команда `node -v` покажет версию 18 или новее.

---

## 3. Установить PostgreSQL

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Что должно произойти: служба PostgreSQL запущена.

---

## 4. Создать пользователя БД

Замените `YOUR_DB_PASSWORD` на свой пароль. Не публикуйте его.

```bash
sudo -u postgres psql
```

В консоли PostgreSQL:

```sql
CREATE USER ninja WITH PASSWORD 'YOUR_DB_PASSWORD';
CREATE DATABASE accountant_ninja OWNER ninja;
\q
```

Что должно произойти: появилась база `accountant_ninja`.

---

## 5. Создать БД

База уже создана командой выше. Проверка:

```bash
sudo -u postgres psql -c '\l'
```

Что должно произойти: в списке есть `accountant_ninja`.

---

## 6. Клонировать проект

Используйте ветку `main`, если не договорились иначе. Скрипт деплоя **не** делает `git pull` сам.

```bash
sudo mkdir -p YOUR_PROJECT_PATH
sudo chown $USER:$USER YOUR_PROJECT_PATH
git clone YOUR_GIT_URL YOUR_PROJECT_PATH
cd YOUR_PROJECT_PATH
git checkout main
```

Что должно произойти: в папке есть `index.html` и каталог `server/`.

---

## 7. Создать .env

```bash
cd YOUR_PROJECT_PATH/server
cp .env.example .env
nano .env
```

Заполните минимум:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://ninja:YOUR_DB_PASSWORD@127.0.0.1:5432/accountant_ninja
CORS_ORIGIN=https://YOUR_DOMAIN
FRONTEND_URL=https://YOUR_DOMAIN
API_PUBLIC_URL=https://YOUR_DOMAIN
VK_APP_ID=
VK_GROUP_ID=
VK_APP_SECRET=
VK_COMMUNITY_URL=
SESSION_SECRET=
LEADERBOARD_TIMEZONE=Europe/Moscow
MAINTENANCE_MODE=false
```

Пока нет данных VK, оставьте `VK_*` пустыми. API запустится, вход через VK будет недоступен, игра останется локальной.

В `js/runtime-config.js` (в корне проекта, не в server) можно указать публичные значения:

```javascript
apiBaseUrl: 'https://YOUR_DOMAIN',
communityUrl: '',
vkAppId: '',
vkGroupId: '',
appLaunchUrl: ''
```

Секрет приложения сюда не пишите.

Что должно произойти: файл `.env` есть на сервере и не попадает в Git.

---

## 8. Выполнить migrations

Если база уже с данными игроков, сначала backup:

```bash
pg_dump -U ninja -h 127.0.0.1 accountant_ninja > backups/before-migrate.sql
```

Затем:

```bash
cd YOUR_PROJECT_PATH/server
npm ci --omit=dev
npm run migrate
```

Что должно произойти: в логе `applied migration` или `migrations ok`. Таблицы не удаляются этими миграциями.

---

## 9. Запустить backend

Проверка вручную:

```bash
cd YOUR_PROJECT_PATH/server
NODE_ENV=production node src/index.js
```

Что должно произойти: строка `accountant-ninja api on :3001`.

Остановка: Ctrl+C.

Постоянный запуск через systemd:

```bash
sudo cp YOUR_PROJECT_PATH/deploy/accountant-ninja.service.example /etc/systemd/system/accountant-ninja.service
sudo nano /etc/systemd/system/accountant-ninja.service
```

Подставьте `YOUR_APP_USER` и `YOUR_PROJECT_PATH`. Затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now accountant-ninja
sudo systemctl status accountant-ninja
```

Что должно произойти: статус `active (running)`. После сбоя служба перезапустится, но не будет крутиться бесконечно, если ENV сломан (`StartLimitBurst=5`).

---

## 10. Настроить Nginx

```bash
sudo apt-get install -y nginx
sudo cp YOUR_PROJECT_PATH/deploy/nginx/accountant-ninja.conf.example /etc/nginx/sites-available/accountant-ninja
sudo nano /etc/nginx/sites-available/accountant-ninja
```

Замените `YOUR_DOMAIN` и `YOUR_PROJECT_PATH`. Включите сайт:

```bash
sudo ln -s /etc/nginx/sites-available/accountant-ninja /etc/nginx/sites-enabled/accountant-ninja
sudo nginx -t
```

Что должно произойти: `nginx: configuration file ... syntax is ok`.

Пока нет сертификата, не перезапускайте сайт с `listen 443`, если файлы SSL ещё не существуют. Сначала шаг 12 или временно оставьте только HTTP для проверки на самом сервере.

---

## 11. Подключить домен

В панели регистратора домена укажите A-запись на IP сервера.

Что должно произойти: `ping YOUR_DOMAIN` доходит до сервера (это может занять время из‑за DNS).

---

## 12. Подключить HTTPS

Рекомендуемый способ — Let's Encrypt:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
sudo systemctl reload nginx
```

Что должно произойти: сайт открывается по `https://YOUR_DOMAIN`, а `http://` перенаправляет на `https://`.

Без HTTPS ВКонтакте мини-приложение не примет.

---

## 13. Проверить /api/health

```bash
curl -fsS https://YOUR_DOMAIN/api/health
```

Что должно произойти: `{"status":"ok"}`. Не должно быть паролей, ENV и адресов базы.

Если включён `MAINTENANCE_MODE=true`, ответ будет `{"status":"maintenance"}`, а игра останется доступной локально.

---

## 14. Проверить frontend

Откройте `https://YOUR_DOMAIN` в браузере.

Что должно произойти: экран загрузки «Загружаем первичку...», затем кнопка **ИГРАТЬ**. Белого экрана быть не должно.

В `js/runtime-config.js` поле `apiBaseUrl` должно быть `https://YOUR_DOMAIN` (или ваш API URL), без `localhost`.

---

## 15. Проверить VK

Актуальные шаги создания приложения смотрите только в официальной документации:

- https://dev.vk.com/ru/mini-apps/getting-started
- https://dev.vk.com/ru/mini-apps/settings/general/information
- https://dev.vk.com/ru/mini-apps/settings/moderation
- https://dev.vk.com/ru/mini-apps/development/launch-params-sign
- https://dev.vk.com/ru/bridge/overview
- https://dev.vk.com/ru/mini-apps-rules

Кратко, без выдуманных пунктов интерфейса:

1. Откройте кабинет разработчика VK.
2. Создайте приложение типа Mini Apps.
3. Скопируйте ID приложения в `VK_APP_ID` и в `js/runtime-config.js` (`vkAppId`).
4. Защищённый ключ вставьте только в `server/.env` как `VK_APP_SECRET`.
5. В настройках размещения укажите HTTPS URL игры.
6. Добавьте домен в разрешённые. Для пользователей `vk.ru` домен `vk.ru` тоже должен быть в доверенных, если такая настройка есть — **этот шаг необходимо проверить в актуальной документации VK**.
7. Привязка к сообществу: в разделе информации приложения есть выбор официального сообщества и запуск из сообщества. Названия пунктов сверяйте с текущим кабинетом.
8. Проверьте запуск внутри VK, Guest fallback в обычном браузере, кнопку сообщества и шаринг.
9. Отправьте на модерацию, если это требуется текущими правилами.

Что должно произойти: пользователь открывает сообщество → запускает игру → видит загрузку и кнопку **ИГРАТЬ**.

---

## Обновление версии

После выкладки новой версии пользователи VK должны получить новые JS/CSS за счёт параметра `?v=0.9.0` в `index.html`. При следующем релизе увеличьте `APP_VERSION` и этот параметр.

`index.html` в Nginx не кэшируется агрессивно.

---

## Backup перед серьёзной миграцией

```bash
mkdir -p YOUR_PROJECT_PATH/backups
pg_dump -U ninja -h 127.0.0.1 accountant_ninja > YOUR_PROJECT_PATH/backups/$(date +%F).sql
```

Файлы dump не коммитьте в Git.

## Restore

Restore **перезаписывает данные** в выбранной базе. Выполнять только осознанно, после отдельного backup.

Пример (пароль не публиковать):

```bash
sudo systemctl stop accountant-ninja
psql -U ninja -h 127.0.0.1 -d accountant_ninja < YOUR_PROJECT_PATH/backups/YYYY-MM-DD.sql
sudo systemctl start accountant-ninja
curl -fsS http://127.0.0.1:3001/api/health
```

Если restore прошёл с ошибкой: не тот файл dump; база не пуста и конфликтуют объекты — не продолжайте вслепую, вернитесь к свежему backup.

---

## Режим обслуживания

В `.env`:

```env
MAINTENANCE_MODE=true
```

Затем:

```bash
sudo systemctl restart accountant-ninja
```

Игроки смогут играть локально. Онлайн-рейтинг покажет, что временно недоступен.
