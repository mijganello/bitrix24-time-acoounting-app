import { API_BASE } from './api.js'

const TOKEN_KEY = 'auth_token'

export const authService = {
  async login(username, password) {
    const formData = new URLSearchParams()
    formData.append('username', username)
    formData.append('password', password)

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Ошибка авторизации')
    }

    const data = await res.json()
    localStorage.setItem(TOKEN_KEY, data.access_token)
    return data
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY)
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY))
  },

  async getMe() {
    const token = this.getToken()
    if (!token) throw new Error('Нет токена')

    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 401) {
      this.logout()
      throw new Error('Сессия истекла')
    }

    if (!res.ok) throw new Error('Ошибка получения данных пользователя')
    return res.json()
  },
}
