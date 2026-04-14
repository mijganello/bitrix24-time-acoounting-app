# Содержание документации WORKERPUNCH v2

## Документы

| Файл | Тема |
|---|---|
| [01_overview.md](01_overview.md) | Общее описание: что это, для кого, какую проблему решает |
| [02_architecture.md](02_architecture.md) | Архитектура: схема системы, Docker, Nginx, взаимодействие сервисов |
| [03_backend.md](03_backend.md) | Backend (Python/FastAPI): структура, авторизация, отчёты, Bitrix24 API |
| [04_frontend.md](04_frontend.md) | Frontend (React/Vite): компоненты, страницы, сервисы, дизайн |
| [05_database.md](05_database.md) | База данных PostgreSQL: схема таблиц, SQLAlchemy, безопасность паролей |
| [06_bitrix24_integration.md](06_bitrix24_integration.md) | Интеграция с Bitrix24: REST API, Webhook, методы, пагинация |
| [07_docker_deployment.md](07_docker_deployment.md) | Docker и развёртывание: Dockerfile, Compose, Nginx, команды |
| [08_api_reference.md](08_api_reference.md) | Справочник API: все эндпоинты, параметры, примеры ответов |
| [09_technologies.md](09_technologies.md) | Технологии: полный список библиотек и инструментов |
| [10_security.md](10_security.md) | Безопасность: JWT, bcrypt, CORS, OWASP |
| [11_setup_guide.md](11_setup_guide.md) | Руководство по запуску: шаг за шагом от нуля |
| [12_data_flows.md](12_data_flows.md) | Потоки данных: как всё работает вместе от клика до ответа |

---

## Краткое резюме

**WORKERPUNCH v2** — веб-система аналитики рабочего времени для команд Bitrix24.

- **Backend**: Python 3.12, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: React 19, Ant Design 6, Vite 6
- **Инфраструктура**: Docker Compose, Nginx
- **Интеграция**: Bitrix24 REST API (Webhook)
- **Авторизация**: JWT (HS256, bcrypt)
- **Отчёты**: сводка по пользователям, детализация по проектам, тепловая карта нагрузки, личный дашборд
