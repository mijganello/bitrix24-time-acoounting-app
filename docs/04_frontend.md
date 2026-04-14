# Frontend — клиентская часть приложения

## Что такое Frontend?

Frontend (фронтенд) — это часть приложения, которую пользователь видит и с которой взаимодействует в браузере. Это HTML (структура), CSS (стили) и JavaScript (поведение). В нашем случае фронтенд написан с использованием библиотеки **React** и собирается инструментом **Vite**.

Расположение: `frontend/`

---

## Стек технологий

| Технология | Версия | Назначение |
|---|---|---|
| **React** | 19 | Библиотека для построения пользовательского интерфейса. Работает с «компонентами» — переиспользуемыми блоками UI. |
| **Vite** | 6.3 | Инструмент сборки. В режиме разработки запускает dev-сервер с мгновенной перезагрузкой (HMR). В продакшн — собирает оптимизированный бандл. |
| **React Router DOM** | 7.14 | Маршрутизация — определяет, какую страницу показывать при каком URL. |
| **Ant Design (antd)** | 6.3 | Библиотека UI-компонентов: таблицы, кнопки, выпадающие списки, дейтпикеры, статистика и др. |
| **@ant-design/icons** | 6.1 | Иконки для Ant Design. |
| **react-icons** | 5.6 | Дополнительные иконки из различных наборов. |
| **dayjs** | — | Библиотека для работы с датами и временем (облегчённая альтернатива moment.js). |

---

## Структура папки frontend/src/

```
src/
├── App.jsx            # Корневой компонент: маршрутизация, тема, layout
├── App.css            # Глобальные стили приложения
├── main.jsx           # Точка входа React: монтирование App в DOM
├── index.css          # Базовые CSS-переменные и reset стилей
│
├── components/        # Переиспользуемые компоненты
│   ├── AppHeader.jsx      # Верхняя шапка (логотип + пользователь)
│   ├── AppSidebar.jsx     # Боковая навигационная панель
│   ├── AppFooter.jsx      # Нижний колонтитул
│   ├── HeaderUser.jsx     # Компонент имени пользователя в шапке
│   ├── ProtectedRoute.jsx # Защита маршрутов (редирект на /login)
│   └── SidebarToggle.jsx  # Кнопка сворачивания сайдбара
│
├── hooks/             # React-хуки (переиспользуемая логика)
│   ├── useAuth.jsx        # Контекст авторизации + хук useAuth()
│   └── usePortalInfo.js   # Хук загрузки данных о Bitrix24-портале
│
├── pages/             # Страницы приложения (один файл = одна страница)
│   ├── LoginPage.jsx          # Страница входа
│   ├── HomePage.jsx           # Главная страница (дашборд)
│   ├── PlatformStatusPage.jsx # Статус платформы
│   ├── ReportsPage.jsx        # Каталог отчётов
│   ├── UsersSummaryPage.jsx   # Отчёт: сводка по пользователям
│   ├── ProjectsReportPage.jsx # Отчёт: детализация по проектам
│   ├── TeamHeatmapPage.jsx    # Отчёт: тепловая карта нагрузки
│   └── MyDashboardPage.jsx    # Отчёт: личный дашборд
│
└── services/          # Слой работы с API
    ├── api.js             # Базовый URL (VITE_API_URL)
    ├── authService.js     # Методы авторизации (login, logout, getMe)
    ├── bitrixService.js   # Методы Bitrix24 (getPortalInfo)
    └── reportsService.js  # Методы отчётов (4 отчёта + users-list)
```

---

## main.jsx — точка входа

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
```

Это стандартный способ запустить React-приложение. `document.getElementById('root')` — находит `<div id="root">` в `index.html`, и React «монтирует» в него всё приложение.

---

## App.jsx — корневой компонент и маршрутизация

### Тема Ant Design

```jsx
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#4361d8',   // Основной синий цвет
      borderRadius: 10,           // Скругление углов всех компонентов
      colorBgLayout: '#f2f3f8',  // Цвет фона страницы
    },
  }}
>
```

`ConfigProvider` — провайдер темы Ant Design. Задаёт глобальные визуальные настройки для всех компонентов antd в приложении.

### Маршрутизация

```jsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route
    path="/*"
    element={
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    }
  />
