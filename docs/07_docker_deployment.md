# Docker и развёртывание приложения

## Что такое Docker?

**Docker** — это платформа для запуска приложений в изолированных контейнерах. Контейнер — это как «виртуальная машина», но гораздо легче: он не эмулирует целое железо, а изолирует только процессы, используя ядро Linux хост-машины.

**Зачем Docker?**
- «Работает на моей машине» → проблема решена: контейнер содержит всё нужное
- Одна команда для запуска всего стека (`docker-compose up`)
- Изолированные окружения не конфликтуют между собой
- Легко переносить на разные серверы

---

## Docker-образы

**Образ (Image)** — это шаблон контейнера. Создаётся по инструкции из `Dockerfile`. Образ неизменяем. Из одного образа можно запустить несколько контейнеров.

### backend/Dockerfile (разработка)

```dockerfile
FROM python:3.12-slim
# Базовый официальный образ Python 3.12 (slim = без лишних пакетов)

WORKDIR /app
# Все команды выполняются в папке /app внутри контейнера

ENV PYTHONDONTWRITEBYTECODE=1
# Не создавать .pyc файлы (ускоряет запуск)

ENV PYTHONUNBUFFERED=1
# Вывод Python не буферизируется (логи сразу видны)

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Сначала копируем только requirements.txt и устанавливаем зависимости
# Docker кэширует этот слой — при изменении кода (но не зависимостей) pip не запускается заново

COPY . .
# Теперь копируем весь код приложения

EXPOSE 8000
# Документируем порт (не открывает порт, только сообщает Docker Compose)

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
# Команда запуска. --reload: перезапуск при изменении кода
```

### frontend/Dockerfile (разработка)

```dockerfile
FROM node:22-alpine
# Node.js 22 на Alpine Linux (минимальный дистрибутив)

WORKDIR /app

COPY package*.json ./
# package.json и package-lock.json

RUN npm install
# Устанавливаем все зависимости из package.json

COPY . .
# Копируем весь исходный код

EXPOSE 5173

CMD ["npm", "run", "dev"]
# Запускаем Vite dev-сервер
```

**Важный трюк:** `COPY package*.json ./` + `RUN npm install` идут **до** `COPY . .`. Docker кэширует слои по порядку. Если изменился только исходный код (но не package.json), Docker пропускает установку зависимостей и пересобирает только последний слой. Сборка ускоряется в разы.

---

## Docker Compose

**Docker Compose** — инструмент для запуска нескольких контейнеров как единой системы. Все сервисы описаны в файле `docker-compose.yml`.

### docker-compose.yml (разработка)

```yaml
services:
  db:
    image: postgres:16-alpine           # Готовый образ PostgreSQL
    environment:
      POSTGRES_DB: bitrix_app           # Создать БД с таким именем
      POSTGRES_USER: bitrix_user        # Создать пользователя
      POSTGRES_PASSWORD: bitrix_pass    # Пароль пользователя
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Постоянное хранилище
    restart: unless-stopped             # Перезапускать при сбое

  backend:
    build:
      context: ./backend               # Использовать Dockerfile из ./backend/
    volumes:
      - ./backend:/app                 # Монтируем папку — live reload!
    environment:
      - DATABASE_URL=postgresql://bitrix_user:bitrix_pass@db:5432/bitrix_app
    env_file:
      - .env                           # Загружаем секреты из .env
    depends_on:
      - db                             # Запускать после db
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
    volumes:
      - ./frontend:/app                # Монтируем код для HMR
      - /app/node_modules              # Анонимный том — node_modules из образа
    environment:
      - NODE_ENV=development
    restart: unless-stopped

  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"                        # Открываем порт 80 хост-машины
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

volumes:
  postgres_data:                       # Named volume для данных PostgreSQL
```

### Трюк с node_modules в frontend

```yaml
volumes:
  - ./frontend:/app          # Монтируем хост-папку → перетирает /app внутри
  - /app/node_modules        # Анонимный том → сохраняет node_modules из образа
```

Проблема: монтирование `./frontend:/app` затирает `/app/node_modules`, собранные при `RUN npm install`. Второй volume (анонимный) «прячет» `node_modules` — Docker хранит их в своём месте, не заменяя из хост-папки (где `node_modules` может отсутствовать).

---

## Nginx — обратный прокси

