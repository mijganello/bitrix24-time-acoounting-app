import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, ConfigProvider, Form, Input, Typography, Alert } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth } from '../hooks/useAuth'

const { Title, Text } = Typography

const GLASS = {
  background: 'rgba(255, 255, 255, 0.62)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  borderRadius: 24,
  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.7), 0 8px 40px rgba(80, 70, 150, 0.13)',
  padding: '44px 40px',
  width: '100%',
  maxWidth: 400,
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const from = location.state?.from?.pathname || '/'

  const onFinish = async ({ username, password }) => {
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4361d8',
          borderRadius: 10,
        },
      }}
    >
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div style={GLASS}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={3} style={{ margin: 0, color: '#2d2d3f' }}>
              Bitrix24 — Учёт времени
            </Title>
            <Text style={{ color: 'rgba(0,0,0,0.4)' }}>Введите данные для входа</Text>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Введите логин' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Логин"
                size="large"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Пароль"
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                Войти
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </ConfigProvider>
  )
}
