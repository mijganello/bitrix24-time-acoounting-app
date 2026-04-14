import { useState } from 'react'
import {
  Typography,
  DatePicker,
  Button,
  Table,
  Card,
  Row,
  Col,
  Alert,
  Space,
  Statistic,
  Breadcrumb,
  Tag,
  Collapse,
  Progress,
  Empty,
} from 'antd'
import {
  SearchOutlined,
  ProjectOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  FolderOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
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

// Таблица пользователей внутри задачи
function TaskUsersTable({ users, taskHours }) {
  return (
    <div style={{ padding: '4px 0 8px 24px' }}>
      {users.map((u) => (
        <div
          key={u.user_id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '5px 0',
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(67, 97, 216, 0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4361d8',
              fontWeight: 600,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {u.user_name?.[0] ?? '?'}
          </div>
          <Text style={{ minWidth: 160 }}>{u.user_name}</Text>
          <div style={{ flex: 1, maxWidth: 220 }}>
            <Progress
              percent={Math.round((u.hours / (taskHours || 1)) * 100)}
              showInfo={false}
              strokeColor="#4361d8"
              size={['100%', 4]}
              style={{ margin: 0 }}
            />
          </div>
          <Text strong style={{ color: '#4361d8', minWidth: 60, textAlign: 'right' }}>
            {fmtHours(u.hours)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>
            {Math.round((u.hours / (taskHours || 1)) * 100)}%
          </Text>
        </div>
      ))}
    </div>
  )
}

// Таблица задач внутри проекта
function ProjectTasksTable({ tasks, projectHours }) {
  const columns = [
    {
      title: 'Задача',
      dataIndex: 'task_title',
      key: 'task_title',
      render: (title) => <Text>{title}</Text>,
    },
    {
      title: 'Время',
      dataIndex: 'hours',
      key: 'hours',
      width: 240,
      render: (h) => (
        <div>
          <div style={{ marginBottom: 3 }}>
            <Text strong style={{ color: '#4361d8' }}>{fmtHours(h)}</Text>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              ({Math.round((h / (projectHours || 1)) * 100)}% от проекта)
            </Text>
          </div>
          <Progress
            percent={Math.round((h / (projectHours || 1)) * 100)}
            showInfo={false}
            strokeColor="#4361d8"
            size={['100%', 4]}
            style={{ margin: 0 }}
          />
        </div>
      ),
    },
    {
      title: 'Исполнители',
      key: 'users',
      width: 140,
      render: (_, row) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          <UserOutlined style={{ marginRight: 4 }} />
          {row.users?.length ?? 0} чел.
        </Text>
      ),
    },
  ]

  return (
    <Table
      dataSource={tasks}
      columns={columns}
      rowKey="task_id"
      pagination={false}
      size="small"
      expandable={{
        expandedRowRender: (record) => (
          <TaskUsersTable users={record.users ?? []} taskHours={record.hours} />
        ),
        rowExpandable: (record) => (record.users?.length ?? 0) > 0,
        expandRowByClick: true,
      }}
      onRow={(record) => ({
        style: { cursor: (record.users?.length ?? 0) > 0 ? 'pointer' : 'default' },
      })}
      style={{ background: 'transparent' }}
    />
  )
}

// Карточка одного проекта
function ProjectCard({ project, totalHours, isNoProject = false }) {
  const sharePercent = totalHours ? Math.round((project.hours / totalHours) * 100) : 0

  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderLeft: isNoProject
          ? '3px solid #fa8c16'
          : '3px solid #4361d8',
        borderRadius: 10,
      }}
    >
      <Collapse
        ghost
        items={[
          {
            key: 'tasks',
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: isNoProject
                      ? 'rgba(250, 140, 22, 0.10)'
                      : 'rgba(67, 97, 216, 0.10)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isNoProject
                    ? <AppstoreOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                    : <FolderOutlined style={{ color: '#4361d8', fontSize: 16 }} />
                  }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text strong style={{ fontSize: 14 }}>
                      {project.project_name}
                    </Text>
                    {isNoProject && (
                      <Tag color="orange" style={{ margin: 0, borderRadius: 6, fontSize: 11 }}>
                        без проекта
                      </Tag>
                    )}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Progress
                      percent={sharePercent}
                      showInfo={false}
                      strokeColor={isNoProject ? '#fa8c16' : '#4361d8'}
                      size={['100%', 5]}
                      style={{ margin: 0, maxWidth: 400 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 24, flexShrink: 0, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: 15, color: isNoProject ? '#d46b08' : '#4361d8' }}>
                      {fmtHours(project.hours)}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {sharePercent}% от итого
                    </Text>
                  </div>
                  <Tag
                    icon={<TeamOutlined />}
                    color={isNoProject ? 'orange' : 'blue'}
                    style={{ margin: 0 }}
                  >
                    {project.tasks?.length ?? 0} задач
                  </Tag>
                </div>
              </div>
            ),
            children: (
              <ProjectTasksTable tasks={project.tasks ?? []} projectHours={project.hours} />
            ),
          },
        ]}
      />
    </Card>
  )
}

export default function ProjectsReportPage() {
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
      const result = await reportsService.getProjects({
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

  const allProjects = data
    ? [...(data.projects ?? []), ...(data.no_project ? [data.no_project] : [])]
    : []

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
            { title: 'Детализация по проектам' },
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
              Детализация по проектам
            </Title>
            <Text type="secondary">
              Дерево: проект → задача → исполнитель. Нажмите на проект или задачу чтобы раскрыть.
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
                  value={fmtHours(data.total_hours)}
                  prefix={<ClockCircleOutlined style={{ color: '#4361d8' }} />}
                  valueStyle={{ color: '#4361d8', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Проектов"
                  value={data.projects?.length ?? 0}
                  prefix={<ProjectOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#389e0d', fontSize: 22 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="Без проекта"
                  value={fmtHours(data.no_project?.hours ?? 0)}
                  prefix={<AppstoreOutlined style={{ color: '#fa8c16' }} />}
                  valueStyle={{
                    color: (data.no_project?.hours ?? 0) > 0 ? '#d46b08' : undefined,
                    fontSize: 22,
                  }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Список проектов */}
        {loading && (
          <Card loading style={{ borderRadius: 10 }} />
        )}

        {!loading && data && allProjects.length === 0 && (
          <Empty description="Нет данных за выбранный период" style={{ padding: 60 }} />
        )}

        {!loading && data && (
          <div>
            {(data.projects ?? []).map((project) => (
              <ProjectCard
                key={project.project_id}
                project={project}
                totalHours={data.total_hours}
              />
            ))}
            {data.no_project && data.no_project.hours > 0 && (
              <ProjectCard
                key="no_project"
                project={data.no_project}
                totalHours={data.total_hours}
                isNoProject
              />
            )}
          </div>
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
