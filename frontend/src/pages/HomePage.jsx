import { useEffect, useState } from 'react'
import {
  Typography, Card, Row, Col, Statistic, Select, Tag,
  Progress, Empty, Spin, Alert, Button, Divider, Tooltip, Space,
} from 'antd'
import {
  ClockCircleOutlined, TeamOutlined, ProjectOutlined,
  HeatMapOutlined, UserOutlined, ArrowRightOutlined,
  ThunderboltOutlined, CalendarOutlined, OrderedListOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { useAuth } from '../hooks/useAuth'
import { reportsService } from '../services/reportsService'

dayjs.locale('ru')

const { Title, Text } = Typography

const PERIOD_OPTIONS = [
  { label: 'Эта неделя', value: 'week' },
  { label: 'Этот месяц', value: 'month' },
]

function getPeriodRange(key) {
  if (key === 'week') return [dayjs().startOf('week'), dayjs().endOf('week')]
  return [dayjs().startOf('month'), dayjs().endOf('month')]
}

function workingDays(from, to) {
  let count = 0
  let cur = from.clone()
  while (cur.isBefore(to) || cur.isSame(to, 'day')) {
    const d = cur.day()
    if (d !== 0 && d !== 6) count++
    cur = cur.add(1, 'day')
  }
  return count
}

function fmtHours(h) {
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  if (mins === 0) return `${whole} ч`
  return `${whole} ч ${mins} м`
}

function greeting() {
  const h = dayjs().hour()
  if (h < 6)  return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 17) return 'Добрый день'
  return 'Добрый вечер'
}

const PROJECT_COLORS = [
  '#4361d8', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1',
  '#13c2c2', '#1890ff', '#faad14', '#f5222d', '#a0d911',
]

