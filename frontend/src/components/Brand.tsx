import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Drawer, Button } from 'antd'

export function Logo({ light = false }: { light?: boolean }) {
  const [imgError, setImgError] = useState(false)
  return (
    <Link className={`brand-mark${light ? ' brand-mark-light' : ''}`} to="/" aria-label="FreshLink — Trang chủ">
      {!imgError ? (
        <img
          src="/freshlink-logo.png"
          alt="FreshLink Logo"
          onError={() => setImgError(true)}
          style={{ height: 36, width: 'auto', borderRadius: 8, objectFit: 'contain' }}
        />
      ) : (
        <span className="brand-symbol" aria-hidden="true"><i /><b /></span>
      )}
      <span>
        <strong>FreshLink</strong>
        <small style={{ color: light ? '#a4f4c3' : '#6f7a71' }}>Cold-Chain B2B</small>
      </span>
    </Link>
  )
}

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Logo />
        <nav aria-label="Điều hướng chính">
          <a href="/#solutions">Giải pháp B2B</a>
          <a href="/#workflow">Chuỗi cung ứng</a>
          <a href="/#traceability">Truy xuất nguồn gốc</a>
          <Link to="/trace/demo">Tra cứu lô</Link>
        </nav>
        <div className="public-actions">
          <Link className="link-button" to="/login">Đăng nhập</Link>
          <Link className="button button-small" to="/register">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>how_to_reg</span>
            Đăng ký hợp tác
          </Link>
          <Button
            type="text"
            className="mobile-nav-toggle"
            style={{ display: 'none' }}
            onClick={() => setMobileOpen(true)}
          >
            <span className="material-symbols-outlined">menu</span>
          </Button>
        </div>
      </div>
      <Drawer
        title={<Logo />}
        placement="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 16, fontWeight: 600 }}>
          <a href="/#solutions" onClick={() => setMobileOpen(false)}>Giải pháp B2B</a>
          <a href="/#workflow" onClick={() => setMobileOpen(false)}>Chuỗi cung ứng</a>
          <a href="/#traceability" onClick={() => setMobileOpen(false)}>Truy xuất nguồn gốc</a>
          <Link to="/trace/demo" onClick={() => setMobileOpen(false)}>Tra cứu lô hàng</Link>
          <hr style={{ border: 'none', borderTop: '1px solid #e3e8e2', margin: '8px 0' }} />
          <Link to="/login" className="button secondary" onClick={() => setMobileOpen(false)}>Đăng nhập Portal</Link>
          <Link to="/register" className="button" onClick={() => setMobileOpen(false)}>Đăng ký hợp tác</Link>
        </div>
      </Drawer>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div>
        <Logo light />
        <p>
          Hệ thống điều phối logistics chuỗi lạnh nông sản B2B hàng đầu. Liên kết chặt chẽ Nhà hàng F&B, Nông trại/Hợp tác xã, Cross-dock Gate và Đội xe chuyên dụng.
        </p>
        <span style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
          © {new Date().getFullYear()} FreshLink Platform. Bản quyền đã được bảo hộ.
        </span>
      </div>
      <div>
        <strong style={{ fontSize: 16, color: '#ffffff' }}>FreshLink Việt Nam</strong>
        <span>Trung tâm điều hành: Cầu Giấy & Đống Đa, TP. Hà Nội</span>
        <span>Hotline vận hành: 1900 8899 • Hỗ trợ: support@freshlink.vn</span>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <span className="eyebrow" style={{ background: 'rgba(255,255,255,0.1)', color: '#a4f4c3', borderColor: 'rgba(255,255,255,0.2)' }}>
            HACCP & VietGAP Compliant
          </span>
          <span className="eyebrow" style={{ background: 'rgba(255,255,255,0.1)', color: '#a4f4c3', borderColor: 'rgba(255,255,255,0.2)' }}>
            IoT 24/7 Cold-Chain
          </span>
        </div>
      </div>
    </footer>
  )
}

