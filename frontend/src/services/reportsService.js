import { API_BASE } from './api.js'
import { authService } from './authService.js'

const BASE = `${API_BASE}/api/reports`
const KPI_BASE = `${API_BASE}/api/kpi`

async function authorizedFetch(url, options = {}) {
  const token = authService.getToken()
  const headers = {
    ...(options.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return fetch(url, { ...options, headers })
}

export const reportsService = {
  async getUsersSummary({ dateFrom, dateTo, userId } = {}) {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (userId) params.set('user_id', userId)
    const res = await authorizedFetch(`${BASE}/users-summary?${params}`)
    if (!res.ok) throw new Error(`Failed to load users summary (${res.status})`)
    return res.json()
  },

  async getEmployeesComparison({ dateFrom, dateTo } = {}) {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    const res = await authorizedFetch(`${BASE}/employees-comparison?${params}`)
    if (!res.ok) throw new Error(`Failed to load employee rating (${res.status})`)
    return res.json()
  },

  async getProjects({ dateFrom, dateTo, userId, projectId } = {}) {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (userId) params.set('user_id', userId)
    if (projectId !== undefined) params.set('project_id', projectId)
    const res = await authorizedFetch(`${BASE}/projects?${params}`)
    if (!res.ok) throw new Error(`Failed to load projects report (${res.status})`)
    return res.json()
  },

  async getTeamHeatmap({ dateFrom, dateTo, userIds } = {}) {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    if (userIds?.length) params.set('user_ids', userIds.join(','))
    const res = await authorizedFetch(`${BASE}/team-heatmap?${params}`)
    if (!res.ok) throw new Error(`Failed to load heatmap report (${res.status})`)
    return res.json()
  },

  async getMyDashboard({ userId, dateFrom, dateTo } = {}) {
    const params = new URLSearchParams({ user_id: userId, date_from: dateFrom, date_to: dateTo })
    const res = await authorizedFetch(`${BASE}/my-dashboard?${params}`)
    if (!res.ok) throw new Error(`Failed to load personal dashboard (${res.status})`)
    return res.json()
  },

  async getUsersList() {
    const res = await authorizedFetch(`${BASE}/users-list`)
    if (!res.ok) throw new Error(`Failed to load users list (${res.status})`)
    return res.json()
  },

  async getKpiSnapshots({ dateFrom, dateTo } = {}) {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
    const res = await authorizedFetch(`${KPI_BASE}/snapshots?${params}`)
    if (!res.ok) throw new Error(`Failed to load KPI snapshots (${res.status})`)
    return res.json()
  },
}