const REPORT_CARDS = [
  {
    key: 'users-summary',
    title: 'Сводка по пользователям',
    description: 'Кто сколько отработал за период с детализацией до задачи',
    icon: <TeamOutlined style={{ fontSize: 26, color: '#4361d8' }} />,
    path: '/reports/users-summary',
    color: 'rgba(67,97,216,0.09)',
  },
  {
    key: 'projects',
    title: 'По проектам',
    description: 'Дерево: проект → задача → исполнитель → часы',
    icon: <ProjectOutlined style={{ fontSize: 26, color: '#52c41a' }} />,
    path: '/reports/projects',
    color: 'rgba(82,196,26,0.09)',
  },
  {
    key: 'team-heatmap',
    title: 'Нагрузка команды',
    description: 'Матрица активности по дням — видны переработки и простои',
    icon: <HeatMapOutlined style={{ fontSize: 26, color: '#eb2f96' }} />,
    path: '/reports/team-heatmap',
    color: 'rgba(235,47,150,0.09)',
  },
  {
    key: 'my-dashboard',
    title: 'Личный дашборд',
    description: 'Персональная статистика: итоги, топ задач, разбивка по дням',
    icon: <UserOutlined style={{ fontSize: 26, color: '#722ed1' }} />,
    path: '/reports/my-dashboard',
    color: 'rgba(114,46,209,0.09)',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [period, setPeriod] = useState('week')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usersLoading, setUsersLoading] = useState(true)

  useEffect(() => {
    reportsService.getUsersList()
      .then((list) => {
        setUsers(list)
        if (list.length === 1) setSelectedUser(list[0].id)
      })
      .catch(() => {})
      .finally(() => setUsersLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedUser) return
    const [from, to] = getPeriodRange(period)
    setLoading(true)
    setError(null)
    reportsService.getMyDashboard({
      userId: selectedUser,
      dateFrom: from.format('YYYY-MM-DD'),
      dateTo: to.format('YYYY-MM-DD'),
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedUser, period])

  const [from, to] = getPeriodRange(period)
  const normHours = workingDays(from, to) * 8
  const totalHours = data?.total_hours ?? 0
  const normPercent = normHours > 0 ? Math.min(Math.round((totalHours / normHours) * 100), 100) : 0
  const normColor = normPercent >= 100 ? '#cf1322' : normPercent >= 70 ? '#389e0d' : '#faad14'
  const avgPerDay = data && workingDays(from, to) > 0
    ? Math.round((totalHours / workingDays(from, to)) * 10) / 10
    : 0
  const topProject = data?.by_project?.[0]?.project_name ?? '—'
  const taskCount = data?.top_tasks?.length ?? 0

  return (
    <div>
      {/* Приветствие */}
      <div style={{ marginBottom: 28 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
          {greeting()}{user ? `, ${user.username}` : ''} 👋
        </Title>
        <Text type="secondary">
          {dayjs().format('dddd, D MMMM YYYY')}
        </Text>
      </div>

      {/* Фильтры */}
      <Card style={{ marginBottom: 20 }} styles={{ body: { padding: '14px 20px' } }}>
        <Row gutter={16} align="middle" wrap>
          <Col>
            <Text type="secondary" style={{ marginRight: 8, fontSize: 13 }}>Сотрудник:</Text>
            <Select
              style={{ width: 220 }}
              placeholder={usersLoading ? 'Загрузка...' : 'Выберите сотрудника'}
              loading={usersLoading}
              value={selectedUser}
              onChange={setSelectedUser}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              showSearch
              filterOption={(input, opt) =>
                opt.label.toLowerCase().includes(input.toLowerCase())
              }
              virtual={false}
            />
          </Col>
          <Col>
            <Text type="secondary" style={{ marginRight: 8, fontSize: 13 }}>Период:</Text>
            <Select
              style={{ width: 150 }}
              value={period}
              onChange={setPeriod}
              options={PERIOD_OPTIONS}
            />
          </Col>
          {!selectedUser && !usersLoading && (
            <Col>
              <Text type="secondary" style={{ fontSize: 12, color: '#faad14' }}>
                ⚠ Выберите сотрудника для отображения статистики
              </Text>
            </Col>
          )}
        </Row>
      </Card>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 20 }} />
      )}

      {/* Статистика */}
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
            <Card styles={{ body: { padding: '20px 24px' } }} style={{ flex: 1 }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>Отработано</Text>}
                value={fmtHours(totalHours)}
                prefix={<ClockCircleOutlined style={{ color: '#4361d8', marginRight: 4 }} />}
                valueStyle={{ fontSize: 22, color: '#4361d8', fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
            <Card styles={{ body: { padding: '20px 24px' } }} style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                Выполнение нормы
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Progress
                  type="circle"
                  percent={normPercent}
                  size={54}
                  strokeColor={normColor}
                  strokeWidth={9}
                  format={(p) => <span style={{ fontSize: 12, fontWeight: 700, color: normColor }}>{p}%</span>}
                />
                <div>
                  <Text strong style={{ fontSize: 16, color: normColor }}>{normPercent}%</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>из {fmtHours(normHours)}</Text>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
            <Card styles={{ body: { padding: '20px 24px' } }} style={{ flex: 1 }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>Задач в периоде</Text>}
                value={taskCount}
                prefix={<OrderedListOutlined style={{ color: '#52c41a', marginRight: 4 }} />}
                valueStyle={{ fontSize: 22, color: '#52c41a', fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} style={{ display: 'flex' }}>
            <Card styles={{ body: { padding: '20px 24px' } }} style={{ flex: 1 }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>Среднее в день</Text>}
                value={avgPerDay > 0 ? fmtHours(avgPerDay) : '—'}
                prefix={<CalendarOutlined style={{ color: '#fa8c16', marginRight: 4 }} />}
                valueStyle={{ fontSize: 22, color: '#fa8c16', fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Топ задач + По проектам */}
        {selectedUser && (
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} md={14}>
              <Card
                title={
                  <Space>
                    <ThunderboltOutlined style={{ color: '#4361d8' }} />
                    <span>Топ задач</span>
                  </Space>
                }
                styles={{ body: { padding: '16px 20px' } }}
              >
                {data?.top_tasks?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.top_tasks.slice(0, 7).map((t, i) => {
                      const max = data.top_tasks[0]?.hours ?? 1
                      return (
                        <div key={t.task_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              minWidth: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              background: i === 0 ? '#faad14' : i === 1 ? '#bfbfbf' : i === 2 ? '#d4915a' : '#f0f0f0',
                              color: i < 3 ? '#fff' : '#999',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: 10,
                            }}
                          >
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Tooltip title={t.task_title}>
                              <Text
                                style={{
                                  fontSize: 13, display: 'block',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                              >
                                {t.task_title}
                              </Text>
                            </Tooltip>
                            <Progress
                              percent={Math.round((t.hours / max) * 100)}
                              showInfo={false}
                              strokeColor="#4361d8"
                              trailColor="#f0f0f0"
                              strokeWidth={5}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <Text strong style={{ fontSize: 13, color: '#4361d8', minWidth: 50, textAlign: 'right' }}>
                            {fmtHours(t.hours)}
                          </Text>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <Empty description="Нет данных" style={{ padding: 24 }} />
                )}
              </Card>
            </Col>
            <Col xs={24} md={10}>
              <Card
                title={
                  <Space>
                    <ProjectOutlined style={{ color: '#52c41a' }} />
                    <span>По проектам</span>
                  </Space>
                }
                styles={{ body: { padding: '16px 20px' } }}
              >
                {data?.by_project?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {data.by_project.slice(0, 6).map((p, i) => (
                      <div key={p.project_id ?? 'no'}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12 }} ellipsis>
                            {p.project_id
                              ? <Tag color="blue" style={{ marginRight: 4, fontSize: 10 }}>проект</Tag>
                              : <Tag color="orange" style={{ marginRight: 4, fontSize: 10 }}>без проекта</Tag>
                            }
                            {p.project_name}
                          </Text>
                          <Text strong style={{ fontSize: 12, color: PROJECT_COLORS[i % PROJECT_COLORS.length], whiteSpace: 'nowrap', marginLeft: 8 }}>
                            {fmtHours(p.hours)}
                          </Text>
                        </div>
                        <Progress
                          percent={data.by_project[0]?.hours > 0 ? Math.round((p.hours / data.by_project[0].hours) * 100) : 0}
                          showInfo={false}
                          strokeColor={PROJECT_COLORS[i % PROJECT_COLORS.length]}
                          trailColor="#f0f0f0"
                          strokeWidth={7}
                          style={{ margin: 0 }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="Нет данных" style={{ padding: 24 }} />
                )}
              </Card>
            </Col>
          </Row>
        )}
      </Spin>

      {/* Быстрые ссылки на отчёты */}
      <Divider style={{ margin: '8px 0 20px' }}>
        <Text type="secondary" style={{ fontSize: 13 }}>Отчёты</Text>
      </Divider>
      <Row gutter={[16, 16]}>
        {REPORT_CARDS.map((r) => (
          <Col key={r.key} xs={24} sm={12} md={12} xl={6} style={{ display: 'flex' }}>
            <Card
              hoverable
              onClick={() => navigate(r.path)}
              styles={{ body: { padding: '18px 20px' } }}
              style={{ flex: 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: r.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {r.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text strong style={{ fontSize: 14 }}>{r.title}</Text>
                    <ArrowRightOutlined style={{ color: '#bbb', marginLeft: 8, marginTop: 3, flexShrink: 0 }} />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: '1.5' }}>
                    {r.description}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}

