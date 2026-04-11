import { Button } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'


export default function SidebarToggle({ collapsed, onToggle }) {
  return (
    <div
      style={{
        width: collapsed ? 80 : 220,
        height: 56,
        background: 'rgba(255, 255, 255, 0.62)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: 'none',
        borderRadius: 16,
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.7), 0 4px 24px rgba(80, 70, 150, 0.09)',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexShrink: 0,
        padding: 4,
      }}
    >
      <Button
        variant='filled'
        color='default'
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={onToggle}
        style={{
          width: collapsed ? 72 : 220,
          height: 48,
          borderRadius: 10,
          fontSize: 16,
        }}
      >
      </Button>
    </div>
  )
}
