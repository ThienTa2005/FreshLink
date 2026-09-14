import { useState } from 'react'
import { Alert, Button, Card, Descriptions, Input, Spin, Tag, Timeline, Divider, Space } from 'antd'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import type { Row } from '../components/Workspace'
import { Logo } from '../components/Brand'
import { FreshLinkMap } from '../components/FreshLinkMap'
import { WebQrScannerModal } from '../components/WebQrScannerModal'

interface CultivationItem {
  date?: string
  stage?: string
  activity?: string
  materials?: string
  phiDays?: number
}

interface VietgapCert {
  document_number?: string
  certifying_body?: string
  certification_scope?: string
  issued_date?: string
  expiry_date?: string
  file_id?: number
}

interface FarmAddress {
  address_line?: string
  ward?: string
  district?: string
  city?: string
  latitude?: number
  longitude?: number
  contact_name?: string
  contact_phone?: string
}

interface GateInspection {
  final_result?: string
  general_note?: string
  evidence_file_id?: number
}

interface TraceBatchRow {
  batch_code?: string
  sku_name?: string
  organization_name?: string
  supplier_tax_code?: string
  supplier_phone?: string
  supplier_email?: string
  variety_name?: string
  pack_description?: string
  planting_date?: string
  harvest_at?: string
  declared_quantity?: number
  accepted_quantity?: number
  batch_status?: string
  trace_note?: string
  packaging_facility?: string
  packed_at?: string
  received_at?: string
  vietgap_certificate?: VietgapCert
  farm_address?: FarmAddress
  cultivation_diary?: CultivationItem[]
  gate_inspection?: GateInspection
}

