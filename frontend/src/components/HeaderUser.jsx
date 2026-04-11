import { Avatar, Space, Typography } from 'antd'
import { useAuth } from '../hooks/useAuth'

const { Text } = Typography

export default function HeaderUser() {
  const { user } = useAuth()

  const avatarLetter = user?.username?.[0]?.toUpperCase() ?? '?'
  const avatarColor = user?.avatar_color ?? '#4361d8'

  return (
    <Space size={10} align="center">
      <Text style={{ color: 'rgba(0,0,0,0.6)' }}>
        {user?.username}
      </Text>
      <Avatar
        size={34}
        style={{
          backgroundColor: avatarColor,
          color: '#fff',
          fontWeight: 600,
          cursor: 'default',
          flexShrink: 0,
        }}
      >
        {avatarLetter}
      </Avatar>
    </Space>
  )
}
