import { useState } from 'react'
import { Alert, Button, Form, Input, Typography } from 'antd'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
export default function LoginPage() {
  const { user, login } = useAuth()
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/portal" replace />
  return <main className="auth-layout">
    <section className="auth-message"><Link className="brand brand-light" to="/">FreshLink</Link>
      <div><span className="eyebrow eyebrow-light">Đúng nguồn — Đúng chuẩn — Đúng giờ</span><h1>Từ nguồn hàng đến bếp nhà hàng.</h1></div>
      <p>Một tài khoản, truy cập theo quyền được cấp.</p>
    </section>
    <section className="auth-panel"><div className="login-form"><Typography.Title level={2}>Đăng nhập FreshLink</Typography.Title>
      {error && <Alert type="error" message={error} showIcon />}
      <Form layout="vertical" onFinish={async (values: { email: string; password: string }) => {
        setBusy(true); setError(''); try { await login(values.email, values.password) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
      }}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input autoComplete="username" size="large" /></Form.Item>
        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}><Input.Password autoComplete="current-password" size="large" /></Form.Item>
        <Button type="primary" htmlType="submit" loading={busy} block size="large">Đăng nhập</Button>
      </Form><Link to="/register">Đăng ký hợp tác</Link><Link to="/">← Trang chủ</Link>
    </div></section>
  </main>
}
