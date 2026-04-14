import { useEffect, useState } from 'react'
import { Typography, Space } from 'antd'
import { usePortalInfo } from '../hooks/usePortalInfo'
import { API_BASE } from '../services/api.js'

const { Text } = Typography

const PULSE_STYLE = `
@keyframes pulse-green {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(82, 196, 26, 0); }
}
@keyframes pulse-red {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.7); }
  50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(255, 77, 79, 0); }
}
`

function StatusDot({ ok }) {
  const size = ok ? 8 : 10
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: ok ? '#52c41a' : '#ff4d4f',
        animation: ok
          ? 'pulse-green 3s ease-in-out infinite'
          : 'pulse-red 1s ease-in-out infinite',
        flexShrink: 0,
        transition: 'width 0.2s, height 0.2s',
      }}
    />
  )
}

function StatusItem({ label, value, dot }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <Text style={{ fontSize: 10, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        {label}
      </Text>
      <Space size={6} align="center">
        {dot !== undefined && <StatusDot ok={dot} />}
        <Text style={{ fontSize: 13, color: '#2d2d3f', whiteSpace: 'nowrap' }}>
          {value}
        </Text>
      </Space>
    </div>
  )
}

const DIVIDER = (
  <div style={{ width: 1, background: '#f0f0f0', alignSelf: 'stretch', margin: '0 4px' }} />
)

export default function AppFooter() {
  const [apiOk, setApiOk] = useState(null)
  const { info: portal } = usePortalInfo()

  useEffect(() => {
    const check = () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4_000)
      fetch(`${API_BASE}/api/health`, { signal: controller.signal })
        .then((res) => { clearTimeout(timer); setApiOk(res.ok) })
        .catch(() => { clearTimeout(timer); setApiOk(false) })
    }

    check()
    const id = setInterval(check, 8_000)
    return () => clearInterval(id)
  }, [])

  const apiStatus = apiOk === null ? 'Проверка...' : apiOk ? 'Работает' : 'Недоступен'
  const portalName = portal ? (portal.portal_name ?? '—') : '...'
  const licenseLabel = portal?.license
    ? portal.license.charAt(0).toUpperCase() + portal.license.slice(1).toLowerCase()
    : '—'

  return (
    <>
      <style>{PULSE_STYLE}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 20px',
          height: 56,
          background: 'rgba(255, 255, 255, 0.62)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: 'none',
          borderRadius: 16,
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.7), 0 4px 24px rgba(80, 70, 150, 0.09)',
          flexShrink: 0,
        }}
      >
        <StatusItem label="Привязанный портал" value={portalName} dot={portal?.connected} />
        {DIVIDER}
        <StatusItem label="Тариф" value={licenseLabel} />
        {DIVIDER}
        <StatusItem
          label="Статус API"
          value={apiStatus}
          dot={apiOk === null ? undefined : apiOk}
        />
      </div>
    </>
  )
}
