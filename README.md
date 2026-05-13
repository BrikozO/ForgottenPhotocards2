# Forgotten Photocards — экспорт фронта

Готовый к интеграции статический SPA: nginx, проксирующий `/api` на твой FastAPI-бек. Карусель в постах — **вертикальная лента** (зафиксирована).

```
export/
└── frontend/
    ├── index.html              точка входа, грузит /api/posts перед рендером
    ├── tweaks-panel.jsx
    ├── src/
    │   ├── api.js              клиент к бекенду (window.loadPosts)
    │   ├── app.jsx             корневой компонент + хеш-роутер
    │   ├── components.jsx      Header, Footer, PostCard, Logo…
    │   ├── feed.jsx            страница ленты
    │   ├── post.jsx            страница поста
    │   ├── carousel.jsx        реализация всех вариантов карусели (активна — vertical)
    │   └── styles-*.css
    ├── nginx.conf              SPA + прокси /api → backend:8000
    └── Dockerfile              nginx:1.27-alpine
```

---

## Подключение к своему проекту

В корневом `docker-compose.yml` рядом со своим FastAPI:

```yaml
services:
  backend:                       # ← твой реальный FastAPI
    build: ./backend
    expose: ["8000"]             # внутренний порт
    # ...

  frontend:
    build: ./frontend            # ← скопированная папка export/frontend
    ports: ["80:80"]             # или 8080:80
    depends_on: [backend]
```

Что важно:

- Сервис бэка **обязан** называться `backend` и слушать `:8000` внутри docker-сети — это зашито в `frontend/nginx.conf` (`proxy_pass http://backend:8000/api/;`). Хочешь другое имя/порт — поменяй там одну строку.
- Браузер всегда ходит на тот же origin, что и фронт. CORS на бэке настраивать не нужно.
- Хеш-роутинг (`#/post/erevan`), так что history-fallback в nginx уже на месте, но в реальной маршрутизации не участвует.

---

## Контракт API

Фронту нужна **одна** ручка, чтобы заработать:

### `GET /api/posts → 200 application/json`

Массив постов, новые сначала. Каждый пост:

```jsonc
{
  "id": "erevan",                    // string|number — primary key, попадает в URL #/post/<id>
                                      // и используется как №<id> в шапке поста и в ссылке на Telegram
  "title": "Ереван",                  // ru, в карточке и шапке поста
  "type": "film",                     // "film" | "digital"
  "date": "2024-12-18",               // ISO-дата
  "time": "20:35",                    // HH:MM, опц.
  "location": "Armenia",              // опц.
  "models": ["Anna"],                 // опц., массив имён (портретные съёмки)
  "description": "Зимний Ереван…",    // опц., короткое описание
  "camera": "Fujica ST-801",          // опц.
  "lens":   "SMC Takumar 50mm f/1.4", // опц.
  "film":   "Kodak Portra 400",       // опц., только для type=film
  "views":  73,                       // опц., int
  "reactions": { "❤": 8, "🔥": 4 },  // опц., map<emoji, count>
  "photos": [
    { "src": "https://…/img.jpg", "w": 1500, "h": 1000, "alt": "erevan 1" }
  ]
}
```

**Обязательные поля:** `id` и `photos[]`. Всё остальное опционально — если поле не пришло, фронт просто не рисует соответствующий блок (вся колонка метаданных собирается из того, что есть; пустые секции схлопываются).

**Поле `photos[].src`** — абсолютный URL картинки. Когда подключишь хранилище (S3/MinIO/локальный том), отдавай оттуда либо прямые ссылки, либо относительные `/media/...` и докинь ещё один `location /media/` блок в `nginx.conf`.

### `GET /api/posts/{id} → 200 | 404` *(опционально)*

Сейчас фронт грузит всю ленту одним запросом и эту ручку не дёргает. Понадобится, когда добавишь пагинацию.

### `GET /api/stats → 200 application/json` *(опционально)*

Возвращает счётчики, которые фронт сам посчитать не может (например, число подписчиков Telegram-канала).

```jsonc
{
  "subscribers": 76    // int, опц. По умолчанию 0.
}
```

Если ручки нет — фронт молча подставит `0` подписчиков. Количество постов и фотокарточек считается на фронте из ответа `/api/posts` (поэтому если фронт показывает `0 фотокарточек` — значит у постов нет `photos[]`, проверь схему).

### `GET /api/about → 200 application/json` *(опционально)*

Данные для страницы «Об авторе». Если ручки нет — страница рендерится с baked-in копирайтом из вёрстки.

```jsonc
{
  "name": "Oleg Iakushev",                                 // string, опц.
  "bio": [                                                  // string[] | string, опц.
    "Снимаю на плёнку и цифру с 2019 года…",
    "Канал в Telegram — личный фотоальбом…"
  ],
  "base":            "Москва, Россия",                      // string, опц.
  "shooting_since":  2019,                                  // int|string, опц.
  "channel_since":   2023,                                  // int|string, опц.
  "cameras":         "Fujica ST-801 · Canon EOS 650D",      // string, опц.
  "email":           "hello@forgottenphotocards.ru",        // string, опц.
  "telegram":        "https://t.me/forgottenphotocards"     // string, опц.
}
```

Все поля опциональные. Если приходит только `name` — на странице будет только имя, био и Telegram-кнопка из дефолтов. Если приходит часть — соответствующие строки в боковой таблице появляются, остальные пропадают.

---

## Конфигурация фронта

### API base URL

По умолчанию SPA ходит на `/api` (same-origin через nginx). Если хочешь указать другой origin — отредактируй одну строку в `frontend/index.html`:

```html
<script>
  window.__API_BASE__ = "https://api.example.com";   // без trailing slash
</script>
```

Можно подменять её на старте контейнера через envsubst (типовой паттерн с маленьким entrypoint-скриптом) — скажи, если нужен.

### Кэширование

`nginx.conf` ставит `Cache-Control: public, max-age=2592000, immutable` для css/js/изображений и `no-store` для `index.html`. Если будешь раздавать через CDN — учти.

### Шрифты

Сейчас фронт грузит шрифты из `fonts.googleapis.com`. Если хостишься в РФ и нужен self-hosted — скачай нужные .woff2 в `frontend/src/fonts/` и подмени `<link href="...googleapis...">` на локальный `@font-face`. Готов помочь, если надо.

---

## Что осталось «как было»

- **JSX транспилируется в браузере** через `@babel/standalone`. Удобно для итераций, но ~700kb лишних в проде. Когда захочешь — переведу `frontend/Dockerfile` на multi-stage с Vite-билдом.
- **Реакции/просмотры** приходят готовыми числами. Если планируешь сделать их интерактивными — добавь `POST /api/posts/{id}/reactions {emoji}` и я подключу его на стороне поста.
- **Tweaks-панель** в проде не показывается (она открывается только из дев-тулчейна), так что мешать не будет — но можно и удалить, если хочешь: убери `tweaks-panel.jsx`, `<TweaksPanel>...</TweaksPanel>` из `app.jsx` и соответствующий `<script src>` из `index.html`.
