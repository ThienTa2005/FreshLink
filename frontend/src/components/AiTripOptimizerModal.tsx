import React, { useEffect, useState } from 'react'
import { Modal, Button, Card, Tag, Space, Typography, Progress, Alert, Select, Spin, Badge } from 'antd'
import { api } from '../api/http'
import { display } from './permissions'
import { FreshLinkMap, type MultiTripRoute } from './FreshLinkMap'
import type { Row } from './Workspace'

export interface CandidateOrder {
  orderId: number
  orderCode: string
  restaurantId: number
  restaurantName: string
  receivingStartTime: string
  receivingEndTime: string
  totalAmount: number
  addressId: number
  addressName: string
  addressLine: string
  ward?: string
  district: string
  city: string
  contactName: string
  contactPhone: string
  latitude: number
  longitude: number
  totalWeightKg: number
  estimatedCrates: number
  items: Array<{
    orderItemId: number
    skuId: number
    skuName: string
    baseUnit: string
    packSize: number
    quantity: number
    weightKg: number
  }>
}

export interface ProposedTrip {
  tripIndex: number
  driver: { userId: number; fullName: string; phone: string }
  totalWeightKg: number
  totalCrates: number
  capacityUtilizationPercent: number
  totalDistanceKm: number
  estimatedDurationMinutes: number
  estimatedCostVnd: number
  orders: CandidateOrder[]
  routeCoordinates: [number, number][]
}

export interface SuggestionResult {
  planId: string
  date: string
  originId: number
  originName: string
  originLat: number
  originLng: number
  strategy: string
  attempt: number
  totalOrders: number
  totalTrips: number
  totalWeightKg: number
  totalCrates: number
  totalDistanceKm: number
  totalEstimatedCostVnd: number
  costSavingsPercent: number
  aiExplanation: string
  trips: ProposedTrip[]
}

interface Props {
  open: boolean
  onClose: () => void
  date: string
  originId?: number
  drivers?: Row[]
  onApplied: () => void
}

const STRATEGIES = [
  { key: 'BALANCED', label: 'Cân bằng tải trọng & cung đường', icon: 'balance' },
  { key: 'MIN_COST', label: 'Tiết kiệm chi phí & km nhất', icon: 'savings' },
  { key: 'FASTEST', label: 'Ưu tiên giao sớm trước 08:00', icon: 'alarm_on' },
  { key: 'MAX_CAPACITY', label: 'Tối đa lấp đầy xe lạnh', icon: 'local_shipping' }
]

const ROUTE_PALETTE = ['#16a34a', '#2563eb', '#d97706', '#9333ea', '#0891b2', '#dc2626']

