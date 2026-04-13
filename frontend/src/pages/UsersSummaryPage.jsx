import { useState } from 'react'
import {
  Typography,
  DatePicker,
  Button,
  Table,
  Card,
  Row,
  Col,
  Progress,
  Alert,
  Space,
  Statistic,
  Breadcrumb,
  Tag,
} from 'antd'
import {
  TeamOutlined,
  SearchOutlined,
  ProjectOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  FolderOutlined,
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

function ExpandedTasks({ tasks, totalHours }) {
  const columns = [
    {
      title: 'Задача',
      dataIndex: 'task_title',
      key: 'task_title',
      render: (title, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text>{title}</Text>
          {row.group_name ? (
            <Tag
              icon={<FolderOutlined />}
              color="blue"
              style={{ margin: 0, borderRadius: 6, fontSize: 11 }}
            >
              {row.group_name}
            </Tag>
          ) : (
            <Tag color="orange" style={{ margin: 0, borderRadius: 6, fontSize: 11 }}>
              Без проекта
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Время',
      dataIndex: 'hours',
      key: 'hours',
      width: 220,
      render: (h) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Text style={{ color: '#4361d8', fontWeight: 500 }}>{fmtHours(h)}</Text>
          </div>
          <Progress
            percent={Math.round((h / (totalHours || 1)) * 100)}
            showInfo={false}
            strokeColor="#4361d8"
            size={['100%', 4]}
            style={{ margin: 0 }}
          />
        </div>
      ),
    },
    {
      title: 'Доля',
      key: 'share',
      width: 70,
      render: (_, row) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {totalHours ? Math.round((row.hours / totalHours) * 100) : 0}%
        </Text>
      ),
    },
  ]

  return (
    <div style={{ padding: '4px 16px 12px 56px' }}>
      <Table
        dataSource={tasks}
        columns={columns}
        rowKey="task_id"
        pagination={false}
        size="small"
        showHeader={tasks.length > 0}
        style={{ background: 'rgba(67, 97, 216, 0.03)', borderRadius: 8 }}
        locale={{ emptyText: 'Нет задач' }}
      />
    </div>
  )
}

export default function UsersSummaryPage() {
  const navigate = useNavigate()
  const [range, setRange] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedKeys, setExpandedKeys] = useState([])

  async function handleSearch() {
    if (!range || !range[0] || !range[1]) return
    setLoading(true)
    setError(null)
    setExpandedKeys([])
    try {
      const result = await reportsService.getUsersSummary({
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

  const maxHours = data?.users?.[0]?.hours_total ?? 1

  const columns = [
    {
      title: '№',
      key: 'index',
      width: 48,
      render: (_, __, idx) => (
        <Text type="secondary" style={{ fontSize: 13 }}>{idx + 1}</Text>
      ),
    },
    {
      title: 'Сотрудник',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (name) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(67, 97, 216, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#4361d8',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {name?.[0] ?? '?'}
          </div>
          <Text strong>{name}</Text>
        </div>
      ),
    },
    {
      title: 'Всего',
      dataIndex: 'hours_total',
      key: 'hours_total',
      sorter: (a, b) => a.hours_total - b.hours_total,
      defaultSortOrder: 'descend',
      width: 200,
      render: (h) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Text strong style={{ color: '#4361d8' }}>{fmtHours(h)}</Text>
          </div>
          <Progress
            percent={Math.round((h / maxHours) * 100)}
            showInfo={false}
            strokeColor="#4361d8"
            size={['100%', 6]}
            style={{ margin: 0 }}
          />
        </div>
      ),
    },
    {
      title: 'С проектом',
      dataIndex: 'hours_with_project',
      key: 'hours_with_project',
      sorter: (a, b) => a.hours_with_project - b.hours_with_project,
      width: 150,
      render: (h) => (
        <div>
          <Text style={{ color: '#389e0d' }}>{fmtHours(h)}</Text>
          <Progress
            percent={Math.round((h / maxHours) * 100)}
            showInfo={false}
            strokeColor="#52c41a"
            size={['100%', 4]}
            style={{ margin: '4px 0 0' }}
          />
        </div>
      ),
    },
    {
      title: 'Без проекта',
      dataIndex: 'hours_without_project',
      key: 'hours_without_project',
      sorter: (a, b) => a.hours_without_project - b.hours_without_project,
      width: 150,
      render: (h) => (
        <div>
          <Text style={{ color: h > 0 ? '#d46b08' : undefined, opacity: h === 0 ? 0.35 : 1 }}>
            {fmtHours(h)}
          </Text>
          {h > 0 && (
            <Progress
              percent={Math.round((h / maxHours) * 100)}
              showInfo={false}
              strokeColor="#fa8c16"
              size={['100%', 4]}
              style={{ margin: '4px 0 0' }}
            />
          )}
        </div>
      ),
    },
    {
      title: 'Доля',
      key: 'share',
      width: 80,
      render: (_, row) => {
        const pct = data?.total_hours
          ? Math.round((row.hours_total / data.total_hours) * 100)
          : 0
        return <Text type="secondary" style={{ fontSize: 13 }}>{pct}%</Text>
      },
    },
  ]

  const totalWithProject = data?.users?.reduce((s, u) => s + u.hours_with_project, 0) ?? 0
  const totalWithout = data?.users?.reduce((s, u) => s + u.hours_without_project, 0) ?? 0

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
            { title: 'Сводка по пользователям' },
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
              Сводка по пользователям
            </Title>
            <Text type="secondary">Кто сколько времени потратил за период. Нажмите на строку, чтобы раскрыть задачи.</Text>
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
                  value={fmtHours(data.total_hours)}
                  prefix={<ClockCircleOutlined style={{ color: '#4361d8' }} />}
                  valueStyle={{ color: '#4361d8', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="По проектам"
                  value={fmtHours(totalWithProject)}
                  prefix={<ProjectOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#389e0d', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Без проекта"
                  value={fmtHours(totalWithout)}
                  prefix={<TeamOutlined style={{ color: '#fa8c16' }} />}
                  valueStyle={{ color: totalWithout > 0 ? '#d46b08' : undefined, fontSize: 22 }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Таблица с drill-down */}
        <Card size="small" variant="borderless" style={{ background: 'transparent' }}>
          <Table
            dataSource={data?.users ?? []}
            columns={columns}
            rowKey="user_id"
            loading={loading}
            pagination={false}
            size="middle"
            onRow={(record) => ({
              onClick: () => {
                setExpandedKeys((prev) =>
                  prev.includes(record.user_id)
                    ? prev.filter((k) => k !== record.user_id)
                    : [...prev, record.user_id]
                )
              },
              style: { cursor: 'pointer' },
            })}
            expandable={{
              expandedRowKeys: expandedKeys,
              onExpandedRowsChange: setExpandedKeys,
              expandedRowRender: (record) => (
                <ExpandedTasks tasks={record.tasks ?? []} totalHours={record.hours_total} />
              ),
              rowExpandable: (record) => (record.tasks?.length ?? 0) > 0,
            }}
            locale={{
              emptyText: data
                ? 'Нет данных за выбранный период'
                : 'Выберите период и нажмите «Показать»',
            }}
            style={{ background: 'white', borderRadius: 12 }}
          />
        </Card>
      </div>
    </ConfigProvider>
  )
}
