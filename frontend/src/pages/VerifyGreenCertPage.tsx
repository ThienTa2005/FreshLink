import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Spin, Alert, Card, Tag, Button } from 'antd'
import { api } from '../api/http'
import { Logo } from '../components/Brand'

interface VerifiedCert {
  certificate_id: number
  certificate_code: string
  organization_id: number
  organization_type: string
  organization_name: string
  organization_code: string
  period_type: string
  period_start: string
  period_end: string
  plastic_saved_kg: number
  co2_saved_kg: number
  crates_circulated: number
  km_optimized: number
  verified_by_freshlink: boolean
  issued_at: string
  impactStatement: string
  verifyUrl: string
  qrImage: string
}

export default function VerifyGreenCertPage() {
  const { code } = useParams<{ code: string }>()
  const [loading, setLoading] = useState(true)
  const [cert, setCert] = useState<VerifiedCert | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    setLoading(true)
    setError('')
    api<VerifiedCert>(`/public/verify-cert/${code}`)
      .then(res => setCert(res))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [code])

  const periodLabel = cert?.period_type === '60_DAYS' ? '2 tháng qua' : cert?.period_type === '30_DAYS' ? 'tháng qua' : 'lũy kế'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <Logo />
        </div>

        {loading && (
          <Card style={{ textAlign: 'center', padding: 48, borderRadius: 16 }}>
            <Spin size="large" tip="Đang kiểm tra dữ liệu chứng nhận đối tác xanh từ FreshLink..." />
          </Card>
        )}

        {error && (
          <Card style={{ borderRadius: 16, border: '1.5px solid #fecaca' }}>
            <Alert
              type="error"
              showIcon
              message="Không tìm thấy hoặc Chứng Nhận không hợp lệ"
              description={`Mã chứng nhận "${code}" không tồn tại trong hệ sinh thái xác thực của FreshLink.`}
            />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/">
                <Button type="primary">Về trang chủ FreshLink</Button>
              </Link>
            </div>
          </Card>
        )}

        {cert && (
          <Card
            style={{
              borderRadius: 20,
              boxShadow: '0 10px 30px rgba(5, 150, 105, 0.1)',
              border: '2px solid #86efac',
              overflow: 'hidden'
            }}
          >
            {/* Header Success Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              margin: '-24px -24px 24px -24px',
              padding: '28px 24px',
              textAlign: 'center'
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 38, color: '#ffffff' }}>
                  verified
                </span>
              </div>
              <h2 style={{ margin: '0 0 6px', color: '#ffffff', fontSize: 24, fontWeight: 800 }}>
                CHỨNG NHẬN ĐỐI TÁC XANH HỢP LỆ & CHÍNH HÃNG
              </h2>
              <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
                Hệ thống xác thực minh bạch phát triển bền vững chuỗi cung ứng FreshLink ESG
              </p>
            </div>

            {/* Recipient details */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                Đơn vị được vinh danh:
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '4px 0 8px' }}>
                {cert.organization_name}
              </h3>
              <Tag color="success" style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                {cert.organization_type === 'RESTAURANT' ? '🍽️ ĐỐI TÁC NHÀ HÀNG XANH' : '🌾 HỢP TÁC XÃ NÔNG NGHIỆP TUẦN HOÀN'}
              </Tag>
            </div>

            {/* Statement Box */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 14,
              padding: '18px 20px',
              marginBottom: 24,
              fontSize: 15,
              lineHeight: 1.7,
              color: '#065f46',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {cert.impactStatement}
            </div>

            {/* Metric Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 24
            }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 28 }}>🌿</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: '4px 0' }}>
                  {cert.plastic_saved_kg} kg
                </div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  Rác thải nhựa cắt giảm
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 28 }}>💨</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: '4px 0' }}>
                  {cert.co2_saved_kg} kg
                </div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  Khí thải CO2e tránh phát sinh
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 28 }}>🔄</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: '4px 0' }}>
                  {cert.crates_circulated}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  Lượt sọt SmartCrate tuần hoàn
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 28 }}>🚚</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: '4px 0' }}>
                  {cert.km_optimized} km
                </div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  Km xe lạnh AI tối ưu
                </div>
              </div>
            </div>

            {/* Verification Metadata Box */}
            <div style={{
              borderTop: '1px dashed #cbd5e1',
              paddingTop: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: 13,
              color: '#64748b'
            }}>
              <div>
                <div>Mã chứng nhận: <strong style={{ color: '#065f46', fontFamily: 'monospace' }}>{cert.certificate_code}</strong></div>
                <div>Kỳ đo lường: <strong>{cert.period_start} đến {cert.period_end} ({periodLabel})</strong></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Tag color="green">✓ XÁC THỰC BỞI FRESHLINK ESG</Tag>
                <div style={{ fontSize: 11, marginTop: 4 }}>Cấp ngày: {cert.issued_at?.slice(0, 10)}</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link to="/">
                <Button type="dashed">
                  Tìm hiểu thêm về Chuỗi Cung Ứng Xanh FreshLink
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
