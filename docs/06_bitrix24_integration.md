# Интеграция с Bitrix24

## Что такое Bitrix24?

**Bitrix24** — это российская корпоративная платформа для управления бизнесом. В ней есть CRM, задачи, проекты, чаты, документы и многое другое. Компании используют её как внутренний корпоративный портал — каждая компания имеет свой портал по адресу типа `mycompany.bitrix24.ru`.

У каждой задачи в Bitrix24 есть функция учёта времени — сотрудник может нажать кнопку «Добавить время» и указать, сколько часов потратил на задачу.

---

## REST API Bitrix24

Bitrix24 предоставляет **REST API** — набор HTTP-методов для программного взаимодействия с платформой. REST означает «Representational State Transfer» — стиль архитектуры веб-сервисов.

API Bitrix24 работает через обычные HTTP-запросы (POST или GET) на URL вида:
```
https://mycompany.bitrix24.ru/rest/USER_ID/WEBHOOK_TOKEN/METHOD.json
```

---

## Webhook — способ авторизации

**Webhook (входящий вебхук)** — это специальный URL с токеном, который создаётся в настройках Bitrix24. Он даёт доступ к API без полноценной OAuth-авторизации.

Пример URL вебхука:
```
https://mycompany.bitrix24.ru/rest/1/abc123xyz456/
```

Конфигурируется через переменную окружения:
```
BITRIX24_WEBHOOK_URL=https://mycompany.bitrix24.ru/rest/1/abc123xyz456/
```

Для создания вебхука в Bitrix24:
1. Разработчик → Другое → Входящий вебхук
2. Выбрать права доступа: задачи, пользователи, рабочие группы
3. Скопировать URL

---

## Используемые методы Bitrix24 REST API

### tasks.task.list — список задач

Возвращает задачи с пагинацией (по 50 штук). Поддерживает фильтрацию по `GROUP_ID` (проект).

Запрос:
```python
await client.post(f"{webhook}/tasks.task.list.json", json={
    "select": ["ID", "TITLE", "GROUP_ID", "RESPONSIBLE_ID", "STATUS"],
    "filter": {},
    "start": 0  # Смещение (0 = первая страница, 50 = вторая и т.д.)
})
```

Ответ содержит поле `result.tasks` — массив задач:
```json
{
  "result": {
    "tasks": [
      {
        "id": "12345",
        "title": "Разработка модуля авторизации",
        "groupId": "42",
        "responsibleId": "7",
        "status": "5"
      },
      ...
    ]
  }
}
```

**Пагинация:** Если вернулось 50 задач — возможно, есть ещё. Делаем запрос с `start: 50`. Повторяем до тех пор, пока пришло меньше 50 — это последняя страница.

### task.elapseditem.getlist — затраченное время

Возвращает записи о затраченном времени по конкретной задаче.

```python
await client.post(f"{webhook}/task.elapseditem.getlist.json", json={},
    params={"TASKID": 12345}
)
```

Ответ:
```json
[
  {
    "ID": "891",
    "TASK_ID": "12345",
    "USER_ID": "7",
    "SECONDS": "3600",
    "CREATED_DATE": "2024-03-15T14:30:00+03:00",
    "COMMENT_TEXT": "Реализация JWT"
  }
]
```

Поле `SECONDS` — количество секунд (целое число в виде строки). `CREATED_DATE` — дата записи (ISO 8601 с часовым поясом).

### batch — пакетный запрос

Позволяет выполнить до 50 API-методов за один HTTP-запрос. Это критически важно для производительности: вместо 200 отдельных запросов для 200 задач — 4 batch-запроса по 50.

```python
cmd = {
    "e12345": "task.elapseditem.getlist?TASKID=12345",
    "e12346": "task.elapseditem.getlist?TASKID=12346",
    ...
}
result = await client.post(f"{webhook}/batch.json", json={
    "halt": 0,   # 0 = продолжать при ошибке в одном из запросов
    "cmd": cmd
})
```

