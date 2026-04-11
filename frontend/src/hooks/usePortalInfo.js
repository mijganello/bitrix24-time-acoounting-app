import { useEffect, useState } from 'react'
import { bitrixService } from '../services/bitrixService'

export function usePortalInfo() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bitrixService
      .getPortalInfo()
      .then(setInfo)
      .catch(() => setInfo({ connected: false }))
      .finally(() => setLoading(false))
  }, [])

  return { info, loading }
}
