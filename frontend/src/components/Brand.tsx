import { Link } from 'react-router-dom'

export function Logo({ light = false }: { light?: boolean }) {
  return <Link className={`brand-mark${light ? ' brand-mark-light' : ''}`} to="/" aria-label="FreshLink — Trang chủ">
    <span className="brand-symbol" aria-hidden="true"><i /><b /></span>
    <span><strong>FreshLink</strong><small>Cold-Chain B2B</small></span>
  </Link>
}

export function PublicHeader() {
  return <header className="public-header"><div className="public-header-inner">
    <Logo />
    <nav aria-label="Điều hướng chính"><a href="/#solutions">Giải pháp</a><a href="/#workflow">Quy trình</a><a href="/#traceability">Truy xuất</a></nav>
    <div className="public-actions"><Link className="link-button" to="/login">Đăng nhập</Link><Link className="button button-small" to="/register">Đăng ký hợp tác</Link></div>
  </div></header>
}

export function PublicFooter() {
  return <footer className="public-footer"><div><Logo light /><p>Điều phối nguồn cung, kiểm nhận và giao thực phẩm tươi minh bạch.</p></div><div><strong>FreshLink Việt Nam</strong><span>Thí điểm tại Cầu Giấy và Đống Đa, Hà Nội</span><span>Hỗ trợ: support@freshlink.vn</span></div></footer>
}
