import { useEffect, useState } from 'react'
import { Alert, Card, Descriptions, Spin } from 'antd'
import { ApiOutlined, InfoCircleOutlined } from '@ant-design/icons'

export default function PlatformStatusPage() {
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
          <Alert message={error} type="error" showIcon />
        ) : status ? (
          <Alert message={status} type="success" showIcon />
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
  )
}
