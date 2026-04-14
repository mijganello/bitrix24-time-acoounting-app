import { API_BASE } from './api.js'

const BASE = `${API_BASE}/api/reports`

export const reportsService = {
  async getUsersSummary({ dateFrom, dateTo, userId } = {}) {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (userId) params.set('user_id', userId)
    const res = await fetch(`${BASE}/users-summary?${params}`)
    if (!res.ok) throw new Error(`Ошибка загрузки отчёта (${res.status})`)
    return res.json()
  },

  async getProjects({ dateFrom, dateTo, userId, projectId } = {}) {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (userId) params.set('user_id', userId)
    if (projectId !== undefined) params.set('project_id', projectId)
    const res = await fetch(`${BASE}/projects?${params}`)
    if (!res.ok) throw new Error(`Ошибка загрузки отчёта (${res.status})`)
    return res.json()
  },

  async getTeamHeatmap({ dateFrom, dateTo, userIds } = {}) {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (userIds?.length) params.set('user_ids', userIds.join(','))
    const res = await fetch(`${BASE}/team-heatmap?${params}`)
    if (!res.ok) throw new Error(`Ошибка загрузки отчёта (${res.status})`)
    return res.json()
  },

  async getMyDashboard({ userId, dateFrom, dateTo } = {}) {
    const params = new URLSearchParams({ user_id: userId, date_from: dateFrom, date_to: dateTo })
    const res = await fetch(`${BASE}/my-dashboard?${params}`)
    if (!res.ok) throw new Error(`Ошибка загрузки отчёта (${res.status})`)
    return res.json()
  },

  async getUsersList() {
    const res = await fetch(`${BASE}/users-list`)
    if (!res.ok) throw new Error(`Ошибка загрузки пользователей (${res.status})`)
    return res.json()
  },
}
