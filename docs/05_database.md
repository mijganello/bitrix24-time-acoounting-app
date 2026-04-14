# База данных

## Что используется и почему

В качестве СУБД (Системы Управления Базами Данных) используется **PostgreSQL** — одна из самых популярных в мире реляционных баз данных с открытым исходным кодом. PostgreSQL — это программа, которая хранит данные в таблицах, позволяет их быстро искать, изменять и удалять.

В Docker запускается образ `postgres:16-alpine` (версия 16, минимальная сборка на Alpine Linux).

---

## Что хранится в базе данных

В приложении в БД хранится **только одна таблица** — `users`. Это сознательное архитектурное решение: все данные о задачах, проектах и трудозатратах берутся из Bitrix24 в реальном времени и не кэшируются.

### Таблица `users`

| Колонка | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | Уникальный числовой ID |
| `username` | VARCHAR | UNIQUE, NOT NULL, INDEX | Логин для входа в систему |
| `hashed_password` | VARCHAR | NOT NULL | Bcrypt-хеш пароля |
| `is_active` | BOOLEAN | DEFAULT TRUE | Флаг активности аккаунта |
| `avatar_color` | VARCHAR | NULL | HEX-цвет аватара (#RRGGBB) |

Пример записи:
```
id | username | hashed_password                                            | is_active | avatar_color
---+----------+------------------------------------------------------------+-----------+-------------
1  | admin    | $2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW | true      | #4361d8
```

> `$2b$12$...` — это bcrypt-хеш. Невозможно «обратно» получить пароль из хеша.

---

## SQLAlchemy — ORM

**ORM (Object-Relational Mapper)** — это библиотека, которая позволяет работать с таблицами базы данных как с Python-объектами, не писать SQL-запросы вручную.

### Определение модели

```python
from sqlalchemy import Boolean, Column, Integer, String
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active       = Column(Boolean, default=True)
    avatar_color    = Column(String, nullable=True)
```

SQLAlchemy превращает это в SQL при запуске:
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    avatar_color VARCHAR
);
CREATE INDEX ix_users_username ON users (username);
```

### Сессии и транзакции

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Это **dependency injection** (внедрение зависимостей) FastAPI. Каждый HTTP-запрос получает собственную сессию БД. После завершения запроса (успешного или с ошибкой) сессия закрывается. Это предотвращает «утечки» соединений.

### Пример запроса с ORM

```python
# Найти пользователя по username
def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()
```

SQLAlchemy транслирует это в:
```sql
SELECT * FROM users WHERE username = 'admin' LIMIT 1;
```

---

## Подключение к базе данных

Connection string (строка подключения):
```
postgresql://bitrix_user:bitrix_pass@db:5432/bitrix_app
```

Разбор:
- `postgresql://` — протокол
- `bitrix_user:bitrix_pass` — логин и пароль PostgreSQL
- `db` — имя хоста (Docker-сервис `db`, разрешается в IP контейнера)
- `5432` — стандартный порт PostgreSQL
- `bitrix_app` — имя базы данных

---

## Хранение данных между перезапусками

В `docker-compose.yml` используется **named volume**:
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

**Docker Volume** — это постоянное хранилище за пределами контейнера. Даже если контейнер `db` удалён и пересоздан — данные сохранятся в томе `postgres_data`.

Без этого все данные терялись бы при каждом `docker-compose down`.

---

## Автоматическое создание таблиц

При каждом старте приложения FastAPI вызывает:
```python
Base.metadata.create_all(bind=engine)
```

Это идемпотентная операция: если таблица уже существует — она не будет пересоздана. Если отсутствует — создаётся. Этот механизм называется **auto-migration** (автоматическая миграция) — простой, но не гибкий способ управления схемой БД.

Для более сложных миграций (изменение существующих колонок, переименование и т.д.) обычно используют **Alembic** — официальный инструмент миграций SQLAlchemy. В данном проекте он не используется, роль миграций выполняют скрипты (`migrate_avatar_color.py`).

---

## Безопасность паролей

Пароли **никогда** не хранятся в открытом виде. Схема:

1. Пользователь вводит пароль, например `mypassword123`
2. bcrypt генерирует случайную соль и хеширует пароль с ней:
   ```
   $2b$12$EixZaYVK1fsbw1ZfbX3OXe...  ← это и есть "hashed_password"
   ```
3. В БД сохраняется только хеш
4. При следующем входе — пароль заново хешируется и сравнивается с сохранённым хешем

**«Стоимость» bcrypt** (параметр `12` в начале хеша) означает, что вычисление хеша занимает ~0.1 секунды. Это делает перебор паролей (брутфорс) крайне медленным.
