// В продакшене на Render задаётся через VITE_API_URL в настройках Static Site.
// Локально переменная не задаётся — используется относительный путь (Nginx проксирует /api/).
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
