import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authService } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authId = params.get('AUTH_ID') || params.get('auth_id')
    const domain = params.get('DOMAIN') || params.get('domain')
    const refreshId = params.get('REFRESH_ID') || params.get('refresh_id')
    const isInstall = params.get('install') === '1'
    if (authId) {
      authService
        .loginWithBitrix({ authId, domain, refreshId })
        .then(() => authService.getMe())
        .then((me) => {
          if (isInstall && window.BX24?.installFinish) {
            window.BX24.installFinish()
          }
          return me
        })
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname)
          setLoading(false)
        })
      return
    }

    if (!authService.isAuthenticated()) {
      setLoading(false)
      return
    }
    authService
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    await authService.login(username, password)
    const me = await authService.getMe()
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}
