# Первая выкладка — Бухгалтер-ниндзя 0.9.0

Для человека без опыта DevOps. Домен везде обозначен как `YOUR_DOMAIN`. Реальный домен не подставляйте, пока его нет.

Нужны: **Node.js 18+** (лучше 20), **PostgreSQL**, **Nginx**, SSH-доступ. Git удобен, но не обязателен: можно скопировать файлы по `DEPLOY_MANIFEST.md`.

Не выполняйте `rm -rf`, `DROP DATABASE` и не публикуйте пароли.

---

## Шаг 1. Подготовка сервера

Ubuntu (или похожая система) + пользователь с `sudo`.

```bash
ssh YOUR_USER@YOUR_SERVER
```

**Ожидаемый результат:** вы в командной строке сервера.

Если получили ошибку: неверный IP/логин; ключ SSH не добавлен; порт 22 закрыт.

---

## Шаг 2. Загрузка проекта

```bash
sudo mkdir -p YOUR_PROJECT_PATH
sudo chown $USER:$USER YOUR_PROJECT_PATH
```

Скопируйте файлы из манифеста или клонируйте репозиторий, если он появится.

**Ожидаемый результат:** в `YOUR_PROJECT_PATH` есть `index.html` и папка `server/`.

Если получили ошибку: путь занят другим пользователем; не хватает прав.

---

## Шаг 3. Node.js и зависимости

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
cd YOUR_PROJECT_PATH/server
npm ci --omit=dev
```

**Ожидаемый результат:** `node -v` показывает v18 или новее, зависимости установлены.

Если получили ошибку: нет интернета; `package-lock.json` не загружен; запускали `npm ci` не из `server/`.

---

## Шаг 4. Production `.env`

```bash
cd YOUR_PROJECT_PATH/server
cp .env.example .env
nano .env
```

Минимум:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://ninja:YOUR_DB_PASSWORD@127.0.0.1:5432/accountant_ninja
CORS_ORIGIN=https://YOUR_DOMAIN
FRONTEND_URL=https://YOUR_DOMAIN
API_PUBLIC_URL=https://YOUR_DOMAIN
SESSION_SECRET=
VK_APP_ID=
VK_GROUP_ID=
VK_APP_SECRET=
VK_COMMUNITY_URL=
```

`SESSION_SECRET` — длинная случайная строка (≥ 16 символов). VK-поля можно оставить пустыми: браузерная игра будет работать локально, вход VK — нет.

**Ожидаемый результат:** файл `server/.env` существует и не лежит в Git.

Если получили ошибку: забыли `NODE_ENV=production`; короткий `SESSION_SECRET` — API не стартует.

---

## Шаг 5. База PostgreSQL

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql
```

```sql
CREATE USER ninja WITH PASSWORD 'YOUR_DB_PASSWORD';
CREATE DATABASE accountant_ninja OWNER ninja;
\q
```

**Ожидаемый результат:** есть база `accountant_ninja`.

Если получили ошибку: пользователь уже существует; пароль с спецсимволами сломал `DATABASE_URL` — экранируйте или смените пароль.

---

## Шаг 6. Миграции

```bash
cd YOUR_PROJECT_PATH/server
npm run migrate
```

**Ожидаемый результат:** применена `001_init.sql`, ошибки нет.

Если получили ошибку: неверный `DATABASE_URL`; PostgreSQL не запущен; пользователь `ninja` не может подключиться.

---

## Шаг 7. Backend как служба

Скопируйте `deploy/accountant-ninja.service.example` в `/etc/systemd/system/accountant-ninja.service`, замените `YOUR_PROJECT_PATH` и пользователя.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now accountant-ninja
sudo systemctl status accountant-ninja
```

Полезные команды:

```bash
sudo systemctl start accountant-ninja
sudo systemctl stop accountant-ninja
sudo systemctl restart accountant-ninja
sudo systemctl status accountant-ninja
sudo journalctl -u accountant-ninja -n 80 --no-pager
```

