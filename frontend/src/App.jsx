import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AppHeader from './components/AppHeader'
import AppSidebar from './components/AppSidebar'
import SidebarToggle from './components/SidebarToggle'
import AppFooter from './components/AppFooter'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import PlatformStatusPage from './pages/PlatformStatusPage'
import ReportsPage from './pages/ReportsPage'
import UsersSummaryPage from './pages/UsersSummaryPage'
import ProjectsReportPage from './pages/ProjectsReportPage'
import TeamHeatmapPage from './pages/TeamHeatmapPage'
import MyDashboardPage from './pages/MyDashboardPage'

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'transparent',
        padding: 10,
        gap: 10,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Левая колонка: кнопка + сайдбар */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <SidebarToggle collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <AppSidebar collapsed={collapsed} />
      </div>

      {/* Правая колонка: хэдер + контент + футер */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 10, minWidth: 0, overflow: 'hidden' }}>
        <AppHeader />
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            minWidth: 0,
            background: 'rgba(255, 255, 255, 0.62)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: 'none',
            borderRadius: 16,
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.7), 0 4px 24px rgba(80, 70, 150, 0.09)',
            padding: '36px',
          }}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/status" element={<PlatformStatusPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/users-summary" element={<UsersSummaryPage />} />
            <Route path="/reports/projects" element={<ProjectsReportPage />} />
            <Route path="/reports/team-heatmap" element={<TeamHeatmapPage />} />
            <Route path="/reports/my-dashboard" element={<MyDashboardPage />} />
            <Route path="/reports/*" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <AppFooter />
      </div>
    </div>
  )
}

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4361d8',
          borderRadius: 10,
          colorBgLayout: '#f2f3f8',
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
