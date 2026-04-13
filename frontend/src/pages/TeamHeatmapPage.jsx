import { useState } from 'react'
import {
  Typography,
  DatePicker,
  Button,
  Card,
  Alert,
  Space,
  Statistic,
  Breadcrumb,
  Tooltip,
  Row,
  Col,
  Empty,
} from 'antd'
import {
  SearchOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  TeamOutlined,
  ThunderboltOutlined,
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

const LEVEL_CONFIG = {
  idle:     { bg: '#f0f0f0', color: '#bbb',    label: '0 ч',     border: '#e0e0e0' },
  low:      { bg: '#fff7e6', color: '#d46b08',  label: '< 4 ч',   border: '#ffd591' },
  normal:   { bg: '#f6ffed', color: '#389e0d',  label: '4–8 ч',   border: '#b7eb8f' },
  overtime: { bg: '#fff1f0', color: '#cf1322',  label: '> 8 ч',   border: '#ffa39e' },
}

function fmtHours(h) {
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  if (mins === 0) return `${whole} ч`
  return `${whole} ч ${mins} м`
}

function HeatCell({ day }) {
  const cfg = LEVEL_CONFIG[day.level] ?? LEVEL_CONFIG.idle
  return (
    <Tooltip
      title={
        <span>
          {fmtHours(day.hours)}
          <br />
          <span style={{ opacity: 0.75, fontSize: 11 }}>{cfg.label}</span>
        </span>
      }
      mouseEnterDelay={0.1}
    >
      <div
        style={{
          width: '100%',
          height: 36,
          borderRadius: 6,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
          transition: 'transform 0.1s, box-shadow 0.1s',
          fontSize: 11,
          fontWeight: 500,
          color: cfg.color,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = `0 2px 8px ${cfg.border}`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {day.hours > 0 ? fmtHours(day.hours) : '—'}
      </div>
    </Tooltip>
  )
}

const DAY_LABELS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function HeatmapTable({ dates, users }) {
  const COL_W = Math.max(64, Math.min(90, Math.floor(680 / (dates.length || 1))))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 4, minWidth: 'max-content' }}>
        <thead>
          <tr>
            {/* Колонка имени */}
            <th style={{ minWidth: 160, paddingRight: 12, textAlign: 'left' }} />
            {dates.map((d) => {
              const dt = dayjs(d)
              const isWeekend = dt.day() === 0 || dt.day() === 6
              return (
                <th
                  key={d}
                  style={{
                    width: COL_W,
                    paddingBottom: 6,
                    textAlign: 'center',
                    opacity: isWeekend ? 0.45 : 1,
                  }}
                >
                  <Text
                    style={{ fontSize: 11, display: 'block', color: '#888', lineHeight: '1.2' }}
                  >
                    {DAY_LABELS[dt.day()]}
                  </Text>
                  <Text strong style={{ fontSize: 12, display: 'block' }}>
                    {dt.format('D.MM')}
                  </Text>
                </th>
              )
            })}
            {/* Итог */}
            <th style={{ width: 80, paddingLeft: 8, textAlign: 'center' }}>
              <Text style={{ fontSize: 11, color: '#888' }}>итого</Text>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.user_id}>
              <td style={{ paddingRight: 12, paddingBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'rgba(67, 97, 216, 0.10)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4361d8',
                      fontWeight: 700,
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {user.user_name?.[0] ?? '?'}
                  </div>
                  <Text style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{user.user_name}</Text>
                </div>
              </td>
              {dates.map((d) => {
                const day = user.days?.[d] ?? { seconds: 0, hours: 0, level: 'idle' }
                const isWeekend = dayjs(d).day() === 0 || dayjs(d).day() === 6
                return (
                  <td
                    key={d}
                    style={{
                      width: COL_W,
                      paddingBottom: 4,
                      opacity: isWeekend && day.level === 'idle' ? 0.4 : 1,
                    }}
                  >
                    <HeatCell day={day} />
                  </td>
                )
              })}
              <td style={{ paddingLeft: 8, paddingBottom: 4, textAlign: 'center' }}>
                <Text strong style={{ color: '#4361d8', fontSize: 13 }}>
                  {fmtHours(user.total_hours)}
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Нагрузка:</Text>
      {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
            }}
          />
          <Text style={{ fontSize: 12, color: cfg.color }}>{cfg.label}</Text>
        </div>
      ))}
    </div>
  )
}

export default function TeamHeatmapPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSearch() {
    if (!range || !range[0] || !range[1]) return
    setLoading(true)
    setError(null)
    try {
      const result = await reportsService.getTeamHeatmap({
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

  // Считаем статистику по всем пользователям
  const totalOvertimeDays = data?.users?.reduce((sum, u) => {
    return sum + Object.values(u.days ?? {}).filter((d) => d.level === 'overtime').length
  }, 0) ?? 0

  const totalIdleDays = data?.users?.reduce((sum, u) => {
    return sum + Object.values(u.days ?? {}).filter((d) => d.level === 'idle').length
  }, 0) ?? 0

  const totalHours = data?.users?.reduce((s, u) => s + u.total_hours, 0) ?? 0

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
            { title: 'Нагрузка команды' },
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
              Нагрузка команды по дням
            </Title>
            <Text type="secondary">
              Тепловая карта: выявляет переработки и простои по каждому сотруднику
            </Text>
          </div>
        </div>

        {/* Фильтры */}
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

        {/* Итоговые карточки */}
        {data && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Всего часов"
                  value={fmtHours(totalHours)}
                  prefix={<ClockCircleOutlined style={{ color: '#4361d8' }} />}
                  valueStyle={{ color: '#4361d8', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Сотрудников в отчёте"
                  value={data.users?.length ?? 0}
                  prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#389e0d', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Дней переработки"
                  value={totalOvertimeDays}
                  prefix={<ThunderboltOutlined style={{ color: '#cf1322' }} />}
                  valueStyle={{ color: totalOvertimeDays > 0 ? '#cf1322' : undefined, fontSize: 22 }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Легенда */}
        {data && (
          <div style={{ marginBottom: 16 }}>
            <Legend />
          </div>
        )}

        {/* Тепловая карта */}
        {loading && <Card loading style={{ borderRadius: 10 }} />}

        {!loading && data && (data.users?.length ?? 0) === 0 && (
          <Empty description="Нет данных за выбранный период" style={{ padding: 60 }} />
        )}

        {!loading && data && (data.users?.length ?? 0) > 0 && (
          <Card size="small" style={{ borderRadius: 12 }}>
            <HeatmapTable dates={data.dates} users={data.users} />
          </Card>
        )}

        {!data && !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Выберите период и нажмите «Показать»"
            style={{ padding: 60 }}
          />
        )}
      </div>
    </ConfigProvider>
  )
}
