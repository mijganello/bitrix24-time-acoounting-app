import { Typography } from 'antd'
import HeaderUser from './HeaderUser'

const { Text } = Typography

export default function AppHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        background: 'rgba(255, 255, 255, 0.62)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: 'none',
        borderRadius: 16,
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.7), 0 4px 24px rgba(80, 70, 150, 0.09)',
        flexShrink: 0,
        height: 56,
      }}
    >
      <Text
        strong
        style={{
          color: '#2d2d3f',
          fontSize: 15,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        Bitrix24 — Учёт времени
      </Text>

      <HeaderUser />
    </div>
  )
}
