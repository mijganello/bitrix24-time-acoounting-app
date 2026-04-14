import { useState, useEffect } from 'react'
import {
  Typography,
  DatePicker,
  Button,
  Card,
  Alert,
  Space,
  Statistic,
  Breadcrumb,
  Select,
  Progress,
  Tag,
  Empty,
  Tooltip,
  Row,
  Col,
  Divider,
} from 'antd'
import {
  SearchOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  TrophyOutlined,
  CalendarOutlined,
  ProjectOutlined,
  OrderedListOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import locale from 'antd/locale/ru_RU'
import { ConfigProvider } from 'antd'
import { reportsService } from '../services/reportsService'

dayjs.locale('ru')

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const PRESETS = [
  { label: 'Эта неделя', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
  { label: 'Прошлая неделя', value: [dayjs().subtract(1, 'week').startOf('week'), dayjs().subtract(1, 'week').endOf('week')] },
  { label: 'Этот месяц', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: 'Прошлый месяц', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
]

function fmtHours(h) {
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  if (mins === 0) return `${whole} ч`
  return `${whole} ч ${mins} м`
}

/** Считает кол-во рабочих дней (пн–пт) в диапазоне дат */
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

const PROJECT_COLORS = [
  '#4361d8', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1',
  '#13c2c2', '#1890ff', '#faad14', '#f5222d', '#a0d911',
]

const DAY_LEVEL_CONFIG = {
  idle:     { bg: '#f0f0f0', color: '#bbb',   border: '#e0e0e0' },
  low:      { bg: '#fff7e6', color: '#d46b08', border: '#ffd591' },
  normal:   { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
  overtime: { bg: '#fff1f0', color: '#cf1322', border: '#ffa39e' },
}

function dayLevel(hours) {
  if (hours === 0) return 'idle'
  if (hours < 4) return 'low'
  if (hours <= 8) return 'normal'
  return 'overtime'
}

function ActivityGrid({ byDate, dateFrom, dateTo }) {
  if (!byDate?.length) return <Empty description="Нет данных" style={{ padding: 24 }} />

  // Генерируем все даты в диапазоне
  const dateMap = Object.fromEntries(byDate.map((d) => [d.date, d]))
  const all = []
  let cur = dateFrom.clone()
  while (cur.isBefore(dateTo) || cur.isSame(dateTo, 'day')) {
    all.push(cur.format('YYYY-MM-DD'))
    cur = cur.add(1, 'day')
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {all.map((d) => {
        const entry = dateMap[d]
        const hours = entry ? entry.hours : 0
        const level = dayLevel(hours)
        const cfg = DAY_LEVEL_CONFIG[level]
        const dt = dayjs(d)
        const isWeekend = dt.day() === 0 || dt.day() === 6
        return (
          <Tooltip
            key={d}
            title={
              <span>
                {dt.format('D MMMM')} ({['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][dt.day()]})<br />
                {hours > 0 ? fmtHours(hours) : 'нет данных'}
              </span>
            }
            mouseEnterDelay={0.1}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: isWeekend && level === 'idle' ? '#f8f8f8' : cfg.bg,
                border: `1px solid ${isWeekend && level === 'idle' ? '#efefef' : cfg.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
                opacity: isWeekend && level === 'idle' ? 0.45 : 1,
                fontSize: 10,
                fontWeight: 600,
                color: cfg.color,
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {dt.format('D')}
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

function ProjectBars({ byProject }) {
  if (!byProject?.length) return <Empty description="Нет данных" style={{ padding: 24 }} />
  const max = byProject[0]?.hours ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {byProject.map((p, i) => (
        <div key={p.project_id ?? 'no'}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 13 }}>
              {p.project_id ? (
                <Tag color="blue" style={{ marginRight: 6, fontSize: 11 }}>проект</Tag>
              ) : (
                <Tag color="orange" style={{ marginRight: 6, fontSize: 11 }}>без проекта</Tag>
              )}
              {p.project_name}
            </Text>
            <Space size={8}>
              <Text strong style={{ fontSize: 13, color: PROJECT_COLORS[i % PROJECT_COLORS.length] }}>
                {fmtHours(p.hours)}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {p.percent}%
              </Text>
            </Space>
          </div>
          <Progress
            percent={max > 0 ? Math.round((p.hours / max) * 100) : 0}
            showInfo={false}
            strokeColor={PROJECT_COLORS[i % PROJECT_COLORS.length]}
            trailColor="#f0f0f0"
            strokeWidth={8}
            style={{ margin: 0 }}
          />
        </div>
      ))}
    </div>
  )
}

function TopTasks({ tasks }) {
  if (!tasks?.length) return <Empty description="Нет задач" style={{ padding: 24 }} />
  const max = tasks[0]?.hours ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tasks.map((t, i) => (
        <div key={t.task_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              minWidth: 24,
              height: 24,
              borderRadius: '50%',
              background: i === 0 ? '#faad14' : i === 1 ? '#bfbfbf' : i === 2 ? '#d4915a' : '#f0f0f0',
              color: i < 3 ? '#fff' : '#999',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={t.task_title}
            >
              {t.task_title}
            </Text>
            <Progress
              percent={max > 0 ? Math.round((t.hours / max) * 100) : 0}
              showInfo={false}
              strokeColor="#4361d8"
              trailColor="#f0f0f0"
              strokeWidth={5}
              style={{ margin: 0 }}
            />
          </div>
          <Text strong style={{ fontSize: 13, color: '#4361d8', whiteSpace: 'nowrap', minWidth: 52, textAlign: 'right' }}>
            {fmtHours(t.hours)}
          </Text>
        </div>
      ))}
    </div>
  )
}

export default function MyDashboardPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Загрузить список пользователей при маунте
  useEffect(() => {
    reportsService.getUsersList().then((list) => {
      setUsers(list)
      if (list.length > 0) setSelectedUser(list[0].id)
    }).catch(() => {})
  }, [])

  async function handleSearch() {
    if (!selectedUser || !range?.[0] || !range?.[1]) return
    setLoading(true)
    setError(null)
    try {
      const result = await reportsService.getMyDashboard({
        userId: selectedUser,
        dateFrom: range[0].format('YYYY-MM-DD'),
        dateTo: range[1].format('YYYY-MM-DD'),
      })
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Считаем норму часов (8ч × рабочие дни в периоде)
  const normHours = range?.[0] && range?.[1] ? workingDays(range[0], range[1]) * 8 : 0
  const totalHours = data?.total_hours ?? 0
  const normPercent = normHours > 0 ? Math.min(Math.round((totalHours / normHours) * 100), 100) : 0
  const avgHoursPerDay =
    range?.[0] && range?.[1] && data
      ? Math.round((totalHours / Math.max(workingDays(range[0], range[1]), 1)) * 10) / 10
      : 0

  const normColor = normPercent >= 100 ? '#cf1322' : normPercent >= 70 ? '#389e0d' : '#faad14'

  return (
    <ConfigProvider locale={locale}>
      <div>
        {/* Хлебные крошки */}
        <Breadcrumb
          style={{ marginBottom: 20 }}
          items={[
            {
              title: (
                <span
                  style={{ cursor: 'pointer', color: '#4361d8' }}
                  onClick={() => navigate('/reports')}
                >
                  Отчёты
                </span>
              ),
            },
            { title: 'Мои времязатраты' },
          ]}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/reports')}
            style={{ color: '#4361d8' }}
          />
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Личный дашборд
            </Title>
            <Text type="secondary">
              Самоконтроль: активность, задачи и разбивка по проектам за период
            </Text>
          </div>
        </div>

        {/* Фильтры */}
        <Card style={{ marginBottom: 24 }} size="small">
          <Space size={12} wrap>
            <Text type="secondary">Сотрудник:</Text>
            <Select
              value={selectedUser}
              onChange={setSelectedUser}
              style={{ minWidth: 200 }}
              placeholder="Выберите сотрудника"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              loading={users.length === 0}
              virtual={false}
            />
            <Text type="secondary">Период:</Text>
            <RangePicker
              value={range}
              onChange={setRange}
              format="DD.MM.YYYY"
              presets={PRESETS}
              allowClear={false}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
              disabled={!selectedUser}
            >
              Показать
            </Button>
          </Space>
        </Card>

        {error && (
          <Alert type="error" message={error} style={{ marginBottom: 20 }} showIcon />
        )}

        {/* Stat-карточки */}
        {data && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title={`Всего часов (${data.user_name})`}
                  value={fmtHours(totalHours)}
                  prefix={<ClockCircleOutlined style={{ color: '#4361d8' }} />}
                  valueStyle={{ color: '#4361d8', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Среднее в день (рабочие)"
                  value={`${avgHoursPerDay} ч`}
                  prefix={<CalendarOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#389e0d', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Задач выполнено"
                  value={data.top_tasks?.length ?? 0}
                  prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#d46b08', fontSize: 22 }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Прогресс к норме */}
        {data && normHours > 0 && (
          <Card size="small" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text strong>Прогресс к норме</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {fmtHours(totalHours)} / {normHours} ч норма
              </Text>
            </div>
            <Progress
              percent={normPercent}
              strokeColor={normColor}
              trailColor="#f0f0f0"
              format={(p) => (
                <span style={{ color: normColor, fontWeight: 600 }}>{p}%</span>
              )}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {workingDays(range[0], range[1])} рабочих дней в периоде × 8 ч/день
            </Text>
          </Card>
        )}

        {loading && <Card loading style={{ borderRadius: 10, marginBottom: 24 }} />}

        {!loading && data && (
          <Row gutter={[16, 24]}>
            {/* Топ задач */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <OrderedListOutlined style={{ color: '#4361d8' }} />
                    <span>Топ задач по времени</span>
                  </Space>
                }
                size="small"
              >
                <TopTasks tasks={data.top_tasks} />
              </Card>
            </Col>

            {/* По проектам */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <ProjectOutlined style={{ color: '#52c41a' }} />
                    <span>По проектам</span>
                  </Space>
                }
                size="small"
              >
                <ProjectBars byProject={data.by_project} />
              </Card>
            </Col>

            {/* Активность по дням */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <CalendarOutlined style={{ color: '#fa8c16' }} />
                    <span>Активность по дням</span>
                  </Space>
                }
                size="small"
              >
                <ActivityGrid
                  byDate={data.by_date}
                  dateFrom={range[0]}
                  dateTo={range[1]}
                />
                <Divider style={{ margin: '12px 0 8px' }} />
                <Space size={16} style={{ flexWrap: 'wrap' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Нагрузка:</Text>
                  {[
                    { label: '0 ч', bg: '#f0f0f0', border: '#e0e0e0', color: '#bbb' },
                    { label: '< 4 ч', bg: '#fff7e6', border: '#ffd591', color: '#d46b08' },
                    { label: '4–8 ч', bg: '#f6ffed', border: '#b7eb8f', color: '#389e0d' },
                    { label: '> 8 ч', bg: '#fff1f0', border: '#ffa39e', color: '#cf1322' },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          background: item.bg,
                          border: `1px solid ${item.border}`,
                        }}
                      />
                      <Text style={{ fontSize: 12, color: item.color }}>{item.label}</Text>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>
        )}

        {!data && !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Выберите сотрудника и период, затем нажмите «Показать»"
            style={{ padding: 60 }}
          />
        )}
      </div>
    </ConfigProvider>
  )
}
