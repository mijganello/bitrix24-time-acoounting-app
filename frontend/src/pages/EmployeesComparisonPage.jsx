import { useMemo, useState } from 'react'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import locale from 'antd/locale/ru_RU'
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ProjectOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { reportsService } from '../services/reportsService'

dayjs.locale('ru')

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker

const PRESETS = [
  { label: 'Эта неделя', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
  { label: 'Прошлая неделя', value: [dayjs().subtract(1, 'week').startOf('week'), dayjs().subtract(1, 'week').endOf('week')] },
  { label: 'Этот месяц', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: 'Прошлый месяц', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
]

const METRICS = [
  {
    key: 'paid-shifts',
    title: 'Оплачиваемые смены',
    short: 'Норма 5 часов',
    description: 'Показывает, в какие активные дни сотрудник набрал минимум 5 часов в задачах.',
    formula: 'оплачиваемые дни / активные дни * 100%',
    icon: <CheckCircleOutlined />,
    color: '#389e0d',
  },
  {
    key: 'project-focus',
    title: 'Проектный фокус',
    short: 'Доля проектной работы',
    description: 'Считает, какая часть времени сотрудника ушла на задачи, привязанные к проектам.',
    formula: 'часы в проектах / все часы * 100%',
    icon: <ProjectOutlined />,
    color: '#4361d8',
  },
  {
    key: 'work-rhythm',
    title: 'Ритм работы',
    short: 'Регулярность активности',
    description: 'Оценивает, насколько равномерно сотрудник отмечал время в выбранном периоде.',
    formula: 'активные дни / дни периода * 100%',
    icon: <BarChartOutlined />,
    color: '#d48806',
  },
]

const PROFILE_META = {
  stable: { color: 'green', label: 'Стабильная активность' },
  project_focused: { color: 'blue', label: 'Фокус на проектах' },
  risk_of_overload: { color: 'red', label: 'Риск перегрузки' },
  spot_activity: { color: 'gold', label: 'Точечная активность' },
}

function fmtHours(hours = 0) {
  const whole = Math.floor(hours)
  const mins = Math.round((hours - whole) * 60)
  if (mins === 0) return `${whole} ч`
  return `${whole} ч ${mins} м`
}

function MetricCard({ metric, active, onClick }) {
  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        height: '100%',
        borderColor: active ? metric.color : undefined,
        boxShadow: active ? `0 0 0 1px ${metric.color}22` : undefined,
      }}
      styles={{ body: { height: '100%' } }}
    >
      <Space align="start" size={14}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${metric.color}14`,
            color: metric.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {metric.icon}
        </div>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            {metric.title}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {metric.short}
          </Text>
          <Paragraph style={{ margin: '10px 0 0', fontSize: 13 }}>
            {metric.description}
          </Paragraph>
        </div>
      </Space>
    </Card>
  )
}

function ScoreTooltip({ row }) {
  const normalized = row.normalized ?? {}

  return (
    <div style={{ minWidth: 220 }}>
      <Text strong style={{ color: '#fff' }}>
        Нормализованные метрики
      </Text>
      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
        <Text style={{ color: '#fff' }}>H: часы = {normalized.hours ?? 0}</Text>
        <Text style={{ color: '#fff' }}>T: задачи = {normalized.tasks ?? 0}</Text>
        <Text style={{ color: '#fff' }}>D: активные дни = {normalized.active_days ?? 0}</Text>
        <Text style={{ color: '#fff' }}>P: проектная доля = {normalized.project_share ?? 0}</Text>
        <Text style={{ color: '#fff' }}>O: переработки = {normalized.overtime ?? 0}</Text>
      </div>
    </div>
  )
}

function EmployeeCell({ name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'rgba(67, 97, 216, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#4361d8',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {name?.[0] ?? '?'}
      </div>
      <Text strong>{name}</Text>
    </div>
  )
}

export default function EmployeesComparisonPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')])
  const [activeMetric, setActiveMetric] = useState('paid-shifts')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSearch() {
    if (!range?.[0] || !range?.[1]) return
    setLoading(true)
    setError(null)

    try {
      const result = await reportsService.getEmployeesComparison({
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

  const employees = data?.employees ?? []
  const metric = METRICS.find((item) => item.key === activeMetric) ?? METRICS[0]

  const summary = useMemo(() => {
    if (!employees.length) {
      return { first: 0, second: 0, third: 0, leader: '—' }
    }

    if (activeMetric === 'paid-shifts') {
      const paidDays = employees.reduce((sum, row) => sum + (row.paid_shift_days ?? 0), 0)
      const activeDays = employees.reduce((sum, row) => sum + (row.active_days ?? 0), 0)
      const avg = activeDays ? Math.round((paidDays / activeDays) * 1000) / 10 : 0
      const leader = [...employees].sort((a, b) => (b.paid_shift_percent ?? 0) - (a.paid_shift_percent ?? 0))[0]
      return { first: `${avg}%`, second: paidDays, third: data?.paid_shift_threshold_hours ?? 5, leader: leader?.user_name ?? '—' }
    }

    if (activeMetric === 'project-focus') {
      const avg = Math.round((employees.reduce((sum, row) => sum + (row.project_share_percent ?? 0), 0) / employees.length) * 10) / 10
      const leader = [...employees].sort((a, b) => (b.project_share_percent ?? 0) - (a.project_share_percent ?? 0))[0]
      const focusedCount = employees.filter((row) => (row.project_share_percent ?? 0) >= 70).length
      return { first: `${avg}%`, second: focusedCount, third: employees.length, leader: leader?.user_name ?? '—' }
    }

    const avg = Math.round((employees.reduce((sum, row) => sum + (row.work_rhythm_percent ?? 0), 0) / employees.length) * 10) / 10
    const leader = [...employees].sort((a, b) => (b.work_rhythm_percent ?? 0) - (a.work_rhythm_percent ?? 0))[0]
    const stableCount = employees.filter((row) => (row.work_rhythm_percent ?? 0) >= 60).length
    return { first: `${avg}%`, second: stableCount, third: data?.period_days ?? 0, leader: leader?.user_name ?? '—' }
  }, [activeMetric, data, employees])

  const columns = useMemo(() => {
    const base = [
      {
        title: 'Сотрудник',
        dataIndex: 'user_name',
        key: 'user_name',
        render: (name) => <EmployeeCell name={name} />,
      },
    ]

    if (activeMetric === 'paid-shifts') {
      return [
        ...base,
        {
          title: 'Оплачиваемые дни',
          dataIndex: 'paid_shift_days',
          key: 'paid_shift_days',
          width: 170,
          sorter: (a, b) => (a.paid_shift_days ?? 0) - (b.paid_shift_days ?? 0),
          defaultSortOrder: 'descend',
          render: (value, row) => <Text strong>{value ?? 0} из {row.active_days ?? 0}</Text>,
        },
        {
          title: 'Выполнение нормы',
          dataIndex: 'paid_shift_percent',
          key: 'paid_shift_percent',
          width: 220,
          sorter: (a, b) => (a.paid_shift_percent ?? 0) - (b.paid_shift_percent ?? 0),
          render: (percent = 0) => (
            <div>
              <Text style={{ color: percent >= 80 ? '#389e0d' : percent >= 50 ? '#d48806' : '#cf1322' }}>
                {percent}%
              </Text>
              <Progress percent={Math.round(percent)} showInfo={false} strokeColor={percent >= 80 ? '#52c41a' : percent >= 50 ? '#faad14' : '#ff4d4f'} size={['100%', 5]} />
            </div>
          ),
        },
        {
          title: 'Среднее за активный день',
          dataIndex: 'average_hours_per_active_day',
          key: 'average_hours_per_active_day',
          width: 190,
          sorter: (a, b) => (a.average_hours_per_active_day ?? 0) - (b.average_hours_per_active_day ?? 0),
          render: (hours) => fmtHours(hours),
        },
      ]
    }

    if (activeMetric === 'project-focus') {
      return [
        ...base,
        {
          title: 'Проектная доля',
          dataIndex: 'project_share_percent',
          key: 'project_share_percent',
          width: 210,
          sorter: (a, b) => (a.project_share_percent ?? 0) - (b.project_share_percent ?? 0),
          defaultSortOrder: 'descend',
          render: (percent = 0) => (
            <div>
              <Text>{percent}%</Text>
              <Progress percent={Math.round(percent)} showInfo={false} strokeColor="#4361d8" size={['100%', 5]} />
            </div>
          ),
        },
        {
          title: 'Всего часов',
          dataIndex: 'hours_total',
          key: 'hours_total',
          width: 130,
          sorter: (a, b) => a.hours_total - b.hours_total,
          render: (hours) => fmtHours(hours),
        },
        {
          title: 'Профиль',
          dataIndex: 'profile',
          key: 'profile',
          width: 180,
          render: (profile) => {
            const meta = PROFILE_META[profile] ?? PROFILE_META.spot_activity
            return <Tag color={meta.color}>{meta.label}</Tag>
          },
        },
      ]
    }

    return [
      ...base,
      {
        title: 'Активные дни',
        dataIndex: 'active_days',
        key: 'active_days',
        width: 150,
        sorter: (a, b) => a.active_days - b.active_days,
        defaultSortOrder: 'descend',
        render: (days, row) => <Text strong>{days} из {data?.period_days ?? 0}</Text>,
      },
      {
        title: 'Ритм',
        dataIndex: 'work_rhythm_percent',
        key: 'work_rhythm_percent',
        width: 210,
        sorter: (a, b) => (a.work_rhythm_percent ?? 0) - (b.work_rhythm_percent ?? 0),
        render: (percent = 0) => (
          <div>
            <Text style={{ color: percent >= 60 ? '#389e0d' : percent >= 30 ? '#d48806' : '#cf1322' }}>
              {percent}%
            </Text>
            <Progress percent={Math.round(percent)} showInfo={false} strokeColor={percent >= 60 ? '#52c41a' : percent >= 30 ? '#faad14' : '#ff4d4f'} size={['100%', 5]} />
          </div>
        ),
      },
      {
        title: 'Задачи',
        dataIndex: 'tasks_count',
        key: 'tasks_count',
        width: 110,
        sorter: (a, b) => a.tasks_count - b.tasks_count,
      },
    ]
  }, [activeMetric, data?.period_days])

  const ratingColumns = [
    {
      title: 'Место',
      dataIndex: 'rank',
      key: 'rank',
      width: 72,
      render: (rank) => <Text strong style={{ color: '#4361d8' }}>#{rank}</Text>,
    },
    {
      title: 'Сотрудник',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (name) => <EmployeeCell name={name} />,
    },
    {
      title: 'Итоговый балл',
      dataIndex: 'score',
      key: 'score',
      width: 220,
      render: (score, row) => (
        <Tooltip title={<ScoreTooltip row={row} />}>
          <div>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ color: '#4361d8' }}>{score}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>из 100</Text>
            </div>
            <Progress percent={Math.round(score)} showInfo={false} strokeColor="#4361d8" size={['100%', 6]} />
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Часы',
      dataIndex: 'hours_total',
      key: 'hours_total',
      width: 120,
      render: (hours) => fmtHours(hours),
    },
  ]

  return (
    <ConfigProvider locale={locale}>
      <div>
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
            { title: 'KPI-метрики' },
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
              KPI-метрики
            </Title>
            <Text type="secondary">
              Набор простых показателей для оценки рабочего времени, проектного фокуса и регулярности
            </Text>
          </div>
        </div>

        <Card style={{ marginBottom: 24 }} size="small">
          <Space size={12} wrap>
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
            >
              Показать
            </Button>
          </Space>
        </Card>

        {error && (
          <Alert type="error" message={error} style={{ marginBottom: 20 }} showIcon />
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {METRICS.map((item) => (
            <Col key={item.key} xs={24} lg={8}>
              <MetricCard
                metric={item}
                active={activeMetric === item.key}
                onClick={() => setActiveMetric(item.key)}
              />
            </Col>
          ))}
        </Row>

        {data && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title={activeMetric === 'paid-shifts' ? 'Среднее выполнение' : activeMetric === 'project-focus' ? 'Средняя доля' : 'Средний ритм'}
                  value={summary.first}
                  prefix={<ClockCircleOutlined style={{ color: metric.color }} />}
                  valueStyle={{ color: metric.color, fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title={activeMetric === 'paid-shifts' ? 'Оплачиваемых дней' : activeMetric === 'project-focus' ? 'С фокусом от 70%' : 'Стабильных от 60%'}
                  value={summary.second}
                  suffix={activeMetric === 'paid-shifts' ? undefined : `из ${summary.third}`}
                  prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#389e0d', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Лидер метрики"
                  value={summary.leader}
                  prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#d48806', fontSize: 20 }}
                />
              </Card>
            </Col>
          </Row>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card size="small" title={metric.title}>
              <Table
                dataSource={employees}
                columns={columns}
                rowKey="user_id"
                loading={loading}
                pagination={false}
                locale={{
                  emptyText: data
                    ? 'Нет данных за выбранный период'
                    : 'Выберите период и нажмите «Показать»',
                }}
                scroll={{ x: 780 }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card size="small" title="Что считает метрика" style={{ marginBottom: 16 }}>
              <Paragraph style={{ marginBottom: 12 }}>{metric.description}</Paragraph>
              <div
                style={{
                  fontFamily: 'monospace',
                  background: `${metric.color}12`,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  fontWeight: 600,
                }}
              >
                {metric.formula}
              </div>
              {activeMetric === 'paid-shifts' && (
                <Text type="secondary">
                  День считается оплачиваемым, если в задачах зафиксировано не менее {data?.paid_shift_threshold_hours ?? 5} часов.
                </Text>
              )}
              {activeMetric === 'project-focus' && (
                <Text type="secondary">
                  70% и выше означает, что большая часть времени идет в проектную работу.
                </Text>
              )}
              {activeMetric === 'work-rhythm' && (
                <Text type="secondary">
                  Метрика не оценивает качество задач, а показывает регулярность ведения времени в выбранном периоде.
                </Text>
              )}
            </Card>

            <Card size="small" title="Итоговый рейтинг">
              <Table
                dataSource={employees}
                columns={ratingColumns}
                rowKey="user_id"
                loading={loading}
                pagination={false}
                size="small"
                locale={{ emptyText: 'Нет данных' }}
                scroll={{ x: 520 }}
              />
            </Card>
          </Col>
        </Row>

        {!data && !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Выберите период, нажмите «Показать» и откройте нужную KPI-метрику"
            style={{ padding: 48 }}
          />
        )}
      </div>
    </ConfigProvider>
  )
}
