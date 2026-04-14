import { API_BASE } from './api.js'

export const bitrixService = {
  async getPortalInfo() {
    const res = await fetch(`${API_BASE}/api/bitrix/portal`)
    if (!res.ok) throw new Error('Ошибка получения информации о портале')
    return res.json()
  },
}