Ответ `result.result` — словарь, где ключ = ключ из `cmd`:
```json
{
  "result": {
    "result": {
      "e12345": [...записи времени...],
      "e12346": [...записи времени...]
    }
  }
}
```

### user.get — пользователи

Получение данных пользователей по списку ID.

```python
await client.post(f"{webhook}/user.get.json", json={
    "filter": {"ID": [1, 7, 42]}
})
```

Ответ — массив пользователей:
```json
[
  {"ID": "7", "NAME": "Иван", "LAST_NAME": "Петров", "EMAIL": "ivan@company.ru"},
  ...
]
```

Приложение использует только `NAME` и `LAST_NAME` для отображения.

### sonet_group.get — проекты

Получение рабочих групп типа «Проект» (PROJECT=Y).

```python
await client.post(f"{webhook}/sonet_group.get.json", json={
    "FILTER": {"PROJECT": "Y", "ACTIVE": "Y"},
    "select": ["ID", "NAME"]
})
```

### app.info — информация о портале

```python
await client.post(f"{webhook}/app.info.json")
```

Возвращает: `PORTAL_NAME`, `LICENSE`, `LANGUAGE_ID`, `PORTAL_ADDRESS`.

---

## Архитектура взаимодействия с Bitrix24

```
Запрос фронтенда
    ↓
FastAPI эндпоинт (async def report_users_summary)
    ↓
httpx.AsyncClient (HTTP-клиент)
    ↓ POST
Bitrix24 REST API (tasks.task.list, batch, user.get)
    ↓ JSON ответ
Python: агрегация, фильтрация, вычисления
    ↓
JSON ответ фронтенду
```

**Важный момент:** Данные **не кэшируются**. При каждом запросе отчёта приложение заново обращается к Bitrix24. Это означает:
- **Плюс:** Данные всегда актуальные.
- **Минус:** Время загрузки зависит от количества задач и скорости Bitrix24 (несколько секунд при большом количестве задач).

---

## Обработка ошибок

```python
async def _bx(client: httpx.AsyncClient, method: str, params) -> dict | list:
    resp = await client.post(f"{_webhook()}/{method}.json", json=params, timeout=30.0)
    resp.raise_for_status()  # Если HTTP-статус 4xx/5xx → исключение
    data = resp.json()
    if "error" in data:     # Bitrix24 может вернуть 200 OK, но с ошибкой в теле
        raise HTTPException(502, detail=f"Bitrix24 [{method}]: {data['error']}")
    return data.get("result", data)
```

Timeout 30 секунд — если Bitrix24 не ответил за 30 секунд, запрос отменяется.

---

## Фильтрация по дате

Поле `CREATED_DATE` в elasticized (записях времени) содержит дату в формате ISO 8601 с часовым поясом. Приложение парсит дату и сравнивает с запрошенным диапазоном:

```python
def _in_range(item: dict, date_from: date, date_to: date) -> bool:
    dt = datetime.fromisoformat(item.get("CREATED_DATE"))
    d = dt.date()  # Берём только дату, отбрасывая время и часовой пояс
    return date_from <= d <= date_to
```

Фильтрация происходит **на стороне Python**, не на стороне Bitrix24 — то есть сначала забираем все записи, потом фильтруем. Это менее эффективно, зато проще в реализации.

---

## Пример полного цикла отчёта «Сводка по пользователям»

1. Фронтенд отправляет: `GET /api/reports/users-summary?date_from=2024-03-01&date_to=2024-03-31`
2. FastAPI вызывает `report_users_summary(date_from=..., date_to=...)`
3. Backend делает запрос к Bitrix24: `tasks.task.list` (все задачи, пагинировано)
4. Получает 150 задач → list ID = `[12345, 12346, ..., 12494]`
5. Делает 3 batch-запроса по 50 задач → получает все записи elapsed time
6. Фильтрует по диапазону дат
7. Агрегирует: `{user_id: {total_seconds, with_project_seconds, tasks: {...}}}`
8. Запрашивает имена пользователей: `user.get`
9. Формирует итоговый JSON и возвращает фронтенду
10. Фронтенд отображает таблицу
