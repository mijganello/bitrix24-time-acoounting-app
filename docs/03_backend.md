# Backend — серверная часть приложения

## Что такое Backend?

Backend (бэкенд, серверная часть) — это программа, которая работает на сервере и не видна пользователю напрямую. Она принимает запросы от фронтенда (браузерной части), обрабатывает данные и возвращает ответ. В нашем случае бэкенд написан на языке **Python** с использованием фреймворка **FastAPI**.

Расположение: `backend/`

---

## Стек технологий

| Библиотека | Назначение |
|---|---|
| **FastAPI** | Основной веб-фреймворк. Позволяет описывать API-эндпоинты как обычные Python-функции. Автоматически генерирует документацию Swagger. |
| **Uvicorn** | ASGI-сервер — программа, которая «запускает» FastAPI и обрабатывает HTTP-запросы. Аналог Nginx, но для Python-приложений. |
| **SQLAlchemy** | ORM (Object-Relational Mapper) — библиотека для работы с базой данных через Python-объекты, без написания SQL-запросов вручную. |
| **Pydantic** | Валидация данных. Описывает «схемы» — модели данных с типами. FastAPI использует Pydantic для проверки входящих запросов и формирования ответов. |
| **python-jose** | Создание и проверка JWT-токенов (токенов авторизации). |
| **bcrypt** | Хеширование паролей. Никогда не хранит пароль в открытом виде — только его необратимый хеш. |
| **httpx** | HTTP-клиент для Python. Используется для асинхронных запросов к API Bitrix24. |
| **psycopg2-binary** | Драйвер для подключения Python к PostgreSQL. |
| **python-dotenv** | Загрузка переменных окружения из файла `.env`. |

---

## Структура папки backend/

```
backend/
├── app/
│   ├── __init__.py        # Пустой файл — обозначает что app/ является Python-пакетом
│   ├── main.py            # Точка входа — создание FastAPI приложения
│   ├── database.py        # Подключение к PostgreSQL
│   ├── models.py          # Модели базы данных (таблицы)
│   ├── auth.py            # Логика авторизации (JWT, пароли)
│   ├── version.py         # Версия и название приложения
│   └── routers/
│       ├── __init__.py
│       ├── auth.py        # API эндпоинты авторизации (/api/auth/...)
│       ├── bitrix.py      # API эндпоинты Bitrix24 (/api/bitrix/...)
│       └── reports.py     # API эндпоинты отчётов (/api/reports/...)
├── Dockerfile             # Инструкция для сборки Docker-образа (разработка)
├── Dockerfile.prod        # Инструкция для сборки Docker-образа (продакшн)
├── requirements.txt       # Список зависимостей Python
├── create_user.py         # Скрипт создания пользователя в БД
└── migrate_avatar_color.py # Скрипт миграции (добавление поля avatar_color в БД)
```

---

## app/main.py — точка входа

Это главный файл приложения. Он:

1. Создаёт экземпляр FastAPI.
2. Настраивает **CORS** (Cross-Origin Resource Sharing) — политику, разрешающую фронтенду обращаться к API с другого домена/порта.
3. Подключает три «роутера» (наборы эндпоинтов): auth, bitrix, reports.
4. Добавляет два базовых эндпоинта: `/api/health` (проверка работоспособности) и `/api/info` (информация о приложении).
5. При старте автоматически создаёт таблицы в базе данных (через `Base.metadata.create_all`).

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Выполняется при старте приложения
    Base.metadata.create_all(bind=engine)
    yield
    # Выполняется при остановке приложения
```

**Lifespan** — механизм FastAPI для выполнения кода при запуске и остановке приложения.

---

## app/database.py — подключение к БД

```python
SQLALCHEMY_DATABASE_URL = os.environ["DATABASE_URL"]
# Пример: "postgresql://bitrix_user:bitrix_pass@db:5432/bitrix_app"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

