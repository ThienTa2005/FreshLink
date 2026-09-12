import { Link } from 'react-router-dom'
import { PublicFooter, PublicHeader } from '../components/Brand'

const roles = [
  ['Nhà hàng', 'Đặt rau, nấm theo ngày; xem trạng thái và truy xuất từng lô.'],
  ['Nhà cung cấp', 'Xác nhận khả năng cung ứng, chuẩn bị hàng và tạo mã lô.'],
  ['FreshLink Gate', 'Kiểm số lượng, quy cách, ngoại quan trước khi chia đơn.'],
  ['Tài xế', 'Nhận tuyến giao, cập nhật trạng thái và thu hồi thùng.'],
]

const flow = ['Nhà hàng đặt đơn', 'Phân bổ nguồn', 'Kiểm tại cross-dock', 'Ghép chuyến', 'Giao và truy xuất']

export default function HomePage() {
  return (
    <main><PublicHeader />

      <section className="hero">
        <div>
          <span className="eyebrow">Nền tảng điều phối thực phẩm tươi B2B</span>
          <h1>Đúng nguồn.<br />Đúng chuẩn. Đúng giờ.</h1>
          <p>FreshLink kết nối nhà hàng với nguồn rau và nấm, ghi nhận kiểm lô tại điểm tập kết và điều phối giao theo đơn trong ngày.</p>
          <div className="actions">
            <Link className="button" to="/register">Đăng ký hợp tác</Link>
            <a className="button secondary" href="#workflow">Xem quy trình</a>
          </div>
        </div>
        <aside className="hero-card">
          <p>Dữ liệu minh họa quy trình, không phải số liệu vận hành thực tế.</p>
          <div><span>Đơn sáng nay</span><strong>12</strong></div>
          <div><span>Lô đã kiểm</span><strong>18/20</strong></div>
          <div><span>Giao trước 10:00</span><strong>95%</strong></div>
          <small>Dữ liệu minh họa cho giao diện MVP.</small>
        </aside>
      </section>

      <section className="section" id="solutions">
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

      <section className="section process" id="workflow">
        <span className="eyebrow">Cross-dock có kiểm soát</span>
        <h2>Không lưu thực phẩm qua đêm</h2>
        <div className="steps">
          {flow.map((step, index) => <div className="step" key={step}><b>{index + 1}</b><p>{step}</p></div>)}
        </div>
      </section>

      <section className="section trace-promo" id="traceability"><div><span className="eyebrow">Minh bạch từ nguồn đến bếp</span><h2>Quét một mã, xem trọn hành trình</h2><p>Mỗi lô hàng và thùng luân chuyển đều có dấu vết kiểm nhận, phân bổ và giao hàng rõ ràng.</p></div><Link className="button secondary" to="/trace/demo">Thử trang truy xuất</Link></section>
      <PublicFooter />
    </main>
  )
}
