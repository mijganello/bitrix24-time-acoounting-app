# Bitrix24 Time Accounting App

Веб-приложение для учёта времязатрат по задачам и проектам из Bitrix24.

## Стек

- **Backend**: Python 3.12 + FastAPI 0.115+ + Uvicorn
- **Frontend**: React 19 + Vite 6
- **Proxy**: Nginx 1.27

## Быстрый старт

```bash
# Скопируй .env файл и заполни переменные
cp .env.example .env

# Запустить все сервисы
docker compose up --build
```

Приложение будет доступно на [http://localhost](http://localhost).

| Адрес | Описание |
|---|---|
| `http://localhost` | React frontend |
| `http://localhost/api/health` | Проверка статуса API |
| `http://localhost/docs` | Swagger UI (FastAPI) |

## Продакшн-запуск

В dev-режиме фронт раздаётся через Vite dev server (с HMR). В prod-режиме Vite собирает статику, которую отдаёт Nginx напрямую — без Node в контейнере.

```bash
docker compose -f docker-compose.prod.yml up --build
```

Приложение так же доступно на [http://localhost](http://localhost).

| Режим | Файл | Frontend |
|---|---|---|
| Dev | `docker-compose.yml` | Vite dev server, HMR работает |
| Prod | `docker-compose.prod.yml` | Собранная статика, минифицировано |

## Управление пользователями

Регистрация новых пользователей доступна только через терминал с помощью скрипта `backend/create_user.py`.

### Создать пользователя

```bash
# Интерактивный режим (запросит логин и пароль)
docker compose exec backend python create_user.py

# Передать параметры напрямую (не рекомендуется — пароль попадёт в историю)
docker compose exec backend python create_user.py -u admin -p mypassword123
```

> Пароль должен содержать **минимум 8 символов**.

### Список пользователей

```bash
docker compose exec backend python create_user.py --list
```

### Деактивировать / активировать

```bash
docker compose exec backend python create_user.py --deactivate <username>
docker compose exec backend python create_user.py --activate <username>
```

Деактивированный пользователь не может войти в приложение; его данные сохраняются.

### Удалить пользователя

```bash
docker compose exec backend python create_user.py --delete <username>
```

Скрипт запросит подтверждение перед удалением.

---

## Структура проекта

```
├── backend/          # FastAPI приложение
│   ├── app/
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/         # React + Vite приложение
│   ├── src/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   └── package.json
├── nginx/
│   ├── nginx.conf        # Dev: reverse proxy с HMR
│   └── nginx.prod.conf   # Prod: reverse proxy со статикой
├── docker-compose.yml
└── docker-compose.prod.yml
```
