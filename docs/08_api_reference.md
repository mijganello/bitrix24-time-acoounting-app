# API — полный справочник эндпоинтов

Все эндпоинты доступны по базовому URL: `http://YOUR_SERVER/api/`

Интерактивная документация (Swagger UI): `http://YOUR_SERVER/docs`

---

## Авторизация

### POST /api/auth/login

Вход в систему. Возвращает JWT-токен.

**Content-Type:** `application/x-www-form-urlencoded`

**Тело запроса:**
```
username=admin&password=mypassword
```

**Успешный ответ (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTcxMzE3NjAwMH0.xxxxx",
  "token_type": "bearer"
}
```

**Ошибка (401):**
```json
{
  "detail": "Неверный логин или пароль"
}
```

---

### GET /api/auth/me

Получить данные текущего авторизованного пользователя.

**Заголовок:** `Authorization: Bearer <токен>`

**Успешный ответ (200):**
```json
{
  "id": 1,
  "username": "admin",
  "is_active": true,
  "avatar_color": "#4361d8"
}
```

**Ошибка (401):** токен невалидный или истёк.

---

## Bitrix24

### GET /api/bitrix/portal

Информация о подключённом Bitrix24-портале.

**Заголовки:** Не требуются (публичный эндпоинт).

**Успешный ответ (200):**
```json
{
  "portal_url": "https://mycompany.bitrix24.ru",
  "portal_name": "My Company",
  "license": "professional",
  "language": "ru",
  "connected": true
}
```

**Если вебхук не настроен:**
```json
{
  "portal_url": null,
  "portal_name": null,
  "license": null,
  "language": null,
  "connected": false
}
```

---

## Системные

### GET /api/health

Проверка работоспособности API.

**Ответ (200):**
```json
{"status": "ok", "message": "API работает"}
```

### GET /api/info

Информация о приложении.

**Ответ (200):**
```json
{
  "app": "WORKERPUNCH v2",
  "version": "0.5.1",
  "stage": "alpha",
  "description": "..."
}
```

---

## Отчёты

### GET /api/reports/users-list

Все активные пользователи Bitrix24. Используется для заполнения фильтров.

**Ответ (200):**
```json
[
  {"id": 1, "name": "Иван Петров"},
  {"id": 7, "name": "Мария Иванова"},
  ...
]
```

---

### GET /api/reports/users-summary

Сводка по пользователям за период.

**Query-параметры:**
| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `date_from` | date (YYYY-MM-DD) | Да | Начало периода |
| `date_to` | date (YYYY-MM-DD) | Да | Конец периода |
| `user_id` | integer | Нет | Фильтр по пользователю |

**Пример запроса:**
```
GET /api/reports/users-summary?date_from=2024-03-01&date_to=2024-03-31
```

**Ответ (200):**
```json
{
  "date_from": "2024-03-01",
  "date_to": "2024-03-31",
  "total_seconds": 288000,
  "total_hours": 80.0,
  "users": [
    {
      "user_id": 1,
      "user_name": "Иван Петров",
      "seconds_total": 144000,
      "hours_total": 40.0,
      "seconds_with_project": 108000,
      "hours_with_project": 30.0,
      "seconds_without_project": 36000,
      "hours_without_project": 10.0,
      "tasks": [
        {
          "task_id": 12345,
          "task_title": "Разработка модуля авторизации",
          "group_id": 42,
          "group_name": "Backend 2024",
          "seconds": 72000,
          "hours": 20.0
        }
      ]
    }
  ]
}
```

---

### GET /api/reports/projects

Детализация по проектам. Дерево: проект → задача → пользователь.

**Query-параметры:**
| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `date_from` | date | Да | Начало периода |
| `date_to` | date | Да | Конец периода |
| `user_id` | integer | Нет | Фильтр по пользователю |
| `project_id` | integer | Нет | Фильтр по проекту (0 = без проекта) |

**Ответ (200):**
```json
{
  "date_from": "2024-03-01",
  "date_to": "2024-03-31",
  "total_seconds": 288000,
  "total_hours": 80.0,
  "projects": [
    {
      "project_id": 42,
      "project_name": "Backend 2024",
      "seconds": 144000,
      "hours": 40.0,
      "tasks": [
        {
          "task_id": 12345,
          "task_title": "Авторизация",
          "seconds": 72000,
          "hours": 20.0,
          "users": [
            {
              "user_id": 1,
              "user_name": "Иван Петров",
              "seconds": 72000,
              "hours": 20.0
            }
          ]
        }
      ]
    }
  ],
  "no_project": {
    "project_id": null,
    "project_name": "Без проекта",
    "seconds": 36000,
    "hours": 10.0,
    "tasks": [...]
  }
}
```

---

### GET /api/reports/team-heatmap

Матрица нагрузки команды: пользователь × день.

**Query-параметры:**
| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `date_from` | date | Да | Начало периода |
| `date_to` | date | Да | Конец периода |
| `user_ids` | string | Нет | ID пользователей через запятую: `1,7,42` |

**Ответ (200):**
```json
{
  "date_from": "2024-03-01",
  "date_to": "2024-03-07",
  "dates": ["2024-03-01", "2024-03-02", "2024-03-03", ...],
  "users": [
    {
      "user_id": 1,
      "user_name": "Иван Петров",
      "total_seconds": 144000,
      "total_hours": 40.0,
      "days": {
        "2024-03-01": {"seconds": 28800, "hours": 8.0, "level": "normal"},
        "2024-03-02": {"seconds": 36000, "hours": 10.0, "level": "overtime"},
        "2024-03-03": {"seconds": 0, "hours": 0.0, "level": "idle"}
      }
    }
  ]
}
```

**Уровни нагрузки (level):**
- `idle` — 0 часов
- `low` — менее 4 часов
- `normal` — 4–8 часов
- `overtime` — более 8 часов

---

### GET /api/reports/my-dashboard

Личный дашборд сотрудника.

**Query-параметры:**
| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `user_id` | integer | Да | ID пользователя |
| `date_from` | date | Да | Начало периода |
| `date_to` | date | Да | Конец периода |

**Ответ (200):**
```json
{
  "user_id": 1,
  "user_name": "Иван Петров",
  "date_from": "2024-03-01",
  "date_to": "2024-03-31",
  "total_seconds": 144000,
  "total_hours": 40.0,
  "top_tasks": [
    {"task_id": 12345, "task_title": "Авторизация", "seconds": 72000, "hours": 20.0}
  ],
  "by_project": [
    {
      "project_id": 42,
      "project_name": "Backend 2024",
      "seconds": 108000,
      "hours": 30.0,
      "percent": 75.0
    },
    {
      "project_id": null,
      "project_name": "Без проекта",
      "seconds": 36000,
      "hours": 10.0,
      "percent": 25.0
    }
  ],
  "by_date": [
    {"date": "2024-03-01", "seconds": 28800, "hours": 8.0},
    {"date": "2024-03-04", "seconds": 36000, "hours": 10.0}
  ]
}
```

---

## Коды HTTP-ответов

| Код | Значение | Когда возникает |
|---|---|---|
| 200 | OK | Успешный ответ |
| 400 | Bad Request | Неверные параметры запроса |
| 401 | Unauthorized | Нет токена, токен невалидный или истёк |
| 422 | Unprocessable Entity | FastAPI: нарушение валидации параметров (например, `date_from` отсутствует) |
| 502 | Bad Gateway | Ошибка при запросе к Bitrix24 |
| 503 | Service Unavailable | Webhook URL не настроен |
