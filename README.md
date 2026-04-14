# WORKERPUNCH v2 — alpha

Платформа учёта рабочего времени для команд на базе Bitrix24. Аналитические отчёты, контроль нагрузки и прозрачность по задачам и проектам.

> **Alpha-версия.** Основной функционал работает, API стабилен. Возможны изменения без обратной совместимости.

## Стек

- **Backend**: Python 3.12, FastAPI 0.115+, Uvicorn, PostgreSQL 16, SQLAlchemy 2
- **Frontend**: React 19, Vite 6, Ant Design 6
- **Инфраструктура**: Nginx 1.27, Docker Compose

На сервере нужен только **Docker** — Python, Node.js, Nginx и PostgreSQL устанавливаются автоматически внутри контейнеров.

---

## Развёртывание на сервере (prod)

### Требования к серверу

- Linux (Ubuntu 22.04+ рекомендуется)
- Docker 24+, Docker Compose v2
- Открытый порт `80` (и `443`, если нужен HTTPS)

```bash
# Установка Docker на чистый Ubuntu
curl -fsSL https://get.docker.com | sh
```

### Шаги

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd bitrix24-time-accounting-app

# 2. Создать и заполнить .env
cp .env.example .env
nano .env   # заполни BITRIX24_WEBHOOK_URL, SECRET_KEY и DATABASE_URL

# 3. Сгенерировать SECRET_KEY (если нет)
openssl rand -hex 32

# 4. Запустить
docker compose -f docker-compose.prod.yml up --build -d
```

Приложение доступно на `http://<ip-сервера>`.

| Адрес | Описание |
|---|---|
| `/` | React frontend |
| `/api/health` | Проверка статуса API |
| `/api/info` | Версия и окружение |
| `/docs` | Swagger UI |

### Обновление

```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

Данные базы хранятся в PostgreSQL — при пересборке контейнеров **не теряются**.

---

## Локальная разработка (dev)

```bash
cp .env.example .env   # если ещё нет
docker compose up --build
```

PostgreSQL поднимается автоматически в контейнере `db`, `DATABASE_URL` задаётся в `docker-compose.yml`.
В dev-режиме фронт раздаётся через Vite dev server с горячей перезагрузкой (HMR). Бэкенд перезапускается при изменении файлов автоматически.

| Режим | Команда | Frontend |
|---|---|---|
| Dev | `docker compose up --build` | Vite dev server, HMR |
| Prod | `docker compose -f docker-compose.prod.yml up --build -d` | Собранная статика через Nginx |

---

## Переменные окружения

| Переменная | Описание | Обязательна |
|---|---|---|
| `DATABASE_URL` | Строка подключения PostgreSQL: `postgresql://user:pass@host:5432/db` | Да (в prod) |
| `SECRET_KEY` | Ключ подписи JWT-токенов (`openssl rand -hex 32`) | Да |
| `BITRIX24_WEBHOOK_URL` | Вебхук Bitrix24 REST API | Да |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Время жизни токена в минутах (по умолчанию: 480) | Нет |

Локально `DATABASE_URL` не нужна в `.env` — она уже задана в `docker-compose.yml`.

---

## Управление пользователями

Самостоятельная регистрация закрыта. Пользователей создаёт администратор через терминал.

> Для прод-окружения замени `docker compose` на `docker compose -f docker-compose.prod.yml`.

```bash
# Создать пользователя (интерактивно)
docker compose exec backend python create_user.py

# Список пользователей
docker compose exec backend python create_user.py --list

# Деактивировать / активировать
docker compose exec backend python create_user.py --deactivate <username>
docker compose exec backend python create_user.py --activate <username>

# Удалить (запросит подтверждение)
docker compose exec backend python create_user.py --delete <username>
```

Пароль — минимум 8 символов. Деактивированный пользователь не может войти, данные сохраняются.

---

## Версионирование

Версия хранится в двух файлах, их нужно обновлять синхронно:

- [`backend/app/version.py`](backend/app/version.py) — используется в API (`/api/info`) и Swagger
- [`frontend/package.json`](frontend/package.json) — инжектируется Vite в сборку, отображается в шапке

```bash
# После обновления обоих файлов:
git add backend/app/version.py frontend/package.json
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin master --tags
```

---

## Структура проекта

```
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── version.py       # Версия и название приложения
│   │   ├── models.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   └── routers/
│   ├── Dockerfile           # Dev: uvicorn --reload
│   ├── Dockerfile.prod      # Prod: uvicorn --workers 2
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── Dockerfile           # Dev: Vite dev server
│   ├── Dockerfile.prod      # Prod: сборка → Nginx
│   └── package.json         # version здесь → __APP_VERSION__
├── nginx/
│   ├── nginx.conf           # Dev конфиг
│   └── nginx.prod.conf      # Prod конфиг
├── docker-compose.yml       # Dev (включает контейнер PostgreSQL)
├── docker-compose.prod.yml  # Prod (PostgreSQL через DATABASE_URL из .env)
└── .env.example
```
