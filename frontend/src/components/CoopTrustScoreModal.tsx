import { useState, useEffect } from 'react'
import { Modal, Tag, Progress, Card, Spin, Alert, Button } from 'antd'
import { api } from '../api/http'

interface TrustDetail {
  organization_id: number
  organization_name: string
  organization_code: string
  supplier_type: string
  breakdown: {
    qualityScore: number
    fulfillmentScore: number
    certScore: number
    claimScore: number
    consistencyScore: number
    totalScore: number
    tierRank: string
    tierTitle: string
    tierBadgeColor: string
    metrics: {
      kcsRatePercent: number
      fulfillmentRatePercent: number
      hasVietgap: boolean
      hasFoodSafety: boolean
      complaintCount: number
      successfulBatches: number
      inspectionCount: number
      requestCount: number
    }
  }
}

export function CoopTrustScoreModal({
  supplierId,
  supplierName,
  open,
  onClose
}: {
  supplierId?: number
  supplierName?: string
  open: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TrustDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !supplierId) return
    setLoading(true)
    setError('')
    api<TrustDetail>(`/suppliers/${supplierId}/trust-detail`)
      .then(res => setData(res))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [open, supplierId])

  const b = data?.breakdown
  const m = b?.metrics

  const getTierTag = (tier?: string) => {
    switch (tier) {
      case 'DIAMOND_AAA':
        return <Tag color="#0284c7" style={{ fontWeight: 700, padding: '4px 12px', fontSize: 13 }}>💎 HẠNG KIM CƯƠNG (AAA)</Tag>
      case 'GOLD_AA':
        return <Tag color="#d97706" style={{ fontWeight: 700, padding: '4px 12px', fontSize: 13 }}>⭐ HẠNG VÀNG (AA)</Tag>
      case 'SILVER_A':
        return <Tag color="#64748b" style={{ fontWeight: 700, padding: '4px 12px', fontSize: 13 }}>🥈 HẠNG BẠC (A)</Tag>
      default:
        return <Tag color="#475569" style={{ fontWeight: 700, padding: '4px 12px', fontSize: 13 }}>🔰 HẠNG TIÊU CHUẨN (B)</Tag>
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} style={{ background: '#176b45' }}>
          Đã hiểu
        </Button>
      ]}
      width={720}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 28 }}>verified</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Bảng Điểm Tín Nhiệm & Độ Uy Tín Nguồn Cung</div>
            <small style={{ color: '#64748b', fontWeight: 400 }}>{supplierName || data?.organization_name || 'Hợp tác xã FreshLink'}</small>
          </div>
        </div>
      }
    >
      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>}
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

      {data && b && (
        <div style={{ marginTop: 12 }}>
          {/* Header Score Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1.5px solid #a7f3d0',
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: '#064e3b' }}>
                  {b.totalScore.toFixed(1)}
                </span>
                <span style={{ fontSize: 20, color: '#059669', fontWeight: 600 }}>/ 100 điểm</span>
              </div>
              <div style={{ color: '#047857', fontWeight: 600, fontSize: 14 }}>
                {b.tierTitle}
              </div>
            </div>
            <div>
              {getTierTag(b.tierRank)}
            </div>
          </div>

          {/* 5 Pillars Progress Breakdown */}
          <h4 style={{ color: '#1e293b', marginBottom: 14 }}>Chi tiết 5 Trụ Cột Đánh Giá Tín Nhiệm:</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Pillar 1: KCS Quality */}
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#0f172a' }}>1. Chất lượng KCS cổng Gate (Tối đa 35 điểm)</strong>
                <span style={{ fontWeight: 700, color: '#059669' }}>{b.qualityScore} / 35 đ</span>
              </div>
              <Progress percent={Math.round((b.qualityScore / 35) * 100)} strokeColor="#10b981" />
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                Tỷ lệ đạt KCS Gate: <strong>{m?.kcsRatePercent}%</strong> (Số lô đã qua kiểm định: {m?.inspectionCount} lô)
              </div>
            </Card>

            {/* Pillar 2: Fulfillment */}
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#0f172a' }}>2. Tỷ lệ cam kết cung ứng & giao đủ hàng (Tối đa 25 điểm)</strong>
                <span style={{ fontWeight: 700, color: '#059669' }}>{b.fulfillmentScore} / 25 đ</span>
              </div>
              <Progress percent={Math.round((b.fulfillmentScore / 25) * 100)} strokeColor="#06b6d4" />
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                Tỷ lệ đáp ứng đơn yêu cầu: <strong>{m?.fulfillmentRatePercent}%</strong> (Số yêu cầu tiếp nhận: {m?.requestCount})
              </div>
            </Card>

            {/* Pillar 3: Certifications */}
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#0f172a' }}>3. Tiêu chuẩn & Chứng nhận pháp lý (Tối đa 20 điểm)</strong>
                <span style={{ fontWeight: 700, color: '#059669' }}>{b.certScore} / 20 đ</span>
              </div>
              <Progress percent={Math.round((b.certScore / 20) * 100)} strokeColor="#8b5cf6" />
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, display: 'flex', gap: 10 }}>
                <span>VietGAP Quốc Gia: {m?.hasVietgap ? <Tag color="success">✓ Đạt (+15đ)</Tag> : <Tag color="default">Chưa có</Tag>}</span>
                <span>An Toàn Thực Phẩm: {m?.hasFoodSafety ? <Tag color="success">✓ Đạt (+5đ)</Tag> : <Tag color="default">Chưa có</Tag>}</span>
              </div>
            </Card>

            {/* Pillar 4: Claims */}
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#0f172a' }}>4. Độ tin cậy & Tỷ lệ khiếu nại (Tối đa 10 điểm)</strong>
                <span style={{ fontWeight: 700, color: '#059669' }}>{b.claimScore} / 10 đ</span>
              </div>
              <Progress percent={Math.round((b.claimScore / 10) * 100)} strokeColor="#f59e0b" />
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                Số lần phát sinh khiếu nại chất lượng: <strong>{m?.complaintCount} vụ</strong>
              </div>
            </Card>

            {/* Pillar 5: Consistency */}
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ color: '#0f172a' }}>5. Thâm niên & Quy mô hợp tác (Tối đa 10 điểm)</strong>
                <span style={{ fontWeight: 700, color: '#059669' }}>{b.consistencyScore} / 10 đ</span>
              </div>
              <Progress percent={Math.round((b.consistencyScore / 10) * 100)} strokeColor="#3b82f6" />
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                Tổng số lô hàng cung cấp thành công: <strong>{m?.successfulBatches} lô</strong>
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 12.5, color: '#475569' }}>
            💡 <strong>Ý nghĩa đối với Nhà hàng:</strong> Điểm tín nhiệm được tính toán tự động dựa trên dữ liệu vận hành thực tế tại cổng kiểm định Gate FreshLink. Các HTX hạng Kim Cương (AAA) và Vàng (AA) cam kết nông sản luôn tươi mới, quy chuẩn đồng đều và xuất xứ chuẩn VietGAP.
          </div>
        </div>
      )}
    </Modal>
  )
}