export const AiTripOptimizerModal: React.FC<Props> = ({
  open,
  onClose,
  date,
  originId,
  drivers = [],
  onApplied
}) => {
  const [strategy, setStrategy] = useState<string>('BALANCED')
  const [attempt, setAttempt] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [applying, setApplying] = useState<boolean>(false)
  const [plan, setPlan] = useState<SuggestionResult | null>(null)
  const [error, setError] = useState<string>('')
  const [driverAssignments, setDriverAssignments] = useState<Record<number, number>>({})

  const fetchPlan = async (strat = strategy, att = attempt) => {
    if (!originId) {
      setError('Vui lòng chọn Điểm tập kết (Cross-dock Hub) trước khi phân tích AI.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api<SuggestionResult>('/operations/trips/ai-suggest', 'POST', {
        date,
        originId,
        strategy: strat,
        attempt: att
      })
      setPlan(res)
      // Initialize driver assignments
      const map: Record<number, number> = {}
      res.trips.forEach(t => {
        map[t.tripIndex] = t.driver?.userId || (drivers[0]?.user_id ? Number(drivers[0].user_id) : 0)
      })
      setDriverAssignments(map)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && originId) {
      setAttempt(1)
      void fetchPlan(strategy, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, originId, date])

  const handleTryAnother = () => {
    const nextAttempt = attempt + 1
    setAttempt(nextAttempt)
    void fetchPlan(strategy, nextAttempt)
  }

  const handleStrategyChange = (newStrat: string) => {
    setStrategy(newStrat)
    setAttempt(1)
    void fetchPlan(newStrat, 1)
  }

  const handleApply = async () => {
    if (!plan || plan.trips.length === 0) return
    setApplying(true)
    setError('')
    try {
      const tripsPayload = plan.trips.map(t => ({
        driverId: driverAssignments[t.tripIndex] || t.driver.userId,
        orderIds: t.orders.map(o => o.orderId)
      }))

      await api('/operations/trips/ai-apply', 'POST', {
        date: plan.date,
        originId: plan.originId,
        trips: tripsPayload
      })

      onApplied()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  // Convert proposed trips into MultiTripRoute format for FreshLinkMap
  const multiRoutes: MultiTripRoute[] = (plan?.trips || []).map((t, idx) => ({
    tripIndex: t.tripIndex,
    tripCode: `Chuyến #${t.tripIndex}`,
    color: ROUTE_PALETTE[idx % ROUTE_PALETTE.length],
    driverName: drivers.find(d => Number(d.user_id) === driverAssignments[t.tripIndex])?.full_name as string || t.driver.fullName,
    stops: t.orders.map((o, sIdx) => ({
      trip_stop_id: o.orderId,
      stop_sequence: sIdx + 1,
      order_code: o.orderCode,
      restaurant_name: o.restaurantName,
      address_name: o.addressName,
      address_line: o.addressLine,
      district: o.district,
      city: o.city,
      contact_name: o.contactName,
      contact_phone: o.contactPhone,
      latitude: o.latitude,
      longitude: o.longitude,
      status: 'PENDING'
    }))
  }))

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1120}
      style={{ top: 20 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>auto_awesome</span>
          </div>
          <div>
            <Typography.Title level={4} style={{ margin: 0, color: '#064e3b' }}>
              Điều Phối Thông Minh — Đề Xuất Ghép Chuyến Bằng AI
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Tự động phân tích vị trí địa lý GPS, loại sản phẩm, tải trọng xe lạnh và chi phí tối ưu
            </Typography.Text>
          </div>
        </div>
      }
      footer={[
        <Button key="cancel" size="large" onClick={onClose} disabled={applying}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 4 }}>close</span>
          Hủy bỏ (Tự ghép tay)
        </Button>,
        <Button
          key="retry"
          size="large"
          loading={loading}
          disabled={applying}
          onClick={handleTryAnother}
          style={{ background: '#f3e8ff', color: '#7e22ce', borderColor: '#d8b4fe', fontWeight: 600 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 4 }}>sync</span>
          Thử phương án khác (Lần {attempt + 1})
        </Button>,
        <Button
          key="apply"
          type="primary"
          size="large"
          loading={applying}
          disabled={loading || !plan || plan.trips.length === 0}
          onClick={() => void handleApply()}
          style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderColor: '#047857', fontWeight: 600 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 4 }}>check_circle</span>
          Chấp nhận & Tự động tạo {plan?.trips.length || 0} chuyến xe
        </Button>
      ]}
    >
      {error && <Alert type="error" message={error} showIcon closable style={{ marginBottom: 16 }} />}

      {/* STRATEGY SELECTOR */}
      <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 12, marginBottom: 16, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <Space size="middle">
            <span style={{ fontWeight: 600, color: '#334155' }}>Chiến lược tối ưu hóa:</span>
            {STRATEGIES.map(s => {
              const active = strategy === s.key
              return (
                <Button
                  key={s.key}
                  type={active ? 'primary' : 'default'}
                  onClick={() => handleStrategyChange(s.key)}
                  style={{
                    borderRadius: 8,
                    fontWeight: active ? 600 : 400,
                    background: active ? '#059669' : '#ffffff',
                    borderColor: active ? '#059669' : '#cbd5e1'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>{s.icon}</span>
                  {s.label}
                </Button>
              )
            })}
          </Space>
          <Tag color="purple" style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>
            Phương án #{attempt}
          </Tag>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#059669', fontWeight: 500 }}>
            AI đang phân tích ma trận khoảng cách GPS và tải trọng xe lạnh...
          </p>
        </div>
      ) : plan ? (
        <>
          {/* KPI SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Card size="small" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Số chuyến đề xuất</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#065f46' }}>
                {plan.totalTrips} <span style={{ fontSize: 14, fontWeight: 400 }}>chuyến ({plan.totalOrders} đơn)</span>
              </div>
            </Card>
            <Card size="small" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Tổng quãng đường</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>
                {plan.totalDistanceKm} <span style={{ fontSize: 14, fontWeight: 400 }}>km</span>
              </div>
            </Card>
            <Card size="small" style={{ background: '#fefce8', borderColor: '#fef08a' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Khối lượng & Thùng</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#854d0e' }}>
                {plan.totalWeightKg} <span style={{ fontSize: 14, fontWeight: 400 }}>kg ({plan.totalCrates} sọt)</span>
              </div>
            </Card>
            <Card size="small" style={{ background: '#fdf2f8', borderColor: '#fbcfe8' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Chi phí ước tính</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#9d174d' }}>
                {display(plan.totalEstimatedCostVnd, 'amount')}
              </div>
            </Card>
            <Card size="small" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Tiết kiệm chi phí</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#166534' }}>
                ~{plan.costSavingsPercent}% <span style={{ fontSize: 14, fontWeight: 400 }}>so với giao lẻ</span>
              </div>
            </Card>
          </div>

          {/* AI EXPLANATION CALLOUT */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #86efac',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#16a34a', flexShrink: 0 }}>psychology</span>
            <div>
              <div style={{ fontWeight: 700, color: '#14532d', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Phân tích Điều phối từ AI (Google Gemini)</span>
                <Tag color="green" style={{ fontSize: 11 }}>Đã tối ưu TSP & Chuỗi Lạnh</Tag>
              </div>
              <p style={{ margin: 0, color: '#166534', fontSize: 13.5, lineHeight: 1.5 }}>
                {plan.aiExplanation}
              </p>
            </div>
          </div>

          {/* INTERACTIVE ROUTE MAP */}
          <div style={{ marginBottom: 20 }}>
            <FreshLinkMap
              title={`Bản đồ đa tuyến AI: ${plan.totalTrips} Chuyến xe lạnh cho ngày ${plan.date}`}
              subtitle={`Khởi hành từ ${plan.originName} · Mỗi màu tương ứng một chuyến xe tối ưu`}
              origin={{
                name: plan.originName,
                latitude: plan.originLat,
                longitude: plan.originLng
              }}
              multiRoutes={multiRoutes}
              height="380px"
            />
          </div>

          {/* PROPOSED TRIPS BREAKDOWN */}
          <Typography.Title level={5} style={{ color: '#1e293b', marginBottom: 12 }}>
            Chi tiết các chuyến xe do AI phân bổ:
          </Typography.Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 14 }}>
            {plan.trips.map((trip, idx) => {
              const color = ROUTE_PALETTE[idx % ROUTE_PALETTE.length]
              return (
                <Card
                  key={trip.tripIndex}
                  size="small"
                  style={{
                    borderRadius: 12,
                    border: `1.5px solid ${color}40`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Space>
                        <Badge color={color} />
                        <span style={{ fontWeight: 700, color }}>Chuyến #{trip.tripIndex}</span>
                        <Tag color="blue">{trip.orders.length} điểm giao</Tag>
                      </Space>
                      <span style={{ fontSize: 13, color: '#64748b' }}>
                        {trip.totalDistanceKm} km · {trip.estimatedDurationMinutes} phút
                      </span>
                    </div>
                  }
                  extra={
                    <span style={{ fontWeight: 600, color: '#0f766e' }}>
                      {display(trip.estimatedCostVnd, 'amount')}
                    </span>
                  }
                >
                  {/* DRIVER ASSIGNMENT SELECTOR */}
                  <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Tài xế phụ trách:</span>
                    <Select
                      style={{ flex: 1 }}
                      value={driverAssignments[trip.tripIndex]}
                      onChange={val => setDriverAssignments({ ...driverAssignments, [trip.tripIndex]: Number(val) })}
                      options={drivers.map(d => ({ value: Number(d.user_id), label: `${String(d.full_name)} (${String(d.phone ?? 'Tài xế')})` }))}
                    />
                  </div>

                  {/* CAPACITY PROGRESS */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 2 }}>
                      <span>Tải trọng xe lạnh: <b>{trip.totalWeightKg} kg</b> / {trip.totalCrates} sọt SmartCrate</span>
                      <span>{trip.capacityUtilizationPercent}% công suất</span>
                    </div>
                    <Progress
                      percent={trip.capacityUtilizationPercent}
                      size="small"
                      strokeColor={color}
                      showInfo={false}
                    />
                  </div>

                  {/* STOPS LIST */}
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 8 }}>
                    {trip.orders.map((o, stopIdx) => (
                      <div
                        key={o.orderId}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '6px 0',
                          borderBottom: stopIdx < trip.orders.length - 1 ? '1px dashed #e2e8f0' : 'none'
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: color,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          {stopIdx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 13, color: '#1e293b' }}>{o.restaurantName}</strong>
                            <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>{o.receivingStartTime.slice(0, 5)} - {o.receivingEndTime.slice(0, 5)}</Tag>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {o.addressLine}, {o.district}, {o.city}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#059669', marginTop: 2 }}>
                            Đơn <b>{o.orderCode}</b> · {o.totalWeightKg} kg ({o.estimatedCrates} sọt) · {o.items.map(i => `${i.skuName} (${i.quantity} ${i.baseUnit})`).join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      ) : (
        <Alert type="info" message="Không có dữ liệu đề xuất từ AI. Hãy thử chọn ngày khác hoặc chọn Điểm tập kết." />
      )}
    </Modal>
  )
}