- **engine** — «движок» подключения к PostgreSQL.
- **SessionLocal** — фабрика сессий. Каждый HTTP-запрос получает свою сессию БД.
- **get_db()** — функция-генератор (Depends), передающая сессию в эндпоинт и гарантирующая её закрытие после ответа.

---

## app/models.py — таблицы базы данных

В БД хранится только **одна таблица** — `users`:

```python
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    username      = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active     = Column(Boolean, default=True)
    avatar_color  = Column(String, nullable=True)
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | Integer | Уникальный числовой идентификатор |
| `username` | String | Логин (уникальный, не может повторяться) |
| `hashed_password` | String | Хеш пароля (bcrypt), никогда не сам пароль |
| `is_active` | Boolean | Активен ли аккаунт (можно заблокировать без удаления) |
| `avatar_color` | String | Цвет аватара в интерфейсе (HEX, например #4361d8) |

> Данные о задачах, проектах и трудозатратах **не хранятся в БД**, они запрашиваются из Bitrix24 при каждом открытии отчёта.

---

## app/auth.py — авторизация

### Принцип работы JWT

**JWT (JSON Web Token)** — это строка, выдаваемая пользователю при успешном входе. Она содержит закодированные данные (кто вошёл, когда истекает) и **подпись** — криптографическую гарантию того, что токен не подделан.

Схема работы:
```
1. Пользователь вводит логин+пароль → POST /api/auth/login
2. Сервер проверяет пароль (bcrypt.checkpw)
3. Если верный → создаёт JWT-токен (подписывает своим SECRET_KEY)
4. Возвращает токен фронтенду
5. Фронтенд сохраняет токен в localStorage браузера
6. При каждом следующем запросе → фронтенд добавляет заголовок:
   Authorization: Bearer <токен>
7. Сервер проверяет подпись токена, достаёт имя пользователя
8. Если токен действителен → выполняет запрос
```

### Срок жизни токена

По умолчанию токен действует **480 минут (8 часов)** — один рабочий день. Настраивается через переменную `ACCESS_TOKEN_EXPIRE_MINUTES`.

### Хеширование паролей

```python
def get_password_hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return _bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
```

**bcrypt** — это хеш-функция с «солью» (случайным добавлением). Даже если два пользователя имеют одинаковый пароль, их хеши будут разными. Взломать такой хеш брутфорсом практически невозможно.

---

## app/routers/auth.py — API авторизации

### POST /api/auth/login

Принимает форму с `username` и `password`. Использует стандарт **OAuth2PasswordRequestForm** из FastAPI. Возвращает:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### GET /api/auth/me

Принимает токен из заголовка Authorization. Возвращает данные текущего пользователя:

```json
{
  "id": 1,
  "username": "admin",
  "is_active": true,
  "avatar_color": "#4361d8"
}
```

Используется фронтендом при старте — чтобы проверить, действителен ли токен из localStorage.

---

## app/routers/bitrix.py — API Bitrix24

### GET /api/bitrix/portal

Возвращает информацию о подключённом Bitrix24-портале: URL, название, лицензия, язык. Используется на странице «Статус платформы».

Внутри делает POST-запрос к Bitrix24 REST API методу `app.info`. Если Bitrix24 недоступен или Webhook не настроен — возвращает `{ "connected": false }` без ошибки 500.

---

## app/routers/reports.py — API отчётов

Самый большой и сложный файл. Содержит 4 отчёта + 1 вспомогательный эндпоинт.

### Как работает Bitrix24 REST API

Backend обращается к Bitrix24 через **Webhook** — URL вида:
```
https://mycompany.bitrix24.ru/rest/1/xxxxxxxxxxx/
```

Каждый вызов — это POST-запрос на URL вида:
```
https://mycompany.bitrix24.ru/rest/1/xxx/tasks.task.list.json
```

Используемые методы Bitrix24:
| Метод | Что возвращает |
|---|---|
| `tasks.task.list` | Список задач (с пагинацией по 50 записей) |
| `task.elapseditem.getlist` | Записи затраченного времени по задаче |
| `batch` | Пакетный вызов — до 50 методов за один HTTP-запрос |
| `user.get` | Данные пользователей |
| `sonet_group.get` | Список проектов (рабочих групп) |

### Пагинация tasks.task.list

Bitrix24 возвращает не более 50 задач за один запрос. Для получения всех задач используется цикл:

```python
async def _get_all_tasks(client, group_id=None):
    tasks = []
    start = 0
    while True:
        result = await _bx(client, "tasks.task.list", {"start": start, ...})
        page = result.get("tasks", [])
        tasks.extend(page)
        if len(page) < 50:
            break   # Последняя страница
        start += 50
    return tasks
