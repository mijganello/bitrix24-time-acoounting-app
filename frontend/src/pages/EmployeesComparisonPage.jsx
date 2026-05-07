import { useState } from 'react'
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
  ClockCircleOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
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

const PROFILE_META = {
  stable: { color: 'green', label: 'Стабильная активность' },
  project_focused: { color: 'blue', label: 'Фокус на проектах' },
  risk_of_overload: { color: 'red', label: 'Риск перегрузки' },
  spot_activity: { color: 'gold', label: 'Точечная активность' },
}

function fmtHours(hours) {
  const whole = Math.floor(hours)
  const mins = Math.round((hours - whole) * 60)
  if (mins === 0) return `${whole} ч`
  return `${whole} ч ${mins} м`
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

export default function EmployeesComparisonPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')])
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
  const leader = employees[0]
  const avgScore = employees.length
    ? Math.round((employees.reduce((sum, employee) => sum + employee.score, 0) / employees.length) * 10) / 10
    : 0
  const overloadCount = employees.filter((employee) => employee.overtime_days > 0).length
  const maxScore = Math.max(leader?.score ?? 0, 1)

  const columns = [
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
      render: (name) => (
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
      ),
    },
    {
      title: 'Итоговый балл',
      dataIndex: 'score',
      key: 'score',
      width: 220,
      sorter: (a, b) => a.score - b.score,
      defaultSortOrder: 'descend',
      render: (score, row) => (
        <Tooltip title={<ScoreTooltip row={row} />}>
          <div>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ color: '#4361d8' }}>{score}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>из 100</Text>
            </div>
            <Progress
              percent={Math.round((score / maxScore) * 100)}
              showInfo={false}
              strokeColor="#4361d8"
              size={['100%', 6]}
            />
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Часы',
      dataIndex: 'hours_total',
      key: 'hours_total',
      width: 120,
      sorter: (a, b) => a.hours_total - b.hours_total,
      render: (hours) => <Text>{fmtHours(hours)}</Text>,
    },
    {
      title: 'Задачи',
      dataIndex: 'tasks_count',
      key: 'tasks_count',
      width: 90,
      sorter: (a, b) => a.tasks_count - b.tasks_count,
    },
    {
      title: 'Активные дни',
      dataIndex: 'active_days',
      key: 'active_days',
      width: 130,
      sorter: (a, b) => a.active_days - b.active_days,
      render: (days, row) => (
        <div>
          <Text>{days}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {Math.round((row.active_days_share ?? 0) * 100)}%
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Проектная доля',
      dataIndex: 'project_share_percent',
      key: 'project_share_percent',
      width: 140,
      sorter: (a, b) => a.project_share_percent - b.project_share_percent,
      render: (percent) => (
        <div>
          <Text>{percent}%</Text>
          <Progress percent={Math.round(percent)} showInfo={false} strokeColor="#52c41a" size={['100%', 4]} />
        </div>
      ),
    },
    {
      title: 'Переработки',
      dataIndex: 'overtime_days',
      key: 'overtime_days',
      width: 120,
      sorter: (a, b) => a.overtime_days - b.overtime_days,
      render: (value) => (
        <Text style={{ color: value > 0 ? '#cf1322' : '#8c8c8c' }}>
          {value}
        </Text>
      ),
    },
    {
      title: 'Профиль',
      dataIndex: 'profile',
      key: 'profile',
      width: 170,
      render: (profile) => {
        const meta = PROFILE_META[profile] ?? PROFILE_META.spot_activity
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
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
            { title: 'Сравнение сотрудников' },
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
              Сравнение сотрудников
            </Title>
            <Text type="secondary">
              Интегральный рейтинг сотрудников по нескольким простым математическим метрикам
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

        {data && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Лидер рейтинга"
                  value={leader?.user_name ?? '—'}
                  prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#d48806', fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Средний балл"
                  value={avgScore}
                  prefix={<ClockCircleOutlined style={{ color: '#4361d8' }} />}
                  valueStyle={{ color: '#4361d8', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="С риском перегрузки"
                  value={overloadCount}
                  prefix={<ThunderboltOutlined style={{ color: '#cf1322' }} />}
                  valueStyle={{ color: overloadCount > 0 ? '#cf1322' : undefined, fontSize: 22 }}
                />
              </Card>
            </Col>
          </Row>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={15}>
            <Card size="small" title="Рейтинг сотрудников">
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
                scroll={{ x: 1100 }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card size="small" title="Формула расчёта" style={{ marginBottom: 16 }}>
              <Paragraph style={{ marginBottom: 8 }}>
                Итоговый балл считается по формуле:
              </Paragraph>
              <div
                style={{
                  fontFamily: 'monospace',
                  background: 'rgba(67, 97, 216, 0.06)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  fontWeight: 600,
                }}
              >
                {data?.formula ?? '0.35*H + 0.25*T + 0.20*D + 0.20*P - 0.10*O'}
              </div>
              <Paragraph style={{ marginBottom: 6 }}>
                `H` — суммарные часы.
              </Paragraph>
              <Paragraph style={{ marginBottom: 6 }}>
                `T` — количество задач.
              </Paragraph>
              <Paragraph style={{ marginBottom: 6 }}>
                `D` — число активных дней.
              </Paragraph>
              <Paragraph style={{ marginBottom: 6 }}>
                `P` — доля времени по проектным задачам.
              </Paragraph>
              <Paragraph style={{ marginBottom: 0 }}>
                `O` — переработки, которые уменьшают итоговый балл.
              </Paragraph>
            </Card>

            <Card size="small" title="Как это интерпретировать">
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <div>
                  <Tag color="green">Стабильная активность</Tag>
                  <Text type="secondary">Регулярная работа в течение периода.</Text>
                </div>
                <div>
                  <Tag color="blue">Фокус на проектах</Tag>
                  <Text type="secondary">Основная часть времени уходит на проектные задачи.</Text>
                </div>
                <div>
                  <Tag color="red">Риск перегрузки</Tag>
                  <Text type="secondary">Есть заметные дни с переработкой более 8 часов.</Text>
                </div>
                <div>
                  <Tag color="gold">Точечная активность</Tag>
                  <Text type="secondary">Активность неравномерна или проявляется рывками.</Text>
                </div>
                <div style={{ paddingTop: 6 }}>
                  <Text type="secondary">
                    Нормализация метрик выполняется по схеме min-max, поэтому значения корректно сравниваются между собой.
                  </Text>
                </div>
                {data && (
                  <div style={{ paddingTop: 6 }}>
                    <Text type="secondary">
                      В отчёте учитывается период длиной {data.period_days} дн.
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        </Row>

        {!data && !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Выберите период и постройте рейтинг сотрудников"
            style={{ padding: 48 }}
          />
        )}

        {data && employees.length === 0 && !loading && (
          <Empty
            description="За выбранный период нет записей времени"
            style={{ padding: 48 }}
          />
        )}

        {data && employees.length > 0 && (
          <Card size="small">
            <Space size={24} wrap>
              <Text>
                <TeamOutlined style={{ color: '#4361d8', marginRight: 8 }} />
                Сотрудников в сравнении: {employees.length}
              </Text>
              <Text>
                <TrophyOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Лучший балл: {leader?.score ?? 0}
              </Text>
              <Text>
                <ThunderboltOutlined style={{ color: '#cf1322', marginRight: 8 }} />
                Переработки учитываются как штрафной коэффициент
              </Text>
            </Space>
          </Card>
        )}
      </div>
    </ConfigProvider>
  )
}
