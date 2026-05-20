import { Card, Col, Row, Tag, Typography, Button } from 'antd'
import {
  TeamOutlined,
  ProjectOutlined,
  HeatMapOutlined,
  UserOutlined,
  TrophyOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

const REPORTS = [
  {
    key: 'users-summary',
    title: 'Сводка по сотрудникам',
    description:
      'Кто сколько времени потратил за выбранный период. Разбивка на задачи с проектом и без проекта.',
    icon: <TeamOutlined style={{ fontSize: 28, color: '#4361d8' }} />,
    tags: ['сотрудники', 'период'],
    path: '/reports/users-summary',
  },
  {
    key: 'projects',
    title: 'Детализация по проектам',
    description:
      'Дерево: проект -> задача -> сотрудник -> часы. Задачи без проекта выделены в отдельную группу.',
    icon: <ProjectOutlined style={{ fontSize: 28, color: '#4361d8' }} />,
    tags: ['проекты', 'задачи', 'часы'],
    path: '/reports/projects',
  },
  {
    key: 'employees-comparison',
    title: 'KPI-метрики',
    description:
      'Подотчеты с простыми KPI: оплачиваемые смены по правилу 5 часов, проектный фокус и регулярность работы.',
    icon: <TrophyOutlined style={{ fontSize: 28, color: '#4361d8' }} />,
    tags: ['KPI', 'метрики', 'подотчеты'],
    path: '/reports/employees-comparison',
  },
  {
    key: 'team-heatmap',
    title: 'Нагрузка команды',
    description:
      'Матрица нагрузки по дням: помогает увидеть пики переработок и периоды простоя.',
    icon: <HeatMapOutlined style={{ fontSize: 28, color: '#4361d8' }} />,
    tags: ['команда', 'дни', 'нагрузка'],
    path: '/reports/team-heatmap',
  },
  {
    key: 'my-dashboard',
    title: 'Личный дашборд',
    description:
      'Персональный отчёт сотрудника: итоговые часы, топ задач, разбивка по проектам и активность по дням.',
    icon: <UserOutlined style={{ fontSize: 28, color: '#4361d8' }} />,
    tags: ['личное', 'задачи', 'проекты'],
    path: '/reports/my-dashboard',
  },
]

export default function ReportsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canViewTeam = ['manager', 'admin'].includes(user?.role)
  const reports = canViewTeam ? REPORTS : REPORTS.filter((report) => report.key === 'my-dashboard')

  return (
    <div>
      <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
        Отчёты
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 32 }}>
        Аналитика по времязатратам на основе задач и проектов Bitrix24
      </Text>

      <Row gutter={[20, 20]}>
        {reports.map((report) => (
          <Col key={report.key} xs={24} sm={24} md={12} xl={12} xxl={8}>
            <Card
              hoverable
              style={{ height: '100%' }}
              styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%' } }}
              onClick={() => navigate(report.path)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flex: 1 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: 'rgba(67, 97, 216, 0.09)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {report.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <Title level={5} style={{ margin: '0 0 6px' }}>
                    {report.title}
                  </Title>
                  <Paragraph
                    type="secondary"
                    style={{ margin: '0 0 12px', fontSize: 13, lineHeight: '1.6' }}
                  >
                    {report.description}
                  </Paragraph>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {report.tags.map((tag) => (
                      <Tag key={tag} color="blue" style={{ margin: 0, borderRadius: 6 }}>
                        {tag}
                      </Tag>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="link"
                  size="small"
                  icon={<ArrowRightOutlined />}
                  iconPosition="end"
                  style={{ color: '#4361d8', padding: 0 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(report.path)
                  }}
                >
                  Открыть отчёт
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
