import { Typography } from 'antd'

const { Title, Text } = Typography

export default function HomePage() {
  return (
    <div style={{ padding: '32px 0' }}>
      <Title level={3} style={{ marginTop: 0 }}>
        Главная
      </Title>
      <Text type="secondary">Раздел в разработке.</Text>
    </div>
  )
}
