import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PortalPage from './pages/PortalPage'
import TracePage from './pages/TracePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/portal" element={<PortalPage />} />
      <Route path="/trace/:code" element={<TracePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