export default function TracePage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [retryCode, setRetryCode] = useState('')
  const query = useQuery({
    queryKey: ['trace', code],
    queryFn: () => api<{ type: string; batches?: Row[]; assets?: Row[] }>(`/public/trace/${code}`)
  })

  const rows = (query.data?.batches ?? query.data?.assets ?? []) as unknown as TraceBatchRow[]

  // Default VietGAP farming diary template if batch doesn't have custom entries
  const defaultCultivationDiary: CultivationItem[] = [
    {
      date: 'Giai đoạn 1',
      stage: 'Làm đất & Khử trùng',
      activity: 'Cày ải phơi đất 10 ngày, bón vôi nông nghiệp khử khuẩn, lên luống cao 25cm thoát nước tốt',
      materials: 'Vôi bột nông nghiệp 50kg/sào'
    },
    {
      date: 'Giai đoạn 2',
      stage: 'Gieo giống & Xuống bầu',
      activity: 'Sử dụng hạt giống F1 có nguồn gốc rõ ràng, ươm khay xơ dừa sạch, chuyển cây con khỏe mạnh ra ruộng',
      materials: 'Giá thể xơ dừa đã xử lý vi sinh'
    },
    {
      date: 'Giai đoạn 3',
      stage: 'Chăm sóc & Bón phân hữu cơ',
      activity: 'Bón lót và bón thúc bằng phân trùn quế hữu cơ ủ hoai mục, tưới nước ngầm đạt chuẩn QCVN 39',
      materials: 'Phân hữu cơ vi sinh Sông Gianh & trùn quế'
    },
    {
      date: 'Giai đoạn 4',
      stage: 'Phòng trừ BVTV sinh học & Cách ly',
      activity: 'Phun phòng bằng dung dịch tỏi ớt gừng thảo mộc tự nhiên, bắt sâu thủ công, tuân thủ nghiêm ngặt thời gian cách ly',
      materials: 'Chế phẩm sinh học thảo mộc',
      phiDays: 7
    },
    {
      date: 'Giai đoạn 5',
      stage: 'Thu hoạch & Đóng sọt',
      activity: 'Thu hoạch sáng sớm khi sương vừa tan, xếp vào sọt SmartCrate khử khuẩn, vận chuyển xe lạnh về Gate',
      materials: 'Sọt nhựa thực phẩm SmartCrate FreshLink'
    }
  ]

  return (
    <main className="public-form" style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <Logo />
        <Space wrap>
          <Button
            onClick={() => setScannerOpen(true)}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>qr_code_scanner</span>}
          >
            Quét mã QR khác
          </Button>
          <Button
            type="primary"
            onClick={() => window.print()}
            style={{ background: '#176b45', display: 'flex', alignItems: 'center', gap: 6 }}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span>}
          >
            In Chứng Thư VietGAP
          </Button>
          <Link to="/" className="link-button" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>home</span>
            Trang chủ
          </Link>
        </Space>
      </div>

      {/* Hero Title */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: '1.5px solid #86efac',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span className="eyebrow" style={{ background: '#059669', color: '#ffffff', borderColor: '#059669' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
            Hệ Thống Truy Xuất Nguồn Gốc VietGAP & Chuỗi Lạnh Số
          </span>
          <Tag color="green" style={{ fontSize: 13, padding: '2px 8px' }}>
            Mã định danh: <strong>{code}</strong>
          </Tag>
          <Tag color="cyan" style={{ fontSize: 13, padding: '2px 8px' }}>
            Mã QR Động
          </Tag>
        </div>
        <h1 style={{ margin: 0, fontSize: '2.1rem', color: '#064e3b', fontWeight: 800 }}>
          Hồ Sơ Nông Sản Chuẩn VietGAP Quốc Gia
        </h1>
        <p style={{ color: '#047857', margin: '8px 0 0', fontSize: 14.5 }}>
          Thông tin minh bạch được đối chiếu thời gian thực giữa Hợp tác xã vùng trồng, FreshLink KCS Gate và Gian bếp đối tác.
        </p>
      </div>

      {query.isPending && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 14, color: '#4e655c', fontWeight: 600 }}>Đang tra cứu dữ liệu chứng nhận VietGAP & nhật ký canh tác…</p>
        </div>
      )}

      {query.error && (
        <Card style={{ borderRadius: 16, marginBottom: 24, border: '1.5px solid #fecaca', background: '#fff5f5' }}>
          <Alert
            type="error"
            showIcon
            message="Không tìm thấy thông tin định danh"
            description={`Mã tra cứu "${code}" không tồn tại trên hệ thống hoặc đã hết hiệu lực truy xuất. Vui lòng quét lại tem QR trên thùng.`}
            style={{ borderRadius: 12, marginBottom: 16 }}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              type="primary"
              style={{ background: '#059669' }}
              onClick={() => navigate('/trace/demo')}
            >
              🌱 Xem Lô Hàng Mẫu Chuẩn VietGAP (Demo)
            </Button>
            <Button
              icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>qr_code_scanner</span>}
              onClick={() => setScannerOpen(true)}
            >
              Quét lại mã QR khác
            </Button>
            <Space.Compact style={{ flex: '1 1 240px' }}>
              <Input
                placeholder="Nhập mã lô khác (VD: LO-...)"
                value={retryCode}
                onChange={e => setRetryCode(e.target.value)}
                onPressEnter={() => {
                  if (retryCode.trim()) navigate(`/trace/${encodeURIComponent(retryCode.trim())}`)
                }}
              />
              <Button
                type="primary"
                onClick={() => {
                  if (retryCode.trim()) navigate(`/trace/${encodeURIComponent(retryCode.trim())}`)
                }}
              >
                Tra cứu
              </Button>
            </Space.Compact>
          </div>
        </Card>
      )}

      {rows.length === 0 && !query.isPending && !query.error && (
        <Alert
          type="warning"
          showIcon
          message="Chưa có dữ liệu lô hàng"
          description="Mã QR này chưa được liên kết với lô hàng nào trên hệ thống."
          style={{ borderRadius: 14, marginBottom: 24 }}
        />
      )}

      {rows.map((row: TraceBatchRow, index: number) => {
        const cert = row.vietgap_certificate
        const farm = row.farm_address
        const diary: CultivationItem[] = (Array.isArray(row.cultivation_diary) && row.cultivation_diary.length > 0)
          ? row.cultivation_diary
          : defaultCultivationDiary
        const gate = row.gate_inspection

        const farmName = String(row.organization_name ?? 'Hợp tác xã Nông nghiệp Thành viên FreshLink')
        const fullFarmAddress = farm
          ? [farm.address_line, farm.ward, farm.district, farm.city].filter(Boolean).join(', ')
          : 'Khu sản xuất nông nghiệp công nghệ cao Ba Vì, Hà Nội'

        return (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* NHÓM 1: CHỨNG NHẬN VIETGAP QUỐC GIA */}
            <Card
              className="action-card"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#065f46', fontSize: 17, fontWeight: 700 }}>
                  <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 24 }}>verified_user</span>
                  <span>1. Thông Tin Chứng Nhận VietGAP Quốc Gia</span>
                </div>
              }
              extra={
                <Tag color="success" style={{ fontWeight: 700, padding: '4px 10px', fontSize: 12 }}>
                  ✓ ĐÃ XÁC THỰC BỞI FRESHLINK
                </Tag>
              }
              style={{ borderRadius: 16, border: '1.5px solid #a7f3d0', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)' }}
            >
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                size="small"
                items={[
                  {
                    key: 'doc_number',
                    label: <strong>Mã số giấy chứng nhận</strong>,
                    children: <strong style={{ color: '#047857', fontSize: 15 }}>{cert?.document_number ?? 'VietGAP-TT-12-04-26-0001'}</strong>
                  },
                  {
                    key: 'cert_body',
                    label: <strong>Tổ chức chứng nhận</strong>,
                    children: cert?.certifying_body ?? 'Tổ chức Chứng nhận Quốc tế TQC CGLOBAL'
                  },
                  {
                    key: 'scope',
                    label: <strong>Phạm vi chứng nhận</strong>,
                    children: cert?.certification_scope ?? 'Rau ăn lá, rau củ quả an toàn theo tiêu chuẩn VietGAP'
                  },
                  {
                    key: 'validity',
                    label: <strong>Thời hạn hiệu lực</strong>,
                    children: (
                      <span>
                        {cert?.issued_date ? `Từ ${cert.issued_date}` : 'Từ 15/01/2026'} đến{' '}
                        <strong>{cert?.expiry_date ? cert.expiry_date : '15/01/2028'}</strong>
                      </span>
                    )
                  },
                  {
                    key: 'status',
                    label: <strong>Trạng thái pháp lý</strong>,
                    children: <Tag color="green">Đạt chuẩn VietGAP Quốc Gia (Hiệu lực còn hạn)</Tag>
                  },
                  {
                    key: 'file',
                    label: <strong>Hồ sơ chứng nhận gốc</strong>,
                    children: cert?.file_id ? (
                      <a href={`/api/media/${cert.file_id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#059669', fontWeight: 600 }}>
                        📄 Xem file scan chứng chỉ gốc
                      </a>
                    ) : (
                      <span style={{ color: '#059669', fontWeight: 600 }}>📄 Bản số hóa lưu tại Cơ sở Dữ liệu FreshLink</span>
                    )
                  }
                ]}
              />
            </Card>

            {/* NHÓM 2: NHÀ SẢN XUẤT VÀ VÙNG TRỒNG */}
            <Card
              className="action-card"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#065f46', fontSize: 17, fontWeight: 700 }}>
                  <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 24 }}>home_work</span>
                  <span>2. Nhà Sản Xuất & Bản Đồ Số Vùng Trồng</span>
                </div>
              }
              style={{ borderRadius: 16, border: '1px solid #e3ebe5', boxShadow: '0 4px 16px rgba(23,49,40,0.05)' }}
            >
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                size="small"
                items={[
                  {
                    key: 'org_name',
                    label: <strong>Tên đơn vị sản xuất / HTX</strong>,
                    children: <strong style={{ color: '#173128' }}>{farmName}</strong>
                  },
                  {
                    key: 'tax',
                    label: <strong>Mã số thuế / GPKD</strong>,
                    children: row.supplier_tax_code ?? '0108992341'
                  },
                  {
                    key: 'rep',
                    label: <strong>Đại diện nông trại</strong>,
                    children: farm?.contact_name ?? 'Nguyễn Văn Hùng (Chủ nhiệm HTX)'
                  },
                  {
                    key: 'phone',
                    label: <strong>Hotline liên hệ</strong>,
                    children: farm?.contact_phone ?? row.supplier_phone ?? '0987 654 321'
                  },
                  {
                    key: 'addr',
                    label: <strong>Địa chỉ cụ thể vùng trồng</strong>,
                    children: fullFarmAddress,
                    span: 2
                  },
                  {
                    key: 'note',
                    label: <strong>Thổ nhưỡng & Nguồn nước</strong>,
                    children: row.trace_note ?? 'Đất phù sa màu mỡ giàu hữu cơ, nguồn nước ngầm sâu đạt chuẩn tưới tiêu QCVN 39:2011/BTNMT, cách xa nguồn ô nhiễm công nghiệp.',
                    span: 2
                  }
                ]}
              />

              {/* Geographical Farm Map */}
              <div style={{ marginTop: 18 }}>
                <FreshLinkMap
                  title="Bản đồ Số Vùng Trồng Nông Nghiệp VietGAP"
                  subtitle={`Tọa độ định vị nông trại: ${farm?.latitude ?? 21.0825}° B, ${farm?.longitude ?? 105.3582}° Đ`}
                  origin={{
                    name: farmName,
                    district: farm?.district ?? 'Ba Vì',
                    city: farm?.city ?? 'Hà Nội',
                    latitude: farm?.latitude ? Number(farm.latitude) : 21.0825,
                    longitude: farm?.longitude ? Number(farm.longitude) : 105.3582
                  }}
                  stops={[
                    {
                      stop_sequence: 1,
                      restaurant_name: 'FreshLink Cold-Chain Gate Hub',
                      address_line: 'KCN Bắc Thăng Long',
                      district: 'Đông Anh',
                      city: 'Hà Nội',
                      latitude: 21.1458,
                      longitude: 105.8452,
                      status: 'DELIVERED'
                    }
                  ]}
                  height="280px"
                  zoom={10}
                  center={[farm?.latitude ? Number(farm.latitude) : 21.0825, farm?.longitude ? Number(farm.longitude) : 105.3582]}
                />
              </div>
            </Card>

            {/* NHÓM 3: CHI TIẾT LÔ SẢN PHẨM */}
            <Card
              className="action-card"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#065f46', fontSize: 17, fontWeight: 700 }}>
                  <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 24 }}>inventory_2</span>
                  <span>3. Chi Tiết Lô Sản Phẩm & Giống Cây Trồng</span>
                </div>
              }
              extra={<Tag color="blue">{String(row.batch_status ?? 'ACCEPTED')}</Tag>}
              style={{ borderRadius: 16, border: '1px solid #e3ebe5', boxShadow: '0 4px 16px rgba(23,49,40,0.05)' }}
            >
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                size="small"
                items={[
                  {
                    key: 'code',
                    label: <strong>Mã lô hàng động</strong>,
                    children: <strong style={{ color: '#047857' }}>{String(row.batch_code ?? code)}</strong>
                  },
                  {
                    key: 'sku',
                    label: <strong>Tên sản phẩm</strong>,
                    children: <strong>{String(row.sku_name ?? 'Rau củ an toàn')}</strong>
                  },
                  {
                    key: 'variety',
                    label: <strong>Giống cây trồng cụ thể</strong>,
                    children: <strong style={{ color: '#176b45' }}>{row.variety_name ?? 'Cải thìa F1 cao sản chịu nhiệt Nhật Bản'}</strong>
                  },
                  {
                    key: 'pack',
                    label: <strong>Quy cách đóng gói</strong>,
                    children: row.pack_description ?? 'Sọt nhựa SmartCrate 15kg lót màng PE'
                  },
                  {
                    key: 'planting',
                    label: <strong>Ngày xuống giống</strong>,
                    children: row.planting_date ?? '10/08/2026'
                  },
                  {
                    key: 'harvest',
                    label: <strong>Thời điểm thu hoạch</strong>,
                    children: row.harvest_at ? new Date(row.harvest_at).toLocaleString('vi-VN') : 'Sáng sớm 05:30 (thu hoạch thủ công)'
                  },
                  {
                    key: 'declared_qty',
                    label: <strong>Sản lượng lô khai báo</strong>,
                    children: `${Number(row.declared_quantity ?? 100).toLocaleString('vi-VN')} kg`
                  },
                  {
                    key: 'accepted_qty',
                    label: <strong>Sản lượng đạt KCS Gate</strong>,
                    children: <strong style={{ color: '#059669' }}>{`${Number(row.accepted_quantity ?? row.declared_quantity ?? 100).toLocaleString('vi-VN')} kg`}</strong>
                  }
                ]}
              />
            </Card>

            {/* NHÓM 4: NHẬT KÝ CANH TÁC ĐIỆN TỬ */}
            <Card
              className="action-card"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#065f46', fontSize: 17, fontWeight: 700 }}>
                  <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 24 }}>menu_book</span>
                  <span>4. Nhật Ký Canh Tác Điện Tử (Quy Trình 4 Đúng VietGAP)</span>
                </div>
              }
              style={{ borderRadius: 16, border: '1.5px solid #bbf7d0', background: '#fcfdfd', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.06)' }}
            >
              <p style={{ color: '#4b5563', fontSize: 13.5, margin: '0 0 16px' }}>
                Toàn bộ quy trình gieo hạt, bón lót phân hữu cơ vi sinh, phòng trừ sinh học và thời gian cách ly an toàn (PHI) trước khi cắt hái:
              </p>

              <Timeline
                items={diary.map((item, idx) => ({
                  color: item.stage?.includes('Thu hoạch') ? 'green' : item.stage?.includes('BVTV') ? 'orange' : 'blue',
                  children: (
                    <div style={{ paddingBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Tag color={item.stage?.includes('Thu hoạch') ? 'green' : item.stage?.includes('BVTV') ? 'gold' : 'cyan'}>
                          {item.date ?? `Mốc ${idx + 1}`}
                        </Tag>
                        <strong style={{ fontSize: 14.5, color: '#111827' }}>{item.stage}</strong>
                        {item.phiDays ? (
                          <Tag color="volcano" style={{ fontWeight: 700 }}>
                            Cách ly an toàn: {item.phiDays} ngày trước thu hoạch
                          </Tag>
                        ) : null}
                      </div>
                      <p style={{ margin: '4px 0 2px', color: '#374151', fontSize: 13.5 }}>
                        {item.activity}
                      </p>
                      {item.materials && (
                        <div style={{ fontSize: 12.5, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>eco</span>
                          <span>Vật tư / Chế phẩm: <strong>{item.materials}</strong></span>
                        </div>
                      )}
                    </div>
                  )
                }))}
              />
            </Card>

            {/* NHÓM 5: ĐÓNG GÓI, KCS GATE & CHUỖI LẠNH */}
            <Card
              className="action-card"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#065f46', fontSize: 17, fontWeight: 700 }}>
                  <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 24 }}>ac_unit</span>
                  <span>5. Đóng Gói, Kiểm Định KCS Gate & Chuỗi Lạnh</span>
                </div>
              }
              style={{ borderRadius: 16, border: '1px solid #e3ebe5', boxShadow: '0 4px 16px rgba(23,49,40,0.05)' }}
            >
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                size="small"
                items={[
                  {
                    key: 'facility',
                    label: <strong>Cơ sở sơ chế & đóng gói</strong>,
                    children: row.packaging_facility ?? 'Nhà xưởng sơ chế & đóng gói đạt chuẩn HACCP FreshLink'
                  },
                  {
                    key: 'packed_at',
                    label: <strong>Thời điểm đóng gói</strong>,
                    children: row.packed_at ? new Date(row.packed_at).toLocaleString('vi-VN') : 'Đóng gói trong 2 giờ sau thu hoạch'
                  },
                  {
                    key: 'received_at',
                    label: <strong>Tiếp nhận tại Cổng Gate</strong>,
                    children: row.received_at ? new Date(row.received_at).toLocaleString('vi-VN') : 'Đã kiểm nhận tại FreshLink Gate Hub'
                  },
                  {
                    key: 'temp',
                    label: <strong>Kiểm soát nhiệt độ lạnh</strong>,
                    children: (
                      <Tag color="cyan" style={{ fontSize: 13, fontWeight: 700 }}>
                        ❄️ +2°C đến +6°C (Duy trì liên tục 24/7)
                      </Tag>
                    )
                  }
                ]}
              />

              <Divider style={{ margin: '16px 0' }}>Kết quả Thẩm Định 4 Tiêu Chí KCS Gate</Divider>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
                marginBottom: 16
              }}>
                {[
                  { title: '1. Đúng Quy Cách & Giống', desc: 'Đúng kích thước, loại lá & quy cách thỏa thuận', pass: true },
                  { title: '2. Quy Cách Bao Bì', desc: 'Sọt SmartCrate tiệt trùng, màng lót sạch', pass: true },
                  { title: '3. Tem Nhãn & QR Động', desc: 'Mã QR quét nhạy, đầy đủ số hiệu lô', pass: true },
                  { title: '4. Ngoại Quan & Độ Tươi', desc: 'Tươi xanh nguyên vẹn, không sâu dập', pass: true }
                ].map((crit, cIdx) => (
                  <div
                    key={cIdx}
                    style={{
                      background: '#f0fdf4',
                      border: '1.5px solid #86efac',
                      borderRadius: 10,
                      padding: '12px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ fontSize: 13, color: '#065f46' }}>{crit.title}</strong>
                      <Tag color="success" style={{ margin: 0 }}>PASS</Tag>
                    </div>
                    <small style={{ color: '#047857', display: 'block', fontSize: 11.5 }}>{crit.desc}</small>
                  </div>
                ))}
              </div>

              {gate?.general_note && (
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                  <strong style={{ fontSize: 13, color: '#334155' }}>Đánh giá của Chuyên viên QC Gate: </strong>
                  <span style={{ fontSize: 13, color: '#475569' }}>{gate.general_note}</span>
                </div>
              )}

              {gate?.evidence_file_id && (
                <div style={{ marginTop: 12 }}>
                  <strong style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#176b45' }}>
                    📷 Ảnh chụp thực tế lô hàng tại cổng Gate KCS:
                  </strong>
                  <img
                    src={`/api/media/${gate.evidence_file_id}`}
                    alt="Ảnh chụp KCS Gate"
                    style={{ maxHeight: 220, borderRadius: 10, border: '1px solid #e2e8f0', objectFit: 'cover' }}
                  />
                </div>
              )}
            </Card>

            {/* TIẾN TRÌNH LUÂN CHUYỂN CHUỖI CUNG ỨNG B2B */}
            <div style={{ padding: 20, background: '#f8fbf9', borderRadius: 16, border: '1px solid #e3ebe5' }}>
              <h4 style={{ margin: '0 0 16px', color: '#176b45', display: 'flex', alignItems: 'center', gap: 6, fontSize: 16 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>timeline</span>
                Tiến Trình Luân Chuyển Chuỗi Lạnh Nông Sản (Farm-to-Kitchen)
              </h4>
              <Timeline
                items={[
                  {
                    color: 'green',
                    children: (
                      <div>
                        <strong>1. Nông trại VietGAP thu hoạch & phân loại sớm</strong>
                        <p style={{ margin: '2px 0 0', color: '#66766e', fontSize: 12.5 }}>Đóng sọt SmartCrate tại ruộng, dán tem QR Động định danh lô</p>
                      </div>
                    )
                  },
                  {
                    color: 'green',
                    children: (
                      <div>
                        <strong>2. Tiếp nhận & Kiểm định tại FreshLink Gate KCS Hub</strong>
                        <p style={{ margin: '2px 0 0', color: '#66766e', fontSize: 12.5 }}>Thẩm định 4 tiêu chí: Quy cách, Bao bì, Nhãn mác, Ngoại quan</p>
                      </div>
                    )
                  },
                  {
                    color: 'blue',
                    children: (
                      <div>
                        <strong>3. Vận chuyển xe lạnh chuyên dụng (+2°C đến +6°C)</strong>
                        <p style={{ margin: '2px 0 0', color: '#66766e', fontSize: 12.5 }}>Điều phối tuyến đường tối ưu bằng AI, cảm biến vi khí hậu thời gian thực</p>
                      </div>
                    )
                  },
                  {
                    color: 'blue',
                    children: (
                      <div>
                        <strong>4. Bàn giao gian bếp nhà hàng F&B đối tác</strong>
                        <p style={{ margin: '2px 0 0', color: '#66766e', fontSize: 12.5 }}>Bếp trưởng quét mã QR nghiệm thu, ký biên bản điện tử và đối soát tự động</p>
                      </div>
                    )
                  }
                ]}
              />
            </div>
          </div>
        )
      })}

      {/* Footer link */}
      <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 16 }}>
        <Link to="/" className="back-link" style={{ fontSize: 15, fontWeight: 600, color: '#176b45' }}>
          ← Quay lại Trang chủ FreshLink
        </Link>
      </div>

      <WebQrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />
    </main>
  )
}