**Nginx** — это высокопроизводительный веб-сервер. В данном проекте используется как **обратный прокси** (reverse proxy): принимает запросы снаружи и пересылает их внутренним сервисам.

### nginx/nginx.conf

```nginx
server {
    listen 80;
    server_name _;   # Принять запросы на любое имя хоста

    # WebSocket для Vite HMR (горячая перезагрузка кода)
    location /vite-hmr {
        proxy_pass         http://frontend:5173;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        # WebSocket требует эти заголовки для upgrade с HTTP до WS
    }

    # API запросы → backend
    location /api/ {
        proxy_pass         http://backend:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Swagger UI
    location /docs {
        proxy_pass http://backend:8000/docs;
    }

    # Всё остальное → frontend
    location / {
        proxy_pass         http://frontend:5173;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        # WebSocket нужен и здесь — Vite использует его для HMR
    }
}
```

**Порядок location** важен: Nginx проверяет их сверху вниз и останавливается на первом совпадении. `/vite-hmr` проверяется раньше `/`, поэтому попадает в нужный блок.

**`proxy_set_header X-Real-IP`** — передаёт реальный IP клиента backend, иначе backend видел бы только IP Nginx (127.0.0.1).

---

## Продакшн-сборка (docker-compose.prod.yml)

В продакшн-режиме архитектура немного отличается:

- **Frontend** не запускает Vite dev-сервер. Вместо этого: `npm run build` создаёт статические файлы в папке `dist/`. Nginx раздаёт их напрямую (`root /usr/share/nginx/html`).
- **Backend** запускается без флага `--reload`. Больше worker-процессов для параллельной обработки запросов.
- **Nginx** настроен на раздачу статики и проксирование только API.

---

## Команды управления

```bash
# Запуск (разработка)
docker-compose up -d          # -d = daemon (фоновый режим)
docker-compose up -d --build  # Пересобрать образы перед запуском

# Остановка
docker-compose down           # Останавливает и удаляет контейнеры
docker-compose down -v        # Также удаляет volumes (ОСТОРОЖНО: удалит данные БД!)

# Логи
docker-compose logs -f backend    # Следить за логами backend
docker-compose logs -f           # Все сервисы
docker-compose logs --tail=50 nginx  # Последние 50 строк nginx

# Выполнение команды внутри контейнера
docker-compose exec backend python create_user.py
docker-compose exec db psql -U bitrix_user -d bitrix_app

# Статус контейнеров
docker-compose ps
```

---

## Сетевое взаимодействие внутри Docker

Docker Compose автоматически создаёт **внутреннюю сеть** для всех сервисов. В этой сети:
- Сервисы обращаются друг к другу по **имени сервиса** (не по IP).
- `backend` → `db:5432` работает, потому что Docker резолвит `db` во внутренний IP контейнера базы данных.
- Снаружи (с хост-машины) доступен только порт `80` (Nginx).
- Порты 5173, 8000, 5432 снаружи **недоступны** (не указаны в `ports:`).

Это повышает безопасность: БД и backend не видны из интернета.

---

## Переменные среды и .env файл

Файл `.env` (не хранится в Git — добавлен в `.gitignore`):
```
BITRIX24_WEBHOOK_URL=https://mycompany.bitrix24.ru/rest/1/xxxxx/
SECRET_KEY=очень-длинный-случайный-ключ-минимум-32-символа
ACCESS_TOKEN_EXPIRE_MINUTES=480
FRONTEND_URL=http://localhost
```

Директива `env_file: - .env` в docker-compose.yml передаёт все переменные из файла в контейнер backend.

`DATABASE_URL` задаётся напрямую в `environment:` — он содержит логин/пароль из того же docker-compose.yml, поэтому не нужно дублировать в .env.

---

## Схема работы в режиме разработки

```
Разработчик меняет файл backend/app/routers/reports.py
    ↓
Volume ./backend:/app синхронизирует изменение в контейнер
    ↓
Uvicorn (--reload) видит изменение → перезапускает сервер (~0.5 сек)
    ↓
API обновлено


Разработчик меняет файл frontend/src/pages/HomePage.jsx
    ↓
Volume ./frontend:/app синхронизирует изменение
    ↓
Vite (usePolling: true) замечает изменение
    ↓
HMR: по WebSocket (/vite-hmr) браузер получает обновлённый модуль
    ↓
Страница обновляется без полной перезагрузки (~100 мс)
```
