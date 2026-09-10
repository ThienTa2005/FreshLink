import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Select, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { api } from '../api/http'
export default function RegisterPage() {
  const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false)
  return <main className="public-form"><Link className="brand" to="/">FreshLink</Link><Card>
    <Typography.Title level={2}>Đăng ký hợp tác</Typography.Title>
    {done ? <Alert type="success" showIcon message="Đã gửi hồ sơ" description="Tài khoản sẽ hoạt động sau khi quản trị viên duyệt." /> : <>
      {error && <Alert type="error" message={error} showIcon />}
      <Form layout="vertical" initialValues={{ type: 'RESTAURANT' }} onFinish={async (values) => {
        setBusy(true); setError(''); try { await api('/public/partners', 'POST', values); setDone(true) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
      }}>
        <Form.Item name="type" label="Loại đối tác" rules={[{ required: true }]}><Select options={[{ value: 'RESTAURANT', label: 'Nhà hàng' }, { value: 'SUPPLIER', label: 'Nhà cung cấp' }]} /></Form.Item>
        <Form.Item name="organizationName" label="Tên đơn vị" rules={[{ required: true, max: 200 }]}><Input /></Form.Item>
        <Form.Item name="fullName" label="Người liên hệ" rules={[{ required: true, max: 150 }]}><Input autoComplete="name" /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', max: 150 }]}><Input autoComplete="email" /></Form.Item>
        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 10, max: 72 }]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Button type="primary" htmlType="submit" loading={busy}>Gửi đăng ký</Button>
      </Form></>}
    <p><Link to="/login">Đến trang đăng nhập</Link></p>
  </Card></main>
}
