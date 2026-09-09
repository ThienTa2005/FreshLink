import { type FormEvent } from 'react'
import { Link } from 'react-router-dom'

export default function LoginPage() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  return (
    <main className="auth-layout">
      <section className="auth-message">
        <Link className="brand brand-light" to="/">FreshLink</Link>
        <div>
          <span className="eyebrow eyebrow-light">Cổng vận hành tập trung</span>
          <h1>Theo dõi từng đơn, từng lô và từng chuyến giao.</h1>
        </div>
        <p>Đúng nguồn – đúng chuẩn – đúng giờ.</p>
      </section>
      <section className="auth-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <span className="eyebrow">Chào mừng trở lại</span>
          <h2>Đăng nhập FreshLink</h2>
          <p>Giao diện nền đã sẵn sàng để kết nối API đăng nhập.</p>
          <label>Email<input type="email" placeholder="ten@doanhnghiep.vn" required /></label>
          <label>Mật khẩu<input type="password" placeholder="••••••••" required /></label>
          <button className="button" type="submit">Đăng nhập</button>
          <Link className="back-link" to="/">← Quay lại trang chủ</Link>
        </form>
      </section>
    </main>
  )
}
