import { Button, Result, Spin } from 'antd'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PortalPage from './pages/PortalPage'
import TracePage from './pages/TracePage'
import AccessPage from './pages/AccessPage'
import { useAuth } from './auth/AuthContext'

export default function App() {
  const { status, retrySession, discardSession } = useAuth()
  const location = useLocation()
  if (status === 'initializing') return <main className="auth-layout"><Spin size="large" tip="Đang khôi phục phiên đăng nhập…"><div style={{ minHeight: 160 }} /></Spin></main>
  if (status === 'unavailable' && location.pathname.startsWith('/portal')) return <Result status="warning" title="Chưa kết nối được máy chủ" subTitle="Phiên của bạn vẫn được giữ. Render Free có thể đang khởi động lại." extra={[<Button type="primary" key="retry" onClick={() => void retrySession()}>Thử kết nối lại</Button>,<Button key="discard" onClick={discardSession}>Về trang đăng nhập</Button>]} />
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {['/accept-invitation','/reset-password','/forgot-password','/registration-status'].map(path=><Route key={path} path={path} element={<AccessPage/>}/>)}
      <Route path="/portal/*" element={<PortalPage />} />
      <Route path="/trace/:code" element={<TracePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
