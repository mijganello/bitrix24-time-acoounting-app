import { useEffect, useState } from 'react'
import { Alert, Card, Descriptions, Spin, Badge, Typography } from 'antd'
import { ApiOutlined, InfoCircleOutlined, GlobalOutlined } from '@ant-design/icons'
import { usePortalInfo } from '../hooks/usePortalInfo'

const { Text } = Typography

export default function PlatformStatusPage() {
  const [apiInfo, setApiInfo] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const { info: portal, loading: portalLoading } = usePortalInfo()

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
    <Spin spinning={loading || portalLoading} size="large">
      <Card
        title={<><GlobalOutlined style={{ marginRight: 8 }} />Портал Bitrix24</>}
        style={{ marginBottom: 24 }}
      >
        {portal ? (
          <Descriptions column={1}>
            <Descriptions.Item label="Адрес портала">
              {portal.portal_url
                ? <a href={portal.portal_url} target="_blank" rel="noreferrer">{portal.portal_url}</a>
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Название">{portal.portal_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Тариф">
              {portal.license
                ? portal.license.charAt(0).toUpperCase() + portal.license.slice(1).toLowerCase()
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Язык">{portal.language ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Соединение">
              <Badge
                status={portal.connected ? 'success' : 'error'}
                text={portal.connected ? 'Подключено' : 'Нет связи'}
              />
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">Загрузка...</Text>
        )}
      </Card>

      <Card
        title={<><ApiOutlined style={{ marginRight: 8 }} />Статус API</>}
        style={{ marginBottom: 24 }}
      >
        {error ? (
          <Alert message={error} type="error" showIcon />
        ) : status ? (
          <Alert message={status} type="success" showIcon />
        ) : null}
      </Card>

      {apiInfo && (
        <Card title={<><InfoCircleOutlined style={{ marginRight: 8 }} />О приложении</>}>
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
