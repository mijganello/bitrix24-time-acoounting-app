# Инструкция по запуску и настройке

## Предварительные требования

На сервере или локальной машине должны быть установлены:
- **Docker** (версия 24+)
- **Docker Compose** (версия 2+)
- Доступ в интернет (для загрузки образов Docker)
- Настроенный Bitrix24-портал с правами администратора

---

## Шаг 1: Получить код

```bash
git clone https://github.com/your-repo/bitrix24-time-accounting-app.git
cd bitrix24-time-accounting-app
```

---

## Шаг 2: Создать файл .env

В корне проекта (рядом с `docker-compose.yml`) создать файл `.env`:

```bash
touch .env
```

Заполнить содержимое:
```
# Webhook Bitrix24 (обязательно)
BITRIX24_WEBHOOK_URL=https://yourcompany.bitrix24.ru/rest/1/xxxxxxxxxx/

# Секретный ключ для подписи JWT (обязательно, минимум 32 символа)
SECRET_KEY=your-very-secret-random-key-at-least-32-chars

# Время жизни токена в минутах (по умолчанию 480 = 8 часов)
ACCESS_TOKEN_EXPIRE_MINUTES=480

# URL фронтенда для CORS (в разработке можно оставить *)
FRONTEND_URL=http://localhost
```

### Как получить Webhook URL Bitrix24:

1. Войти на портал Bitrix24 под администратором
2. Перейти: **Приложения → Вебхуки → Входящий вебхук**
3. Нажать «Добавить входящий вебхук»
4. Выбрать права доступа:
   - `task` — задачи
   - `user` — пользователи
   - `sonet_group` — рабочие группы/проекты
5. Скопировать URL вида `https://company.bitrix24.ru/rest/1/xxxx/`

---

## Шаг 3: Запустить приложение

```bash
docker-compose up -d --build
```

Флаги:
- `-d` — запуск в фоне (daemon mode)
- `--build` — принудительно пересобрать образы (нужно при первом запуске)

Первый запуск займёт несколько минут (скачивание образов, установка зависимостей).

---

## Шаг 4: Создать первого пользователя

После запуска контейнеров нужно создать учётную запись для входа:

```bash
docker-compose exec backend python create_user.py
```

Скрипт запросит логин и пароль:
```
Введите логин: admin
Введите пароль: ••••••••
Пользователь 'admin' создан успешно.
```

---

## Шаг 5: Открыть приложение

Открыть в браузере: **http://localhost**

Ввести логин и пароль, созданные на шаге 4.

---

## Проверка работоспособности

```bash
# Статус контейнеров
docker-compose ps

# Ожидаемый вывод:
# NAME          STATUS          PORTS
# db            running         5432/tcp
# backend       running         8000/tcp
# frontend      running         5173/tcp
# nginx         running         0.0.0.0:80->80/tcp

# Проверить API
curl http://localhost/api/health
# {"status":"ok","message":"API работает"}

# Посмотреть логи
docker-compose logs -f backend
```

---

## Обновление кода

```bash
git pull
docker-compose up -d --build
```

---

## Полезные команды

```bash
# Перезапустить только backend без пересборки образа
docker-compose restart backend

# Зайти в контейнер backend
docker-compose exec backend bash

# Зайти в PostgreSQL
docker-compose exec db psql -U bitrix_user -d bitrix_app

# Посмотреть данные таблицы users
docker-compose exec db psql -U bitrix_user -d bitrix_app -c "SELECT id, username, is_active FROM users;"

# Остановить всё (данные сохранятся в volume)
docker-compose down

# Остановить и удалить данные (ОСТОРОЖНО!)
docker-compose down -v
```

---

## Структура URL приложения

| URL | Описание |
|---|---|
| `http://localhost/` | Главная страница |
| `http://localhost/login` | Страница входа |
| `http://localhost/reports` | Каталог отчётов |
| `http://localhost/reports/users-summary` | Сводка по пользователям |
| `http://localhost/reports/projects` | Детализация по проектам |
| `http://localhost/reports/team-heatmap` | Тепловая карта нагрузки |
| `http://localhost/reports/my-dashboard` | Личный дашборд |
| `http://localhost/status` | Статус платформы |
| `http://localhost/docs` | Swagger UI (документация API) |
| `http://localhost/api/health` | Heartbeat API |
