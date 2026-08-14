# Asset inventory — Бухгалтер-ниндзя 0.9.0

Реальные файлы, не желаемые. Placeholder не считается готовым production-asset.

## Player

Используются **не файлы**, а отрисовка на Canvas (`js/player.js`).

Ожидаемые спрайты (пока отсутствуют):

```text
assets/images/player/idle.webp
assets/images/player/move-left.webp
assets/images/player/move-right.webp
assets/images/player/happy.webp
assets/images/player/worried.webp
assets/images/player/hit.webp
assets/images/player/victory.webp
assets/images/player/tired.webp
```

В каталоге есть только `assets/images/player/README.txt`.

Флаг: `APP_CONFIG.playerSpritesEnabled = false`. Файлы `.webp` заранее не загружаются.

## Objects

Отдельных изображений нет. Карточки рисуются Canvas + emoji из `OBJECT_TYPES` в `js/config.js`.

Хорошие: Первичка 📄, Акт сверки 🧾, Счёт 📑, Оплата 💰, Отчёт ✅, ЭДО 📨, Закрывашка 📋, Срочно 🔥, Золотая первичка 🌟.

Плохие: Требование ФНС 🚨, Кассовый разрыв 📉, Штраф 💸, Нет подписи ⚠️, 1С зависла 💻, Проверка 🕵️.

Бонусы: Кофе ☕, Идеальная первичка 🌟, Автосверка 🔄, Отсрочка ⏰, Переплата 💎, Всё по нулям ✨.

## Sounds

Аудиофайлов в `assets/` нет. `js/audio.js` синтезирует короткие сигналы через Web Audio API.

Сигналы: ui_click, catch, bonus, error, life, level, gameover, combo, new_record.

Если Web Audio недоступен или контекст не разблокирован — тишина, игра продолжается.

## UI / brand

- Шрифты: системный стек из `css/style.css`, отдельных `.woff` нет.
- Логотип сообщества: файла нет, в интерфейсе текстовое имя «Налоговая не страшна».
- Favicon: отдельного файла нет.

## Fallbacks

| Сбой | Поведение |
| --- | --- |
| Нет спрайтов персонажа | Canvas-персонаж |
| Нет картинок объектов | Canvas + emoji |
| Нет звуковых файлов | Синтез / тишина |
| VK недоступен | Guest Mode |
| Backend недоступен | Local Mode |
| Share недоступен | Буфер обмена |
| Нет логотипа | Текст названия сообщества |

## Placeholders (не готовы как production-art)

- спрайты игрока `.webp`;
- логотип / иконка сообщества для кабинета VK;
- юридические поля оператора в `privacy.html` / `terms.html`.
