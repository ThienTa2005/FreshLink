import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { warmBackend } from '../api/http'
import { Logo } from '../components/Brand'

export default function LoginPage() {
  const { user, login } = useAuth()
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [server, setServer] = useState<'warming' | 'ready' | 'slow' | 'error'>('warming')

  useEffect(() => {
    let active = true
    const slow = window.setTimeout(() => { if (active) setServer('slow') }, 3500)
    void warmBackend()
      .then(() => { if (active) setServer('ready') })
      .catch(() => { if (active) setServer('error') })
      .finally(() => window.clearTimeout(slow))
    return () => { active = false; window.clearTimeout(slow) }
  }, [])

  if (user) return <Navigate to="/portal" replace />

  return (
    <main className="auth-layout">
      {/* Left Message Hero Pane */}
      <section className="auth-message">
        <div>
          <Logo light />
        </div>
        <div>
          <span className="eyebrow" style={{ background: 'rgba(255,255,255,0.12)', color: '#a4f4c3', borderColor: 'rgba(255,255,255,0.25)', marginBottom: 20 }}>
            Hệ Thống Điều Phối Vận Hành B2B
          </span>
          <h1 style={{ color: '#ffffff', margin: '16px 0' }}>
            Nông sản tươi ngon.<br />Từ nguồn trồng đến bàn ăn.
          </h1>
          <p style={{ color: '#d7f5e7', fontSize: '1.1rem', maxWidth: 500 }}>
            Kiểm soát chất lượng tại Gate, duy trì nhiệt độ bảo quản 24/7 và minh bạch chứng từ đối soát cho mọi mắt xích chuỗi cung ứng.
          </p>

          <div className="auth-message-quote">
            <p>"Toàn bộ quy trình kiểm định, luân chuyển thùng SmartCrate và đối chiếu thanh toán đều được thực hiện theo thời gian thực."</p>
            <span>FreshLink Quality Standard</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#a4f4c3' }}>
          <span>✓ Tiêu chuẩn VietGAP / GlobalGAP</span>
          <span>✓ Cảm biến nhiệt độ IoT</span>
          <span>✓ Không lưu kho qua đêm</span>
        </div>
      </section>

      {/* Right Login Form Pane */}
      <section className="auth-panel">
        <div className="login-form">
          <div style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: '1.9rem', color: '#173128' }}>Đăng nhập Portal</h2>
            <p style={{ margin: '4px 0 0', color: '#4e655c' }}>
              Vui lòng nhập tài khoản được cấp quyền bởi đơn vị của bạn
            </p>
          </div>

          {error && <Alert type="error" message={error} showIcon style={{ borderRadius: 10 }} />}
          {server === 'warming' && <Alert type="info" message="Đang kiểm tra kết nối máy chủ…" showIcon style={{ borderRadius: 10 }} />}
          {server === 'slow' && <Alert type="info" message="Máy chủ đang khởi động lại (cold-start). Vui lòng đợi trong giây lát." showIcon style={{ borderRadius: 10 }} />}
          {server === 'error' && <Alert type="warning" message="Không kết nối được API health check. Bạn vẫn có thể nhập tài khoản để thử đăng nhập." showIcon style={{ borderRadius: 10 }} />}

          <Form
            form={form}
            layout="vertical"
            onFinish={async (values: { email: string; password: string }) => {
              setBusy(true)
              setError('')
              try {
                await login(values.email, values.password)
              } catch (e) {
                setError((e as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            <Form.Item
              name="email"
              label={<span style={{ fontWeight: 600 }}>Địa chỉ Email</span>}
              rules={[{ required: true, message: 'Vui lòng nhập email của bạn' }, { type: 'email', message: 'Email không hợp lệ' }]}
            >
              <Input
                autoComplete="username"
                size="large"
                placeholder="name@company.com"
                prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6f7a71' }}>mail</span>}
                style={{ borderRadius: 10 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ fontWeight: 600 }}>Mật khẩu</span>}
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password
                autoComplete="current-password"
                size="large"
                placeholder="Nhập mật khẩu..."
                prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6f7a71' }}>lock</span>}
                style={{ borderRadius: 10 }}
              />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Link to="/forgot-password" style={{ color: '#176b45', fontSize: '0.9rem', fontWeight: 600 }}>
                Quên mật khẩu?
              </Link>
              <Link to="/registration-status" style={{ color: '#4e655c', fontSize: '0.9rem' }}>
                Tra cứu hồ sơ đăng ký
              </Link>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={busy}
              block
              size="large"
              style={{ height: 44, borderRadius: 10, fontSize: 15, fontWeight: 700 }}
            >
              Đăng nhập vào hệ thống
            </Button>
          </Form>

          <div style={{ borderTop: '1px solid #e3e8e2', paddingTop: 16, textAlign: 'center', fontSize: '0.92rem' }}>
            <span style={{ color: '#4e655c' }}>Chưa có tài khoản đối tác? </span>
            <Link to="/register" style={{ color: '#176b45', fontWeight: 700 }}>
              Đăng ký hợp tác ngay
            </Link>
          </div>

          <Link to="/" className="back-link" style={{ marginTop: 8 }}>
            ← Quay lại Trang chủ FreshLink
          </Link>
        </div>
      </section>
    </main>
  )
}

