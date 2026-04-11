import { useEffect, useState } from 'react'
import {
  ConfigProvider,
  Layout,
  Typography,
  Card,
  Alert,
  Descriptions,
  Spin,
  theme,
} from 'antd'
import { ApiOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Header, Content } = Layout
const { Title, Text } = Typography

function App() {
  const [apiInfo, setApiInfo] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/health')
        .then((res) => res.json())
        .then((data) => setStatus(data.message)),
      fetch('/api/info')
        .then((res) => res.json())
        .then((data) => setApiInfo(data)),
    ])
      .catch(() => setError('Не удалось подключиться к API'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: 'auto',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <Title level={2} style={{ color: '#fff', margin: 0 }}>
            Bitrix24 — Учёт времени
          </Title>
          <Text style={{ color: '#bfdbfe' }}>
            Анализ времязатрат по задачам и проектам
          </Text>
        </Header>

        <Content style={{ maxWidth: 800, margin: '32px auto', padding: '0 16px', width: '100%' }}>
          <Spin spinning={loading} size="large">
            <Card
              title={
                <>
                  <ApiOutlined style={{ marginRight: 8 }} />
                  Статус API
                </>
              }
              style={{ marginBottom: 24 }}
            >
              {error ? (
                <Alert title={error} type="error" showIcon />
              ) : status ? (
                <Alert title={status} type="success" showIcon />
              ) : null}
            </Card>

            {apiInfo && (
              <Card
                title={
                  <>
                    <InfoCircleOutlined style={{ marginRight: 8 }} />
                    О приложении
                  </>
                }
              >
                <Descriptions column={1}>
                  <Descriptions.Item label="Название">{apiInfo.app}</Descriptions.Item>
                  <Descriptions.Item label="Версия">{apiInfo.version}</Descriptions.Item>
                  <Descriptions.Item label="Описание">{apiInfo.description}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </Spin>
        </Content>
      </Layout>
    </ConfigProvider>
  )
}

export default App
