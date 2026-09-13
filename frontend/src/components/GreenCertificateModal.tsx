import { Button, Modal, Tag } from 'antd'

export interface GreenCertificateData {
  certificateCode: string
  organizationId: number
  organizationName: string
  organizationType: string
  periodType: string
  periodStart: string
  periodEnd: string
  plasticSavedKg: number
  co2SavedKg: number
  cratesCirculated: number
  kmOptimized: number
  impactStatement: string
  verifyUrl: string
  qrImage: string
  issuedAt: string
}

export interface EsgSummaryData {
  organizationId: number
  organizationName: string
  organizationType: string
  periodType: string
  periodStart: string
  periodEnd: string
  plasticSavedKg: number
  co2SavedKg: number
  cratesCirculated: number
  kmOptimized: number
  orderOrBatchCount: number
  impactStatement: string
}


export function GreenCertificateModal({
  open,
  onClose,
  data
}: {
  open: boolean
  onClose: () => void
  data: GreenCertificateData | null
}) {
  if (!data) return null

  const handlePrint = () => {
    window.print()
  }

  const periodLabel = data.periodType === '60_DAYS' ? '2 tháng qua (60 ngày)' : data.periodType === '30_DAYS' ? '30 ngày qua' : 'Lũy kế toàn thời gian'

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={840}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
        <Button key="print" type="primary" onClick={handlePrint} style={{ background: '#176b45', fontWeight: 600 }}>
          🖨️ In Giấy Chứng Nhận / Lưu PDF
        </Button>
      ]}
    >
      <div className="printable-certificate" style={{
        background: '#ffffff',
        border: '10px double #059669',
        borderRadius: 16,
        padding: '36px 40px',
        margin: '10px 0',
        position: 'relative',
        boxShadow: '0 10px 30px rgba(5, 150, 105, 0.12)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Decorative corner accents */}
        <div style={{ position: 'absolute', top: 12, left: 16, fontSize: 24, color: '#10b981' }}>🌿</div>
        <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 24, color: '#10b981' }}>🌿</div>
        <div style={{ position: 'absolute', bottom: 12, left: 16, fontSize: 24, color: '#10b981' }}>🌱</div>
        <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 24, color: '#10b981' }}>🌱</div>

        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#059669' }}>eco</span>
            <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: '#064e3b' }}>
              FRESHLINK SUSTAINABLE ESG INITIATIVE
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#059669', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Chương Trình Phát Triển Chuỗi Cung Ứng Nông Sản Bền Vững & Kinh Tế Tuần Hoàn
          </div>
        </div>

        {/* Certificate Title */}
        <div style={{ textAlign: 'center', margin: '24px 0 16px' }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#065f46',
            margin: '0 0 6px',
            textTransform: 'uppercase',
            letterSpacing: 1
          }}>
            GIẤY CHỨNG NHẬN ĐỐI TÁC XANH TIÊU BIỂU
          </h1>
          <div style={{ fontSize: 16, color: '#047857', fontStyle: 'italic', fontWeight: 500 }}>
            Green Sustainable Partner Certificate
          </div>
        </div>

        {/* Recipient */}
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <div style={{ fontSize: 14, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>
            Trân trọng trao tặng:
          </div>
          <div style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#0f172a',
            margin: '8px 0',
            textDecoration: 'underline',
            textDecorationColor: '#10b981',
            textUnderlineOffset: '6px'
          }}>
            {data.organizationName}
          </div>
          <Tag color="success" style={{ fontSize: 12, padding: '2px 10px', fontWeight: 600, marginTop: 4 }}>
            {data.organizationType === 'RESTAURANT' ? 'NHÀ HÀNG XANH TIÊU BIỂU' : 'HỢP TÁC XÃ NÔNG NGHIỆP TUẦN HOÀN'}
          </Tag>
        </div>

        {/* Hero Impact Statement */}
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: '1.5px solid #86efac',
          borderRadius: 12,
          padding: '18px 24px',
          margin: '22px 0',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: 15.5,
            lineHeight: 1.7,
            color: '#064e3b',
            margin: 0,
            fontWeight: 500
          }}>
            {data.impactStatement}
          </p>
        </div>

        {/* 4 Quantified Impact Pillars */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          margin: '24px 0'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '14px 10px',
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <span style={{ fontSize: 26 }}>🌿</span>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: '4px 0 2px' }}>
              {data.plasticSavedKg} kg
            </div>
            <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 600, lineHeight: 1.3 }}>
              Túi Nilon / Rác Nhựa Cắt Giảm
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '14px 10px',
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <span style={{ fontSize: 26 }}>💨</span>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: '4px 0 2px' }}>
              {data.co2SavedKg} kg
            </div>
            <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 600, lineHeight: 1.3 }}>
              Khí Thải CO2e Tránh Phát Thải
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '14px 10px',
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <span style={{ fontSize: 26 }}>🔄</span>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: '4px 0 2px' }}>
              {data.cratesCirculated}
            </div>
            <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 600, lineHeight: 1.3 }}>
              Lượt Sọt Luân Chuyển SmartCrate
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '14px 10px',
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <span style={{ fontSize: 26 }}>🚚</span>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: '4px 0 2px' }}>
              {data.kmOptimized} km
            </div>
            <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 600, lineHeight: 1.3 }}>
              Quãng Đường Xe Lạnh AI Tối Ưu
            </div>
          </div>
        </div>

        {/* Footer: Seal, QR Verification & Signatures */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: 28,
          paddingTop: 16,
          borderTop: '1px dashed #cbd5e1'
        }}>
          {/* Official Seal / Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '3px solid #059669',
              background: '#ecfdf5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#065f46',
              boxShadow: '0 2px 8px rgba(5,150,105,0.2)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#059669' }}>verified_user</span>
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5 }}>CERTIFIED</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Mã đối soát chứng nhận:</div>
              <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>
                {data.certificateCode}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                Kỳ ghi nhận: {periodLabel}
              </div>
            </div>
          </div>

          {/* Dynamic QR code for Public Verification */}
          <div style={{ textAlign: 'center' }}>
            {data.qrImage ? (
              <img
                src={data.qrImage}
                alt="Mã QR Đối Soát ESG"
                style={{ width: 88, height: 88, border: '1px solid #cbd5e1', borderRadius: 6, padding: 4, background: '#ffffff' }}
              />
            ) : (
              <div style={{ width: 88, height: 88, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                QR Xác thực
              </div>
            )}
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
              Quét QR kiểm tra tính thật
            </div>
          </div>

          {/* Signatures */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Ngày cấp: {data.issuedAt}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#064e3b', marginTop: 4 }}>
              BAN ĐIỀU HÀNH CHUỖI CUNG ỨNG FRESHLINK
            </div>
            <div style={{ fontSize: 11.5, color: '#059669', fontStyle: 'italic' }}>
              (Đã ký số điện tử & Xác thực trên nền tảng)
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