**Ожидаемый результат:** служба `active`, в логе `accountant-ninja api on :3001`.

Если получили ошибку: `Production ENV missing: ...` — смотрите имена переменных, не значения; неверный путь `WorkingDirectory`.

---

## Шаг 8. Проверка health

```bash
curl -fsS http://127.0.0.1:3001/api/health
```

**Ожидаемый результат:** `{"status":"ok"}`.

Если получили ошибку: служба не запущена; БД недоступна (`{"status":"error","db":false}`); порт занят.

---

## Шаг 9. Nginx

Установите Nginx, скопируйте `deploy/nginx/accountant-ninja.conf.example`, замените `YOUR_DOMAIN` и `YOUR_PROJECT_PATH`.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Ожидаемый результат:** `nginx -t` пишет `successful`. Не делайте reload, если тест не прошёл.

Если получили ошибку: опечатка в `server_name`; нет файла сертификата (сначала шаг 11); занят порт 80.

---

## Шаг 10. Домен

В DNS домена создайте A-запись на IP сервера. Подождите распространения.

**Ожидаемый результат:** `ping YOUR_DOMAIN` или проверка DNS показывает IP сервера.

Если получили ошибку: запись ещё не обновилась; указан не тот IP.

---

## Шаг 11. HTTPS

Let's Encrypt (после того как домен указывает на сервер):

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

Включите автопродление (обычно ставится вместе с пакетом):

```bash
sudo systemctl status certbot.timer
```

**Ожидаемый результат:** сайт открывается по `https://YOUR_DOMAIN`, таймер продления активен.

Если получили ошибку: DNS ещё не указывает на сервер; порт 80 закрыт; лимиты Let's Encrypt.

---

## Шаг 12. Frontend

Статические файлы уже в корне проекта (`index.html`, `css/`, `js/`). В `js/runtime-config.js` на сервере заполните публичные поля (без секретов):

```javascript
apiBaseUrl: 'https://YOUR_DOMAIN',
appLaunchUrl: 'https://YOUR_DOMAIN',
communityUrl: '',
vkAppId: '',
vkGroupId: ''
```

**Ожидаемый результат:** Nginx отдаёт `index.html`, JS грузится с `?v=0.9.0`.

Если получили ошибку: `root` в Nginx смотрит не в ту папку; кэш старого `index.html`.

---

## Шаг 13. Браузерный тест

Откройте `https://YOUR_DOMAIN` на компьютере.

**Ожидаемый результат:** загрузка «Загружаем первичку...», затем кнопка **Играть**. Белого экрана нет. Без VK — режим гостя.

Если получили ошибку: смешанный HTTP/HTTPS; в консоли 404 по JS; CORS, если API на другом домене и `CORS_ORIGIN` не совпадает.

---

## Шаг 14. Настройка VK

Следуйте `VK_SETUP_CHECKLIST.md` и официальным страницам:

- https://dev.vk.com/ru/mini-apps/getting-started
- https://dev.vk.com/ru/mini-apps/development/launch-params-sign

`VK_APP_SECRET` только в `server/.env`. Затем `sudo systemctl restart accountant-ninja`.

**Ожидаемый результат:** в кабинете есть Mini App и HTTPS URL игры. Значения записаны в `VK_VALUES_REQUIRED.md` владельцем, не в чат.

Если получили ошибку: тип приложения не «Мини-приложение»; URL не HTTPS.

---

## Шаг 15. Тест внутри VK

Откройте приложение из кабинета / сообщества на телефоне в приложении VK.

**Ожидаемый результат:** загрузка и **Играть**, профиль VK если подпись верна; иначе гость без белого экрана.

Если получили ошибку: неверный защищённый ключ; домен не в разрешённых; iframe заблокирован (`X-Frame-Options: DENY` ставить нельзя).
