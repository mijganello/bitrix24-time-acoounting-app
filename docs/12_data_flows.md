# Потоки данных — как всё работает вместе

## Поток 1: Первичная загрузка приложения

```
1. Пользователь вводит http://localhost в браузер
   ↓
2. Nginx получает GET /
   → location / → proxy_pass http://frontend:5173
   ↓
3. Vite dev-server отдаёт index.html
   ↓
4. Браузер загружает index.html, читает теги <script>
   → Запрашивает /src/main.jsx (etc.)
   ↓
5. React инициализируется (ReactDOM.createRoot().render(<App/>))
   ↓
6. AuthProvider монтируется → проверяет localStorage:
   - Нет токена → setLoading(false), setUser(null)
   ↓
7. ProtectedRoute видит user=null → <Navigate to="/login" />
   ↓
8. Браузер переходит на /login
   → LoginPage рендерится
```

---

## Поток 2: Авторизация (логин)

```
Пользователь вводит admin / password123, нажимает «Войти»
   ↓
LoginPage.onFinish() → login(username, password)
   ↓
authService.login():
   POST /api/auth/login
   body: username=admin&password=password123
   Content-Type: application/x-www-form-urlencoded
   ↓
Nginx: /api/ → backend:8000
   ↓
FastAPI: POST /api/auth/login
   → authenticate_user(db, "admin", "password123")
   → db.query(User).filter(User.username=="admin").first()
   → bcrypt.checkpw("password123", stored_hash)
   → Верно → create_access_token({"sub": "admin"})
   → JWT: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6...
   ↓
authService.login() получает { access_token: "eyJ...", token_type: "bearer" }
   → localStorage.setItem("auth_token", "eyJ...")
   ↓
authService.getMe():
   GET /api/auth/me
   Authorization: Bearer eyJ...
   ↓
FastAPI: GET /api/auth/me
   → get_current_user() → jwt.decode(token, SECRET_KEY) → username="admin"
   → db.query(User)... → User объект
   → Возвращает { id:1, username:"admin", is_active:true, avatar_color:"#4361d8" }
   ↓
AuthProvider.setUser({ id:1, username:"admin", ... })
   ↓
useAuth() во всех компонентах видит user ≠ null
   ↓
ProtectedRoute пропускает → navigate("/")
   ↓
AppLayout монтируется → HomePage рендерится
```

---

## Поток 3: Просмотр отчёта «Сводка по пользователям»

```
Пользователь: Меню → Отчёты → «Сводка по пользователям»
   ↓
React Router: /reports/users-summary → <UsersSummaryPage />
   ↓
Пользователь выбирает период (март 2024), нажимает «Применить»
   ↓
UsersSummaryPage.handleSearch():
   reportsService.getUsersSummary({
     dateFrom: "2024-03-01",
     dateTo: "2024-03-31"
   })
   ↓
fetch("http://localhost/api/reports/users-summary?date_from=2024-03-01&date_to=2024-03-31")
   ↓
Nginx: /api/ → backend:8000
   ↓
FastAPI: async def report_users_summary(date_from=2024-03-01, date_to=2024-03-31)
   ↓
[Этап 1] async with httpx.AsyncClient() as client:
   _get_all_tasks(client):
      POST https://company.bitrix24.ru/rest/1/xxx/tasks.task.list.json
      body: {"select": ["ID","TITLE","GROUP_ID",...], "start": 0}
      → 50 задач (продолжаем, start=50)
      POST ... start=50
      → 50 задач (start=100)
      POST ... start=100
      → 23 задачи (меньше 50, это последняя страница)
      Итого: 123 задачи в памяти
   ↓
[Этап 2] _get_elapsed_batch(client, task_ids):
   Делим 123 задачи на чанки по 50:
   Чанк 1 (50 задач):
      POST .../batch.json
      body: {"halt":0, "cmd": {"e1":"task.elapseditem.getlist?TASKID=1", "e2":...}}
      → Записи времени для 50 задач
   Чанк 2 (50 задач): → аналогично
   Чанк 3 (23 задачи): → аналогично
   Итого: ~1500 записей elapsed time в памяти
   ↓
[Этап 3] Фильтрация по дате:
   elapsed = [e for e in elapsed_raw if _in_range(e, 2024-03-01, 2024-03-31)]
   → Осталось 890 записей
   ↓
[Этап 4] Агрегация по пользователям:
   for e in elapsed:
      uid = int(e["USER_ID"])         # Например 7
      secs = int(e["SECONDS"])        # Например 3600
      agg[7]["seconds_total"] += 3600
      если задача с проектом:
         agg[7]["seconds_with_project"] += 3600
   Результат: {7: {total: 144000, ...}, 42: {total: 72000, ...}}
   ↓
[Этап 5] _get_users(client, [7, 42]):
   POST .../user.get.json {"filter": {"ID": [7, 42]}}
   → [{ID:7, NAME:"Иван", LAST_NAME:"Петров"}, {ID:42, NAME:"Мария",...}]
   ↓
[Этап 6] Формирование ответа:
   rows = [
     {user_id:7, user_name:"Иван Петров", hours_total:40.0, tasks:[...]},
     {user_id:42, user_name:"Мария Иванова", hours_total:20.0, tasks:[...]},
   ]
   Отсортировано по hours (убыв.)
   ↓
Возвращает JSON (~20KB)
   ↓
reportsService.getUsersSummary() возвращает объект
   ↓
UsersSummaryPage.setData(result)
   ↓
React перерендеривает компонент
   ↓
antd Table отображает таблицу с пользователями
```

