import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Input, Button } from 'antd'
import { PublicFooter, PublicHeader } from '../components/Brand'
import { FreshLinkMap } from '../components/FreshLinkMap'

const roles = [
  {
    num: '01',
    icon: 'restaurant',
    title: 'Nhà hàng & Chuỗi F&B',
    description: 'Lên thực đơn & đặt nông sản theo ngày; kiểm soát hạn mức chi tiêu; phân quyền phê duyệt nội bộ; quét QR nhận hàng đối chiếu thực tế và gửi khiếu nại bồi hoàn có SLA cam kết.'
  },
  {
    num: '02',
    icon: 'agriculture',
    title: 'Hợp tác xã & Vùng trồng',
    description: 'Đăng ký chào giá năng lực định kỳ; nhận yêu cầu phân nguồn thông minh; chuẩn bị hàng, khai báo nguồn gốc xuất xứ và tạo tem mã lô VietGAP trước khi xuất phát.'
  },
  {
    num: '03',
    icon: 'verified',
    title: 'FreshLink Gate KCS',
    description: 'Kiểm tra 4 tiêu chí nghiêm ngặt (Quy cách, Bao bì, Nhãn mác, Ngoại quan). Tự động phân loại Đạt / Cách ly / Từ chối và bù đắp nguồn cung ngay trong phiên sáng.'
  },
  {
    num: '04',
    icon: 'local_shipping',
    title: 'Đội xe lạnh & Tài xế',
    description: 'Khoang lái tối ưu trên di động với chỉ đường thông minh; giám sát nhiệt độ thùng lạnh GPS thời gian thực; quản lý vòng đời thùng luân chuyển và giao lại không tính trùng phí.'
  }
]

const steps = [
  { num: 1, icon: 'edit_calendar', title: '1. Chốt đơn & Phê duyệt', desc: 'Bếp trưởng lên đơn, Quản lý duyệt trước giờ cutoff.' },
  { num: 2, icon: 'hub', title: '2. Phân nguồn thông minh', desc: 'Tự động chia nguồn cung tối ưu giữa các vùng trồng uy tín.' },
  { num: 3, icon: 'fact_check', title: '3. Kiểm nhận Gate KCS', desc: 'Kiểm tra chất lượng và chia hàng tại cross-dock rạng sáng.' },
  { num: 4, icon: 'route', title: '4. Ghép chuyến chuỗi lạnh', desc: 'Tối ưu lộ trình và cấp thùng SmartCrate luân chuyển.' },
  { num: 5, icon: 'qr_code_scanner', title: '5. Nhận hàng & Truy xuất', desc: 'Đối chiếu kiện hàng, ký nhận điện tử và truy xuất nguồn gốc.' }
]

