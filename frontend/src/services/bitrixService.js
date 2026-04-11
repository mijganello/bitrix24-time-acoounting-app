export const bitrixService = {
  async getPortalInfo() {
    const res = await fetch('/api/bitrix/portal')
    if (!res.ok) throw new Error('Ошибка получения информации о портале')
    return res.json()
  },
}
