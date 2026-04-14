import { useEffect, useState } from 'react'
import { Alert, Card, Descriptions, Spin, Badge, Typography, Tag, Space, Divider } from 'antd'
import { ApiOutlined, InfoCircleOutlined, GlobalOutlined, RocketOutlined, SafetyOutlined } from '@ant-design/icons'
import { usePortalInfo } from '../hooks/usePortalInfo'
import { API_BASE } from '../services/api.js'

const { Text, Paragraph } = Typography

export default function PlatformStatusPage() {
  const [apiInfo, setApiInfo] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const { info: portal, loading: portalLoading } = usePortalInfo()

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/health`)
        .then((res) => res.json())
        .then((data) => setStatus(data.message)),
      fetch(`${API_BASE}/api/info`)
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
            <Descriptions.Item label="Название">
              <Text strong style={{ fontFamily: "'Syne', sans-serif", letterSpacing: '-0.02em' }}>
                {apiInfo.app}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Версия">
              <Tag color="purple" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                α-{apiInfo.version}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Описание">
              {apiInfo.description}
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ marginBottom: 12 }}>
            <Space>
              <RocketOutlined style={{ color: '#8b5cf6' }} />
              <Text strong>Возможности платформы</Text>
            </Space>
          </div>
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            WORKERPUNCH — инструмент командного учёта рабочего времени, интегрированный с Bitrix24.
            Позволяет получать детальную аналитику по задачам и проектам без выгрузки данных вручную.
          </Paragraph>
          <ul style={{ color: 'rgba(0,0,0,0.45)', paddingLeft: 20, margin: 0, lineHeight: '1.9' }}>
            <li>Сводка времязатрат по сотрудникам с детализацией до задачи</li>
            <li>Разбивка по проектам — три уровня глубины: проект → задача → исполнитель</li>
            <li>Тепловая карта нагрузки команды — выявляет переработки и простои</li>
            <li>Личный дашборд: прогресс к норме, топ задач, активность по дням</li>
          </ul>

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ marginBottom: 12 }}>
            <Space>
              <SafetyOutlined style={{ color: '#52c41a' }} />
              <Text strong>Технический стек</Text>
            </Space>
          </div>
          <Space size={[6, 6]} wrap>
            {['FastAPI', 'Python 3.12', 'PostgreSQL 16', 'SQLAlchemy 2', 'React 19', 'Ant Design 6', 'Vite 6', 'Docker', 'Nginx', 'Bitrix24 REST API'].map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </Space>
        </Card>
      )}
    </Spin>
  )
}