export default function HomePage() {
  const [traceInput, setTraceInput] = useState('')
  const navigate = useNavigate()

  const handleTrace = () => {
    if (traceInput.trim()) {
      navigate(`/trace/${encodeURIComponent(traceInput.trim())}`)
    } else {
      navigate('/trace/demo')
    }
  }

  return (
    <main>
      <PublicHeader />

      {/* Hero Section */}
      <section className="hero">
        <div>
          <span className="eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>ac_unit</span>
            Nền tảng chuỗi lạnh nông sản B2B
          </span>
          <h1>
            Đúng nguồn.<br />
            <span className="gradient-text">Đúng chuẩn. Đúng giờ.</span>
          </h1>
          <p>
            FreshLink kết nối trực tiếp các chuỗi nhà hàng F&B với mạng lưới hợp tác xã nông sản sạch, đảm bảo kiểm soát nhiệt độ từ nông trại đến gian bếp và điều phối giao nhận tức thời trong ngày.
          </p>
          <div className="actions">
            <Link className="button" to="/register">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>rocket_launch</span>
              Đăng ký hợp tác ngay
            </Link>
            <a className="button secondary" href="#workflow">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>account_tree</span>
              Khám phá quy trình
            </a>
            <Link className="button secondary" to="/login">
              Vào Portal vận hành →
            </Link>
          </div>
        </div>

        {/* Live Hero KPI Card */}
        <aside className="hero-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>
              <span className="material-symbols-outlined" style={{ color: '#a4f4c3' }}>sensors</span>
              Trung tâm kiểm soát chuỗi lạnh
            </h3>
            <span className="eyebrow" style={{ background: 'rgba(164,244,195,0.2)', color: '#a4f4c3', borderColor: 'transparent', padding: '4px 10px' }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#a4f4c3', marginRight: 5, animation: 'pulse-radar 1.5s infinite' }} />
              Live Hub HN-02
            </span>
          </div>
          <p className="subtitle">Chỉ số vận hành mạng lưới cung ứng thời gian thực:</p>
          
          <div className="hero-stat-row">
            <span>Tỷ lệ giao đúng giờ (On-Time)</span>
            <strong style={{ color: '#a4f4c3' }}>99.8%</strong>
          </div>
          <div className="hero-stat-row">
            <span>Thời gian từ thu hoạch đến bếp</span>
            <strong>&lt; 3.5 giờ</strong>
          </div>
          <div className="hero-stat-row">
            <span>Tỷ lệ đạt chuẩn KCS FreshLink Gate</span>
            <strong style={{ color: '#a4f4c3' }}>98.2%</strong>
          </div>
          <div className="hero-stat-row">
            <span>Nhiệt độ thùng bảo quản SmartCrate</span>
            <strong style={{ color: '#88d7a8' }}>+3.4°C (Đạt)</strong>
          </div>
          <div className="hero-stat-row">
            <span>Tồn kho lưu cữu qua đêm</span>
            <strong style={{ color: '#ffffff' }}>0 kg</strong>
          </div>
        </aside>
      </section>

      {/* 4 Roles Section */}
      <section className="section" id="solutions">
        <span className="eyebrow">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>groups</span>
          Hệ sinh thái liên kết 4 bên
        </span>
        <h2>Thông tin minh bạch và đồng bộ trên từng chặng hàng hóa</h2>
        <div className="role-grid">
          {roles.map((r) => (
            <article className="role-card" key={r.title}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="role-num">{r.num}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#176b45' }}>{r.icon}</span>
              </div>
              <h3>{r.title}</h3>
              <p>{r.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 5 Steps Process Section */}
      <section className="section process" id="workflow">
        <span className="eyebrow">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
          Mô hình Cross-dock tốc độ cao
        </span>
        <h2>5 bước luân chuyển khép kín — Không lưu thực phẩm qua đêm</h2>
        <div className="steps">
          {steps.map((s) => (
            <div className="step" key={s.title}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <b>{s.num}</b>
                <span className="material-symbols-outlined" style={{ color: '#176b45' }}>{s.icon}</span>
              </div>
              <p style={{ marginTop: 12, marginBottom: 6 }}>{s.title}</p>
              <span style={{ fontSize: '0.85rem', color: '#4e655c', lineHeight: 1.4, display: 'block' }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Cold-Chain Network Map Section */}
      <section className="section" style={{ padding: '40px 0' }}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 28px' }}>
          <span className="eyebrow" style={{ display: 'inline-flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>share_location</span>
            Mạng lưới Kho vận & Vùng nguyên liệu
          </span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#005131', marginTop: 8 }}>
            Hệ Thống Hub Chuỗi Lạnh Toàn Quốc
          </h2>
          <p style={{ color: '#55625a' }}>
            Kết nối các vùng trồng VietGAP tại Mộc Châu, Đà Lạt với hệ sinh thái kho Cross-dock Hà Nội và TP. Hồ Chí Minh, đảm bảo nhiệt độ chuẩn +2°C ~ +6°C suốt hành trình.
          </p>
        </div>
        <FreshLinkMap
          title="Bản đồ Chuỗi cung ứng FreshLink (Hà Nội · Sơn La · Đà Lạt · TP.HCM)"
          subtitle="Các kho trung tâm, Hub tập kết và đội xe lạnh vệ tinh vận hành liên tục"
          hubs={[
            {hubId:1,code:'HUB-HN-01',name:'Hub Trung Tâm Hà Nội #01 (Bắc Thăng Long)',type:'CENTRAL_CROSS_DOCK',address:'KCN Bắc Thăng Long, Đông Anh, Hà Nội',district:'Đông Anh',city:'Hà Nội',latitude:21.1458,longitude:105.8452,temperatureC:3.4,humidityPercent:88,capacityCrates:3500,activeTrucks:18,phone:'0123456789'},
            {hubId:2,code:'HUB-HN-02',name:'Hub Trung Chuyển Hoàng Mai #02',type:'URBAN_CROSS_DOCK',address:'Km 12 Ngọc Hồi, Hoàng Mai, Hà Nội',district:'Hoàng Mai',city:'Hà Nội',latitude:20.9572,longitude:105.8488,temperatureC:3.8,humidityPercent:86,capacityCrates:2200,activeTrucks:12,phone:'0123456789'},
            {hubId:3,code:'HUB-MC-01',name:'Hub Vùng Nông Sản Mộc Châu (Tây Bắc)',type:'REGIONAL_COLLECTION_HUB',address:'TT. Nông Trường Mộc Châu, Sơn La',district:'Mộc Châu',city:'Sơn La',latitude:20.8436,longitude:104.6642,temperatureC:4.1,humidityPercent:91,capacityCrates:2800,activeTrucks:8,phone:'0123456789'},
            {hubId:4,code:'HUB-DL-01',name:'Hub Nông Sản Công Nghệ Cao Đà Lạt',type:'REGIONAL_COLLECTION_HUB',address:'Đường Vạn Thành, Phường 5, TP. Đà Lạt',district:'Đà Lạt',city:'Lâm Đồng',latitude:11.9404,longitude:108.4182,temperatureC:3.8,humidityPercent:89,capacityCrates:4000,activeTrucks:15,phone:'0123456789'},
            {hubId:5,code:'HUB-HCM-01',name:'Hub Trung Tâm Miền Nam (Củ Chi)',type:'CENTRAL_CROSS_DOCK',address:'KCN Tân Phú Trung, Củ Chi, TP.HCM',district:'Củ Chi',city:'TP. Hồ Chí Minh',latitude:10.9632,longitude:106.5298,temperatureC:3.6,humidityPercent:87,capacityCrates:4200,activeTrucks:22,phone:'0123456789'}
          ]}
          height="450px"
          zoom={6}
          center={[16.0, 107.5]}
        />
      </section>

      {/* Traceability Promo Banner */}
      <section className="section trace-promo" id="traceability">
        <div>
          <span className="eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>qr_code_2</span>
            Dữ liệu minh bạch đến từng bàn ăn
          </span>
          <h2>Quét một mã QR, xem trọn hành trình nông sản</h2>
          <p>
            Mỗi lô hàng xuất từ nông trại và từng thùng SmartCrate luân chuyển đều được gắn định danh duy nhất. Khách hàng và nhà hàng dễ dàng tra cứu nguồn gốc, chứng chỉ VietGAP, kết quả kiểm nghiệm và lịch sử chuỗi lạnh.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, maxWidth: 440 }}>
            <Input
              placeholder="Nhập mã lô hoặc mã thùng (VD: BATCH-HN-001)..."
              value={traceInput}
              onChange={(e) => setTraceInput(e.target.value)}
              onPressEnter={handleTrace}
              size="large"
              style={{ borderRadius: 10 }}
            />
            <Button type="primary" size="large" onClick={handleTrace} style={{ borderRadius: 10 }}>
              Tra cứu
            </Button>
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ background: '#ffffff', padding: 20, borderRadius: 18, boxShadow: '0 8px 24px rgba(23,107,69,0.12)', border: '1px solid #b8e2cd' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 84, color: '#176b45' }}>qr_code_scanner</span>
            <p style={{ margin: '8px 0 0', fontWeight: 700, color: '#173128' }}>Quét mã QR</p>
            <small style={{ color: '#7d938a' }}>Tem nhãn trên thùng SmartCrate</small>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  )
}