</Routes>
```

- `/login` — доступна без авторизации.
- Все остальные маршруты (`/*`) обёрнуты в `ProtectedRoute` — если пользователь не авторизован, его перебрасывает на `/login`.

### AppLayout

Компонент `AppLayout` описывает трёхколоночный Layout (Sidebar + Content):

```
┌────────┬─────────────────────────────┐
│Toggle  │ AppHeader                   │
├────────┤─────────────────────────────┤
│        │                             │
│Sidebar │  <Outlet / Страница>        │
│        │                             │
├────────┤─────────────────────────────┤
│        │ AppFooter                   │
└────────┴─────────────────────────────┘
```

Состояние `collapsed` (boolean) управляет шириной сайдбара: `220px` (развёрнут) или `80px` (свёрнут, только иконки).

---

## Система авторизации (useAuth + AuthContext)

React Context — механизм «глобального состояния». `AuthProvider` создаёт контекст авторизации, доступный любому компоненту через хук `useAuth()`.

```jsx
// Инициализация при загрузке приложения
useEffect(() => {
  if (!authService.isAuthenticated()) {
    setLoading(false)
    return
  }
  authService.getMe()
    .then(setUser)
    .catch(() => setUser(null))
    .finally(() => setLoading(false))
}, [])
```

При старте приложения:
1. Проверяет localStorage — есть ли токен?
2. Если есть — делает запрос `GET /api/auth/me`, чтобы убедиться в его валидности.
3. Если токен протух или невалидный — сбрасывает пользователя.

### authService.js

Сервис-слой для работы с API авторизации:
- `login(username, password)` — POST-запрос на `/api/auth/login`, сохраняет токен в `localStorage`.
- `logout()` — удаляет токен из `localStorage`.
- `getToken()` — читает токен из `localStorage`.
- `isAuthenticated()` — проверяет наличие токена.
- `getMe()` — GET-запрос на `/api/auth/me` с заголовком `Authorization: Bearer <token>`.

**Почему localStorage?** Это встроенное хранилище браузера. Данные в нём сохраняются даже после закрытия вкладки. Это удобно, но есть нюансы безопасности (XSS). Для учебного/внутреннего приложения это приемлемо.

---

## ProtectedRoute.jsx — защита маршрутов

```jsx
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Spin size="large" />  // Крутилка, пока проверяем токен
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
```

`state={{ from: location }}` — запоминает, откуда пользователь пришёл. После успешного логина его перебросит обратно на нужную страницу.

---

## Pages — страницы приложения

### LoginPage.jsx

Форма входа. Использует `Form` из Ant Design (с встроенной валидацией полей). При submit — вызывает `login()` из хука `useAuth()`. При ошибке показывает `Alert`. Дизайн — glassmorphism (полупрозрачная карточка).

### HomePage.jsx (Главная)

Приветственная страница с виджетами:
- Текущий пользователь с приветствием в зависимости от времени суток.
- Мини-дашборд с данными за текущую неделю/месяц: total часов, топ задач, разбивка по проектам.
- Карточки-ссылки на все 4 отчёта.

Загружает данные через `reportsService.getMyDashboard()` при смене периода (неделя/месяц).

### ReportsPage.jsx (Каталог отчётов)

Статическая страница — сетка карточек с описанием всех 4 отчётов. Клик по карточке — переход на страницу отчёта через `react-router-dom`.

### UsersSummaryPage.jsx (Сводка по пользователям)

Фильтры: период (DatePicker с быстрыми пресетами), опциональный фильтр по пользователю.

Таблица (**antd Table**) с раскрывающимися строками. Каждая строка = один пользователь. При раскрытии (`expandable`) показывается вложенная таблица задач с прогресс-барами.

Формат времени: `fmtHours(h)` — конвертирует дробные часы в читаемый формат (`2 ч 30 м`).

### ProjectsReportPage.jsx (По проектам)

Строит дерево через расширяемые строки таблицы antd. Структура:
- Проект (первый уровень)
  - Задача (второй уровень, при раскрытии)
    - Пользователь (третий уровень)

Отдельный блок «Без проекта» — задачи, не привязанные ни к одному проекту.

### TeamHeatmapPage.jsx (Тепловая карта)

Визуализирует матрицу нагрузки. Каждый день каждого сотрудника — это цветная ячейка. Цвет зависит от уровня нагрузки:

| Уровень | Цвет | Часы |
|---|---|---|
| `idle` | Серый | 0 ч |
| `low` | Жёлтый | менее 4 ч |
| `normal` | Зелёный | 4–8 ч |
| `overtime` | Красный | более 8 ч |

При наведении на ячейку — Tooltip с точным числом часов. Реализовано как кастомный компонент `HeatCell`, не используется сторонняя библиотека heatmap.

### MyDashboardPage.jsx (Личный дашборд)

Страница для просмотра статистики конкретного сотрудника. Фильтры: выбор сотрудника из списка, период.

Секции:
- Итог часов за период.
- Топ задач (таблица).
- Разбивка по проектам (с процентами и Progress-барами).
- График активности по дням (таблица).
- Если пользователь — сам сотрудник, по умолчанию выбирается он сам.

---

## services/ — слой API

Все обращения к Backend вынесены в отдельные файлы-сервисы. Это **разделение ответственности**: страницы не знают, как именно делаются HTTP-запросы.

### api.js

```js
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
```

В разработке `VITE_API_URL` не задан → `API_BASE = ''` → запросы идут на текущий домен (например `http://localhost/api/...`), а Nginx проксирует их на backend.

В продакшн можно задать `VITE_API_URL=https://api.mycompany.com` через переменные окружения при сборке.

### reportsService.js

Каждый метод формирует URL с `URLSearchParams` и делает `fetch()`. При ошибке HTTP-статуса (`!res.ok`) бросает Error с текстом.

```js
async getUsersSummary({ dateFrom, dateTo, userId }) {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  if (userId) params.set('user_id', userId)
  const res = await fetch(`${BASE}/users-summary?${params}`)
  if (!res.ok) throw new Error(`Ошибка (${res.status})`)
  return res.json()
}
```

---

## Vite и сборка

### vite.config.js

```js
export default defineConfig({
  plugins: [react()],                    // Плагин для обработки JSX
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),  // Инжектирует версию из package.json
  },
  server: {
    host: '0.0.0.0',                    // Слушает все интерфейсы (нужно для Docker)
    port: 5173,
    watch: { usePolling: true },        // Polling для HMR внутри Docker
    hmr: {
      clientPort: 80,                   // Сообщает браузеру порт Nginx (не 5173)
      path: '/vite-hmr',               // WebSocket путь для HMR
    },
  },
})
```

**HMR (Hot Module Replacement)** — когда разработчик меняет код, Vite мгновенно обновляет только изменённый модуль в браузере без полной перезагрузки страницы. Состояние компонентов при этом сохраняется.

### Dockerfile (разработка)

```dockerfile
FROM node:22-alpine          # Базовый образ Node.js 22
WORKDIR /app
COPY package*.json ./
RUN npm install              # Устанавливаем зависимости
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]    # Запускаем Vite dev-сервер
```

Volume `./frontend:/app` в docker-compose монтирует папку с кодом внутрь контейнера, поэтому при изменении файлов на хост-машине Vite видит изменения через polling.

---

## Дизайн (Glassmorphism)

Стиль glassmorphism («стекломорфизм») — популярный дизайн-тренд 2020-х. Его признаки:
- Полупрозрачные панели: `background: rgba(255, 255, 255, 0.62)`
- Размытие фона сквозь панель: `backdropFilter: blur(18px)`
- Тонкая белая обводка: `boxShadow: 0 0 0 1px rgba(255,255,255,0.7)`
- Мягкая тень: `0 4px 24px rgba(80,70,150,0.09)`
- Скруглённые углы: `borderRadius: 16`

Эффект реализован чистым CSS через инлайн-стили в React (объект `style`). Браузерный префикс `WebkitBackdropFilter` добавлен для совместимости с Safari.

---

## Кастомизация темы Ant Design

Ant Design 5+ использует **Design Tokens** — систему CSS-переменных. Через `ConfigProvider` переопределяются базовые токены:

```jsx
token: {
  colorPrimary: '#4361d8',  // Синий цвет для кнопок, ссылок, акцентов
  borderRadius: 10,          // Глобальное скругление всех компонентов
  colorBgLayout: '#f2f3f8', // Серый фон вне панелей
}
```

Отдельные компоненты кастомизируются через `theme.components`:
```jsx
Menu: {
  itemHeight: 48,
  itemBorderRadius: 10,
  itemSelectedBg: 'rgba(67, 97, 216, 0.12)',
  itemSelectedColor: '#4361d8',
}
```