---

## Поток 4: Смена страницы через навигацию

```
Пользователь кликает «Тепловая карта» в сайдбаре
   ↓
AppSidebar onClick → navigate("/reports/team-heatmap")
   ↓
React Router: URL меняется на /reports/team-heatmap
   (без перезагрузки страницы — SPA!)
   ↓
AppLayout Routes → <TeamHeatmapPage />
   ↓
TeamHeatmapPage монтируется
   Загружает список пользователей:
   reportsService.getUsersList() → GET /api/reports/users-list
   ↓
Пользователь задаёт период и нажимает «Сформировать»
   ↓
reportsService.getTeamHeatmap(...) → GET /api/reports/team-heatmap?...
   ↓
Backend собирает матрицу, возвращает JSON
   ↓
TeamHeatmapPage рендерит цветную матрицу с HeatCell-ячейками
```

---

## Как React обновляет интерфейс (система состояния)

В React данные хранятся в «состоянии» (state) через хук `useState`. При изменении состояния компонент перерисовывается.

```jsx
// Пример из UsersSummaryPage
const [data, setData] = useState(null)    // Данные отчёта
const [loading, setLoading] = useState(false)  // Флаг загрузки
const [error, setError] = useState(null)  // Текст ошибки

const handleSearch = async () => {
  setLoading(true)          // → React рендерит, кнопка становится Loading
  setError(null)
  try {
    const result = await reportsService.getUsersSummary(...)
    setData(result)         // → React рендерит, таблица обновляется
  } catch (err) {
    setError(err.message)   // → React рендерит, появляется Alert с ошибкой
  } finally {
    setLoading(false)       // → React рендерит, кнопка снова активна
  }
}
```

Каждый вызов `setState` инициирует новый рендер компонента. React сравнивает Virtual DOM с реальным и обновляет только то, что изменилось.

---

## Схема хранения данных в браузере

```
localStorage:
  auth_token: "eyJhbGciOiJIUzI1NiJ9..."   ← JWT-токен (строка)

React State (в памяти, теряется при перезагрузке):
  AuthContext:
    user: { id: 1, username: "admin", ... }
    loading: false

  UsersSummaryPage:
    data: { users: [...], total_hours: 80 }
    loading: false
    range: [dayjs(2024-03-01), dayjs(2024-03-31)]
    selectedUser: null
```

При перезагрузке страницы:
- localStorage сохраняется → токен на месте
- React State сбрасывается → `useEffect` в AuthProvider снова вызывает `/api/auth/me`
- Отчёты нужно загружать заново