```

### Batch-запросы для elapsed time

Получение затраченного времени по каждой задаче требует отдельного API-вызова. Если задач 500 — это 500 запросов. Bitrix24 поддерживает **batch** (пакетный запрос): можно отправить 50 вызовов в одном HTTP-запросе. Это ускоряет работу в 50 раз.

```python
cmd = {f"e{tid}": f"task.elapseditem.getlist?TASKID={tid}" for tid in chunk}
result = await _bx(client, "batch", {"halt": 0, "cmd": cmd})
```

### Асинхронность (async/await)

Все запросы к Bitrix24 — **асинхронные**. Это означает, что пока один запрос «ждёт» ответа от Bitrix24, Python не блокируется и может обрабатывать другие входящие запросы. Ключевые слова `async` и `await` — это синтаксис асинхронного программирования в Python.

### Отчёт 1: /api/reports/users-summary

**Параметры:** `date_from`, `date_to`, опционально `user_id`

**Алгоритм:**
1. Получить все задачи из Bitrix24.
2. Получить все записи затраченного времени (batch-запрос).
3. Отфильтровать по дате и пользователю.
4. Агрегировать по пользователям: считать сумму секунд.
5. Разделить секунды на «с проектом» и «без проекта».
6. Получить имена пользователей из Bitrix24.
7. Вернуть отсортированный список (от наибольших затрат к меньшим).

### Отчёт 2: /api/reports/projects

Строит **дерево**: проект → задачи → пользователи.

Задачи с `groupId = 0` или `groupId = null` относятся к группе «Без проекта».

### Отчёт 3: /api/reports/team-heatmap

Строит **матрицу**: пользователь × дата → секунды.

Для каждой ячейки определяется **уровень нагрузки**:
- `idle` — 0 часов
- `low` — менее 4 часов
- `normal` — 4–8 часов
- `overtime` — более 8 часов

### Отчёт 4: /api/reports/my-dashboard

Личный дашборд конкретного пользователя: итого, топ-10 задач, разбивка по проектам (с процентами), активность по дням.

### /api/reports/users-list

Вспомогательный эндпоинт — возвращает список всех активных пользователей Bitrix24. Используется для заполнения выпадающих списков в фильтрах на фронтенде.

---

## Dockerfile (разработка)

```dockerfile
FROM python:3.12-slim       # Базовый образ: Python 3.12 минимальный
WORKDIR /app                # Рабочая директория внутри контейнера
COPY requirements.txt .     # Копируем список зависимостей
RUN pip install -r requirements.txt  # Устанавливаем зависимости
COPY . .                    # Копируем весь код
EXPOSE 8000                 # Объявляем порт
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
# --reload: при изменении кода сервер перезапускается автоматически
```

---

## Скрипты

### create_user.py

Утилита командной строки для создания нового пользователя в системе. Запускается вручную администратором:

```bash
docker-compose exec backend python create_user.py
```

Запрашивает логин и пароль, хеширует пароль через bcrypt и сохраняет в таблицу `users`.

### migrate_avatar_color.py

Скрипт миграции БД — добавляет колонку `avatar_color` в таблицу `users`, если она отсутствует. Это пример того, как делаются «ручные» миграции без специальных инструментов.
