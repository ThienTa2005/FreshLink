import { Link } from 'react-router-dom'

const roles = [
  ['Nhà hàng', 'Đặt rau, nấm theo ngày; xem trạng thái và truy xuất từng lô.'],
  ['Nhà cung cấp', 'Xác nhận khả năng cung ứng, chuẩn bị hàng và tạo mã lô.'],
  ['FreshLink Gate', 'Kiểm số lượng, quy cách, ngoại quan trước khi chia đơn.'],
  ['Tài xế', 'Nhận tuyến giao, cập nhật trạng thái và thu hồi thùng.'],
]

const flow = ['Nhà hàng đặt đơn', 'Phân bổ nguồn', 'Kiểm tại cross-dock', 'Ghép chuyến', 'Giao và truy xuất']

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <Link className="brand" to="/">FreshLink</Link>
        <nav>
          <a href="#solution">Giải pháp</a>
          <a href="#process">Quy trình</a>
          <Link className="button button-small" to="/login">Đăng nhập</Link>
        </nav>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow">Nền tảng điều phối thực phẩm tươi B2B</span>
          <h1>Đúng nguồn.<br />Đúng chuẩn. Đúng giờ.</h1>
          <p>FreshLink kết nối nhà hàng với nguồn rau và nấm đã xác minh, kiểm lô tại điểm tập kết và giao theo đơn trong ngày.</p>
          <div className="actions">
            <Link className="button" to="/login">Bắt đầu sử dụng</Link>
            <a className="button secondary" href="#process">Xem quy trình</a>
          </div>
        </div>
        <aside className="hero-card">
          <div><span>Đơn sáng nay</span><strong>12</strong></div>
          <div><span>Lô đã kiểm</span><strong>18/20</strong></div>
          <div><span>Giao trước 10:00</span><strong>95%</strong></div>
          <small>Dữ liệu minh họa cho giao diện MVP.</small>
        </aside>
      </section>

      <section className="section" id="solution">
        <span className="eyebrow">Một hệ thống, bốn bên phối hợp</span>
        <h2>Thông tin đi cùng hàng hóa trong toàn bộ quy trình</h2>
        <div className="role-grid">
          {roles.map(([title, description], index) => (
            <article className="role-card" key={title}>
              <span>0{index + 1}</span><h3>{title}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section process" id="process">
        <span className="eyebrow">Cross-dock có kiểm soát</span>
        <h2>Không lưu thực phẩm qua đêm</h2>
        <div className="steps">
          {flow.map((step, index) => <div className="step" key={step}><b>{index + 1}</b><p>{step}</p></div>)}
        </div>
      </section>

      <footer><strong>FreshLink</strong><span>Thí điểm tại Cầu Giấy và Đống Đa, Hà Nội</span></footer>
    </main>
  )
}
