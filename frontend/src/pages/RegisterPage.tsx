import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Radio } from 'antd'
import { Link } from 'react-router-dom'
import { api } from '../api/http'
import { Logo } from '../components/Brand'

export default function RegisterPage() {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <main className="public-form">
      <div style={{ marginBottom: 20 }}>
        <Logo />
      </div>

      <Card style={{ borderRadius: 16, border: '1px solid #e3e8e2', boxShadow: '0 4px 20px rgba(23,49,40,0.06)' }}>
        <div style={{ marginBottom: 20 }}>
          <span className="eyebrow" style={{ marginBottom: 8 }}>Mở Rộng Mạng Lưới Chuỗi Cung Ứng</span>
          <h2 style={{ margin: '8px 0', fontSize: '1.8rem', color: '#173128', fontWeight: 800 }}>
            Đăng ký trở thành Đối tác FreshLink
          </h2>
          <p style={{ color: '#4e655c', margin: 0, fontSize: '0.95rem' }}>
            Kết nối trực tiếp vào nền tảng điều phối logistics chuỗi lạnh chuẩn hóa.
          </p>
        </div>

        {done ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#edf7f1', color: '#176b45', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 36 }}>task_alt</span>
            </div>
            <h3 style={{ fontSize: '1.3rem', color: '#173128', margin: '0 0 8px' }}>Hồ sơ đã được gửi thành công!</h3>
            <p style={{ color: '#4e655c', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Ban quản trị FreshLink sẽ thẩm định thông tin và liên hệ kích hoạt tài khoản trong vòng 24 giờ làm việc. Bạn có thể tra cứu tiến độ xét duyệt bất cứ lúc nào.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link to="/registration-status" className="button">
                Tra cứu tiến độ hồ sơ
              </Link>
              <Link to="/login" className="button secondary">
                Về trang đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <>
            {error && <Alert type="error" message={error} showIcon style={{ borderRadius: 10, marginBottom: 20 }} />}

            <Form
              layout="vertical"
              initialValues={{ type: 'RESTAURANT' }}
              onFinish={async (values) => {
                setBusy(true)
                setError('')
                try {
                  await api('/public/partners', 'POST', values)
                  setDone(true)
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Form.Item name="type" label={<span style={{ fontWeight: 700 }}>Loại hình đơn vị</span>} rules={[{ required: true }]}>
                <Radio.Group style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Radio.Button value="RESTAURANT" style={{ height: 'auto', padding: '14px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ color: '#176b45' }}>restaurant</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.95rem' }}>Nhà hàng & Chuỗi F&B</strong>
                      <small style={{ color: '#7d938a' }}>Đặt mua rau, nấm sạch giao trong ngày</small>
                    </div>
                  </Radio.Button>
                  <Radio.Button value="SUPPLIER" style={{ height: 'auto', padding: '14px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ color: '#176b45' }}>agriculture</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.95rem' }}>Hợp tác xã & Vùng trồng</strong>
                      <small style={{ color: '#7d938a' }}>Cung ứng nông sản đạt chuẩn VietGAP</small>
                    </div>
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="organizationName" label={<span style={{ fontWeight: 600 }}>Tên doanh nghiệp / Đơn vị</span>} rules={[{ required: true, max: 200, message: 'Vui lòng nhập tên đơn vị' }]}>
                  <Input size="large" placeholder="VD: Nhà hàng Sen Tây Hồ / HTX Rau Ba Vì" style={{ borderRadius: 8 }} />
                </Form.Item>
                <Form.Item name="fullName" label={<span style={{ fontWeight: 600 }}>Họ và tên người đại diện</span>} rules={[{ required: true, max: 150, message: 'Vui lòng nhập tên người liên hệ' }]}>
                  <Input size="large" autoComplete="name" placeholder="VD: Nguyễn Văn An" style={{ borderRadius: 8 }} />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="email" label={<span style={{ fontWeight: 600 }}>Email công việc</span>} rules={[{ required: true, type: 'email', max: 150, message: 'Vui lòng nhập email hợp lệ' }]}>
                  <Input size="large" autoComplete="email" placeholder="dai-dien@cong-ty.vn" style={{ borderRadius: 8 }} />
                </Form.Item>
                <Form.Item name="password" label={<span style={{ fontWeight: 600 }}>Mật khẩu khởi tạo (tối thiểu 10 ký tự)</span>} rules={[{ required: true, min: 10, max: 72, message: 'Mật khẩu từ 10 đến 72 ký tự' }]}>
                  <Input.Password size="large" autoComplete="new-password" placeholder="Nhập mật khẩu an toàn..." style={{ borderRadius: 8 }} />
                </Form.Item>
              </div>

              <Button type="primary" htmlType="submit" loading={busy} size="large" block style={{ height: 44, borderRadius: 10, fontWeight: 700, marginTop: 8 }}>
                Gửi hồ sơ đăng ký hợp tác
              </Button>
            </Form>

            <div style={{ borderTop: '1px solid #e3e8e2', marginTop: 24, paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
              <Link to="/registration-status" style={{ color: '#4e655c' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>search</span>
                Tra cứu tiến độ xét duyệt hồ sơ
              </Link>
              <Link to="/login" style={{ color: '#176b45', fontWeight: 700 }}>
                Đã có tài khoản? Đăng nhập →
              </Link>
            </div>
          </>
        )}
      </Card>
    </main>
  )
}
