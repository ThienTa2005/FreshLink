import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Space, Typography, Tag, Modal, Input, Divider, List, Form } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadApiFile, ApiError } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { can, display } from '../components/permissions'
import { ActionForm, DataTable, options, useRows, type Row } from '../components/Workspace'
import { enqueueOfflineAction } from '../api/offlineQueue'
import { FreshLinkMap } from '../components/FreshLinkMap'

function ProofForm({ stop, restaurant, onDone }: { stop: Row; restaurant: boolean; onDone?: () => void }) {
  const items = (stop.items as Row[]) || []
  const { user } = useAuth()
  return <ActionForm title={restaurant ? 'Xác nhận nhận hàng' : 'Ghi nhận giao hàng'} path={`/stops/${stop.trip_stop_id}/${restaurant ? 'receive' : 'deliver'}`} fields={[
    { name: 'receiver', label: 'Người nhận', initial: restaurant ? user?.fullName : stop.contact_name },
    { name: 'note', label: 'Ghi chú (bắt buộc khi có sai lệch)', type: 'textarea', required: false },
    { name: 'evidenceId', label: 'Ảnh bằng chứng', type: 'file', required: false },
    ...items.map(item => ({
      name: `q${item.delivery_item_id}`,
      label: `${item.sku_name} — xuất ${item.loaded_quantity}`,
      type: 'number' as const,
      min: 0,
      max: Number(item.loaded_quantity),
      initial: Number(restaurant ? (item.delivered_quantity ?? item.loaded_quantity) : item.loaded_quantity)
    })),
  ]} transform={v => ({
    receiver: v.receiver,
    note: v.note || '',
    evidenceId: v.evidenceId,
    items: items.map(item => ({ deliveryItemId: item.delivery_item_id, quantity: v[`q${item.delivery_item_id}`] }))
  })} onDone={onDone} />
}

function FailureForm({ stopId, onDone }: { stopId: unknown; onDone?: () => void }) {
  const reasons = useRows('/delivery-failure-reasons')
  return <ActionForm title="Báo giao thất bại" path={`/stops/${stopId}/fail`} fields={[
    { name: 'reasonCode', label: 'Lý do', type: 'select', options: options(reasons.data, 'reason_code', 'label') },
    { name: 'reason', label: 'Mô tả chi tiết', type: 'textarea' }
  ]} onDone={onDone} />
}

export function OrderDetail({ orderId }: { orderId: number }) {
  const { membership } = useAuth()
  const buyer = can(membership, 'RESTAURANT_MANAGER', 'RESTAURANT_PURCHASER') && membership?.organizationType === 'RESTAURANT'
  const manager = can(membership, 'RESTAURANT_MANAGER') && membership?.organizationType === 'RESTAURANT'
  const receiver = can(membership, 'RESTAURANT_MANAGER', 'RESTAURANT_RECEIVER') && membership?.organizationType === 'RESTAURANT'
  const coordinator = can(membership, 'OPERATIONS_COORDINATOR', 'SYSTEM_ADMIN')

  const query = useQuery({ queryKey: ['order', orderId], queryFn: () => api<Row>(`/orders/${orderId}`) })
  const remediesQuery = useQuery({ queryKey: ['order-remedies', orderId], queryFn: () => api<Row[]>(`/orders/${orderId}/remedies`) })

  const [remedyActionId, setRemedyActionId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  async function respondRemedy(remedyId: number, approved: boolean) {
    setBusy(true)
    setActionError('')
    try {
      await api(`/orders/remedies/${remedyId}/respond`, 'POST', { approved, reason: approved ? null : rejectReason })
      setRemedyActionId(null)
      setRejectReason('')
      await query.refetch()
      await remediesQuery.refetch()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const orderItems = (query.data?.items as Row[]) || []
  const remedies = remediesQuery.data || []

  return <Card title={`Chi tiết đơn #${orderId}`} className="action-card" loading={query.isPending}>
    {actionError && <Alert type="error" message={actionError} closable onClose={() => setActionError('')} style={{ marginBottom: 12 }} />}
    {query.error && <Alert type="error" message={query.error.message} />}
    {query.data && <>
      <Descriptions items={[
        { key: 'code', label: 'Mã đơn', children: String(query.data.order_code) },
        { key: 'status', label: 'Trạng thái', children: display(query.data.order_status) },
        { key: 'date', label: 'Ngày giao', children: String(query.data.delivery_date) },
        { key: 'cutoff', label: 'Hạn thay đổi', children: display(query.data.cutoffAt, 'cutoff_at') }
      ]} />
      {query.data.rejection_reason != null && <Alert type="warning" message={String(query.data.rejection_reason)} />}

      {/* Remedies alert section */}
      {remedies.length > 0 && <Card title="Phương án xử lý ngoại lệ (Remedies)" style={{ marginTop: 16, marginBottom: 16, background: '#fafafa' }}>
        <List dataSource={remedies} renderItem={item => {
          const isPending = item.status === 'PENDING'
          const isExpired = item.status === 'EXPIRED'
          return <List.Item actions={manager && isPending ? [
            <Button key="accept" type="primary" size="small" loading={busy} onClick={() => void respondRemedy(Number(item.order_remedy_id), true)}>Chấp nhận</Button>,
            <Button key="reject" danger size="small" onClick={() => setRemedyActionId(Number(item.order_remedy_id))}>Từ chối</Button>
          ] : []}>
            <List.Item.Meta
              title={<Space>
                <strong>Phương án #{String(item.version)}: {display(item.remedy_type)}</strong>
                <Tag color={item.status === 'ACCEPTED' ? 'green' : item.status === 'REJECTED' ? 'red' : item.status === 'EXPIRED' ? 'default' : 'gold'}>{display(item.status)}</Tag>
              </Space>}
              description={<div>
                <p>Số lượng ảnh hưởng: <b>{String(item.affected_quantity)}</b></p>
                {Boolean(item.substitute_sku_name) && <p>Hàng thay thế: <b>{String(item.substitute_sku_name)}</b> (SL: {String(item.substitute_quantity)})</p>}
                {Boolean(item.price_difference) && <p>Chênh lệch giá: <b>{display(item.price_difference, 'price')} đ</b></p>}
                <p>Hạn phản hồi: {String(item.deadline_at)}</p>
                {isExpired && <Alert type="warning" message="Phương án đã hết hạn và chuyển về điều phối xử lý." showIcon style={{ marginTop: 6 }} />}
                {Boolean(item.rejection_reason) && <p style={{ color: '#cf1322' }}>Lý do từ chối: {String(item.rejection_reason)}</p>}
              </div>}
            />
          </List.Item>
        }} />
      </Card>}

      {/* Propose remedy for coordinator if shortage exists */}
      {coordinator && ['CONFIRMED', 'SOURCING', 'OUT_FOR_DELIVERY'].includes(String(query.data.order_status)) && (
        <ActionForm title="Đề xuất phương án thay thế / thiếu hàng" path={`/orders/${orderId}/remedies`} fields={[
          { name: 'orderItemId', label: 'Dòng sản phẩm ảnh hưởng', type: 'select', options: options(orderItems, 'order_item_id', 'sku_name') },
          { name: 'remedyType', label: 'Loại phương án', type: 'select', options: [{ value: 'SUBSTITUTE', label: 'Đổi mặt hàng tương đương' }, { value: 'SHORTAGE', label: 'Giao thiếu / một phần' }, { value: 'PRICE_ADJUSTMENT', label: 'Điều chỉnh giá' }, { value: 'CANCEL_ITEM', label: 'Hủy dòng hàng' }] },
          { name: 'affectedQuantity', label: 'Số lượng ảnh hưởng', type: 'number', min: 0.001 },
          { name: 'substituteSkuId', label: 'Mã SKU thay thế (nếu có)', type: 'select', required: false, options: options(orderItems, 'sku_id', 'sku_name') },
          { name: 'substituteQuantity', label: 'Số lượng thay thế', type: 'number', min: 0, required: false },
          { name: 'priceDifference', label: 'Chênh lệch tiền (+/- đ)', type: 'number', initial: 0 },
          { name: 'deadlineMinutes', label: 'Hạn trả lời (phút)', type: 'number', min: 5, max: 1440, initial: 30 },
          { name: 'proposalNote', label: 'Ghi chú đề xuất', type: 'textarea' }
        ]} onDone={() => { void remediesQuery.refetch(); void query.refetch() }} />
      )}

      {/* Modal for rejecting remedy */}
      <Modal open={remedyActionId != null} title="Từ chối phương án ngoại lệ" onCancel={() => setRemedyActionId(null)} onOk={() => remedyActionId && void respondRemedy(remedyActionId, false)} okText="Xác nhận từ chối" okButtonProps={{ danger: true, loading: busy, disabled: !rejectReason.trim() }}>
        <p>Vui lòng nhập lý do từ chối để bộ phận Điều phối tìm phương án khác:</p>
        <Input.TextArea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Nhập lý do chi tiết..." />
      </Modal>

      {buyer && query.data.order_status === 'DRAFT' && <ActionForm title="Gửi đơn nháp" path={`/orders/${orderId}/submit`} fields={[]} onDone={() => void query.refetch()} />}
      {can(membership, 'RESTAURANT_MANAGER') && query.data.order_status === 'SUBMITTED' && <ActionForm title="Duyệt đơn" path={`/orders/${orderId}/approve`} fields={[{ name: 'approved', label: 'Quyết định', type: 'select', options: [{ value: 'yes', label: 'Duyệt' }, { value: 'no', label: 'Trả về để sửa' }] }, { name: 'reason', label: 'Lý do (bắt buộc khi từ chối)', required: false }]} transform={v => ({ ...v, approved: v.approved === 'yes' })} onDone={() => void query.refetch()} />}
      {buyer && ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'SOURCING'].includes(String(query.data.order_status)) && <ActionForm title="Hủy đơn" path={`/orders/${orderId}/cancel`} fields={[{ name: 'reason', label: 'Lý do hủy' }]} onDone={() => void query.refetch()} />}
      {orderItems.map(item => <p key={String(item.order_item_id)}>Dòng #{String(item.order_item_id)} · {String(item.sku_name)} · Đặt {String(item.requested_quantity)} · Giá {String(item.unit_price)} đ</p>)}
      
      <Typography.Title level={5}>Lô thực tế đã phân bổ</Typography.Title>
      {((query.data.allocations as Row[]) || []).map((row, i) => <div key={i}><p>{String(orderItems.find(x => x.order_item_id === row.order_item_id)?.sku_name)} · {String(row.batch_code)} · {String(row.allocated_quantity)}</p>{receiver && <ActionForm title="Báo thiếu / hỏng" path="/claims" fields={[{ name: 'quantity', label: 'Số lượng ảnh hưởng', type: 'number', min: 0.001, max: Number(row.allocated_quantity) }, { name: 'description', label: 'Vấn đề và yêu cầu xử lý', type: 'textarea' }, { name: 'evidenceId', label: 'Ảnh', type: 'file', required: false }]} transform={v => ({ ...v, orderItemId: row.order_item_id, batchId: row.batch_id })} />}</div>)}
      
      {((query.data.stops as Row[]) || []).map(stop => <div key={String(stop.trip_stop_id)}><p>Giao nhận: {display(stop.status)}</p>{((stop.items as Row[]) || []).map(x => <p key={String(x.delivery_item_id)}>{String(x.sku_name)} · Xuất {String(x.loaded_quantity)} · Tài xế giao {String(x.delivered_quantity ?? 0)} · Nhà hàng nhận {String(x.received_quantity ?? 'Chưa xác nhận')}</p>)}{stop.restaurant_confirmed_at ? <Alert type="success" message={`Nhà hàng đã xác nhận lúc ${display(stop.restaurant_confirmed_at, 'confirmed_at')}`} /> : receiver && ['DELIVERED', 'PARTIALLY_DELIVERED', 'FAILED'].includes(String(stop.status)) && <ProofForm stop={stop} restaurant onDone={() => void query.refetch()} />}</div>)}
      
      <Typography.Title level={5}>Tiến trình</Typography.Title>
      {(((query.data.history as Row[]) || [])).map((x, i) => <p key={i}>{display(x.created_at ?? x.changed_at, 'created_at')} · {display(x.new_status)} · {String(x.full_name ?? '')} · {String(x.reason ?? '')}</p>)}
    </>}
  </Card>
}

export default function TripPage({ canOptimize = false, initialSelected }: { canOptimize?: boolean; initialSelected?: number }) {
  const [selected, setSelected] = useState<number | undefined>(initialSelected)
  const [error, setError] = useState('')
  const [offlineNotice, setOfflineNotice] = useState('')
  const [redeliverStopId, setRedeliverStopId] = useState<number | null>(null)
  const [targetTripId, setTargetTripId] = useState<string>('')
  const client = useQueryClient()
  const { membership } = useAuth()
  const isDriver = can(membership, 'DRIVER')

  const query = useQuery({ queryKey: ['trip', selected], queryFn: () => api<Row>(`/trips/${selected}`), enabled: !!selected })

  // GPS background telemetry watchdog when trip is IN_PROGRESS
  useEffect(() => {
    if (query.data?.status !== 'IN_PROGRESS' || !selected) return
    let watchId: number | null = null
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async pos => {
          try {
            await api(`/trips/${selected}/telemetry`, 'POST', {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              temperatureC: null
            })
          } catch {
            // Background telemetry sync fail is non-fatal
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
      )
    }
    return () => {
      if (watchId != null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [query.data?.status, selected])

  const stops = ((query.data?.stops as Row[]) || []).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
  const currentPendingStop = stops.find(s => s.status === 'PENDING')

  async function handleArrive(stopId: number) {
    try {
      await api(`/stops/${stopId}/arrive`, 'POST')
      await query.refetch()
    } catch (e) {
      if (e instanceof ApiError && (e.kind === 'network' || e.kind === 'timeout')) {
        enqueueOfflineAction(`/stops/${stopId}/arrive`, 'POST', {}, 'Ghi nhận đến điểm giao')
        setOfflineNotice('Đã lưu hành động "Đến nơi" vào hàng đợi ngoại tuyến. Sẽ tự động gửi khi có mạng.')
      } else {
        setError((e as Error).message)
      }
    }
  }

  async function handleRedeliver(stopId: number) {
    try {
      await api(`/stops/${stopId}/redeliver`, 'POST', { targetTripId: targetTripId ? Number(targetTripId) : null })
      setRedeliverStopId(null)
      setTargetTripId('')
      await query.refetch()
      await client.invalidateQueries({ queryKey: ['driver-trips'] })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return <>
    {!selected && <DataTable path="/trips" rowKey="trip_id" columns={[['trip_code', 'Mã chuyến'], ['trip_date', 'Ngày'], ['status', 'Trạng thái']]} actions={row => <Button type="primary" onClick={() => setSelected(Number(row.trip_id))}>Mở chuyến →</Button>} />}
    {error && <Alert type="error" message={error} closable onClose={() => setError('')} style={{ marginBottom: 12 }} />}
    {offlineNotice && <Alert type="info" message={offlineNotice} closable onClose={() => setOfflineNotice('')} style={{ marginBottom: 12 }} />}

    {query.data && <Card
      title={<Space wrap>
        <Button onClick={() => setSelected(undefined)} size="small">← Quay lại danh sách</Button>
        <span>Chuyến: <strong>{String(query.data.trip_code)}</strong></span>
        <Tag color={query.data.status === 'DELIVERED' ? 'green' : query.data.status === 'IN_PROGRESS' ? 'blue' : 'gold'}>{display(query.data.status)}</Tag>
      </Space>}
      extra={<Space wrap>
        <Button onClick={() => window.print()}>In tem QR / Bảng kê</Button>
        <Button onClick={() => void downloadApiFile(`/trips/${selected}/manifest`, `manifest-${selected}.csv`)}>Tải manifest</Button>
        {canOptimize && ['PLANNED', 'LOADING'].includes(String(query.data.status)) && (
          <Button type="primary" onClick={async () => {
            try {
              await api(`/trips/${selected}/optimize`, 'POST')
              await client.invalidateQueries()
            } catch (e) {
              setError((e as Error).message)
            }
          }}>Tối ưu thứ tự điểm</Button>
        )}
        {query.data.status === 'IN_PROGRESS' && (
          <Button onClick={() => navigator.geolocation.getCurrentPosition(async p => {
            try {
              await api(`/trips/${selected}/telemetry`, 'POST', { latitude: p.coords.latitude, longitude: p.coords.longitude, temperatureC: null })
              setOfflineNotice('Đã cập nhật vị trí GPS thành công.')
            } catch (e) {
              setError((e as Error).message)
            }
          }, () => setError('Không lấy được vị trí GPS. Vui lòng bật định vị trên trình duyệt.'))}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>my_location</span>
            Cập nhật GPS
          </Button>
        )}
      </Space>}
    >
      {/* DRIVER COCKPIT PRIMARY ACTION HERO BANNER */}
      {isDriver && query.data.status === 'PLANNED' && (
        <div className="driver-cockpit-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#a4f4c3' }}>local_shipping</span>
            <Typography.Title level={4} style={{ margin: 0, color: '#ffffff' }}>Khoang lái tài xế — Danh sách kiểm hàng nhận</Typography.Title>
          </div>
          <p>Đối chiếu toàn bộ các thùng và kiện hàng rau củ sạch trên xe lạnh trước khi xuất phát khỏi Hub.</p>
          <Button type="primary" size="large" className="driver-btn-lg" onClick={async () => {
            try {
              await api(`/trips/${selected}/start`, 'POST')
              await client.invalidateQueries()
            } catch (e) {
              setError((e as Error).message)
            }
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>done_all</span>
            Đã đối chiếu & Nhận hàng — Bắt đầu chuyến xe
          </Button>
        </div>
      )}

      {isDriver && query.data.status === 'IN_PROGRESS' && currentPendingStop && (
        <div className="driver-next-stop-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="radar-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: '#176b45', display: 'inline-block' }}></span>
            <Typography.Title level={4} style={{ margin: 0, color: '#005131' }}>
              Điểm đến tiếp theo: Điểm #{String(currentPendingStop.stop_sequence)} — {String(currentPendingStop.address_line)}
            </Typography.Title>
          </div>
          <p style={{ margin: '4px 0 16px', color: 'var(--text-secondary)' }}>
            Người nhận: <b>{String(currentPendingStop.contact_name ?? '')}</b> · SĐT: <b>{String(currentPendingStop.contact_phone ?? '')}</b> · {String(currentPendingStop.district)}, {String(currentPendingStop.city)}
          </p>
          <Space wrap size="middle">
            {currentPendingStop.actual_arrival_at == null ? (
              <Button type="primary" size="large" className="driver-btn-lg" onClick={() => void handleArrive(Number(currentPendingStop.trip_stop_id))}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>where_to_vote</span>
                1. Đã đến điểm giao này
              </Button>
            ) : (
              <Tag color="green" style={{ fontSize: 14, padding: '6px 12px', borderRadius: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>check_circle</span>
                Đã ghi nhận đến nơi lúc {display(currentPendingStop.actual_arrival_at, 'arrival')}
              </Tag>
            )}
            <Button href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${currentPendingStop.address_line}, ${currentPendingStop.district}, ${currentPendingStop.city}`)}`} target="_blank">
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>navigation</span>
              Chỉ đường Google Maps
            </Button>
            <Button href={`tel:${currentPendingStop.contact_phone}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>call</span>
              Gọi người nhận
            </Button>
          </Space>
        </div>
      )}

      {/* INTERACTIVE DELIVERY ROUTE MAP */}
      <div style={{ marginBottom: 20 }}>
        <FreshLinkMap
          title={`Lộ trình giao xe lạnh: Chuyến #${String(query.data.trip_code ?? selected)}`}
          subtitle={`${stops.length} điểm giao · Khởi hành từ ${String(query.data.origin_name ?? 'Hub tập kết')}`}
          origin={{
            name: String(query.data.origin_name ?? 'Hub xuất phát'),
            address_line: String(query.data.origin_address_line ?? ''),
            district: String(query.data.origin_district ?? ''),
            city: String(query.data.origin_city ?? ''),
            latitude: query.data.origin_latitude != null ? Number(query.data.origin_latitude) : null,
            longitude: query.data.origin_longitude != null ? Number(query.data.origin_longitude) : null
          }}
          stops={stops.map(s => ({
            trip_stop_id: s.trip_stop_id as number,
            stop_sequence: Number(s.stop_sequence),
            order_code: String(s.order_code ?? ''),
            restaurant_name: String(s.restaurant_name ?? s.address_name ?? ''),
            address_name: String(s.address_name ?? ''),
            address_line: String(s.address_line ?? ''),
            district: String(s.district ?? ''),
            city: String(s.city ?? ''),
            contact_name: String(s.contact_name ?? ''),
            contact_phone: String(s.contact_phone ?? ''),
            latitude: s.latitude != null ? Number(s.latitude) : null,
            longitude: s.longitude != null ? Number(s.longitude) : null,
            status: String(s.status ?? 'PENDING'),
            actual_arrival_at: s.actual_arrival_at ? String(s.actual_arrival_at) : null
          }))}
          height="360px"
        />
      </div>

      {/* STOPS LIST */}
      {stops.map(stop => {
        const isCurrent = currentPendingStop?.trip_stop_id === stop.trip_stop_id
        return <Card
          key={String(stop.trip_stop_id)}
          className="action-card"
          style={{ borderColor: isCurrent ? '#52c41a' : '#e8e8e8', marginBottom: 16 }}
          title={<Space>
            <span>Điểm {String(stop.stop_sequence)}: {String(stop.address_line)}</span>
            <Tag color={stop.status === 'DELIVERED' ? 'green' : stop.status === 'FAILED' ? 'red' : 'gold'}>{display(stop.status)}</Tag>
            {stop.actual_arrival_at != null && <Tag color="blue">Đến: {display(stop.actual_arrival_at, 'arrival')}</Tag>}
          </Space>}
        >
          <p>{String(stop.district)}, {String(stop.city)} · {String(stop.contact_name ?? '')} ({String(stop.contact_phone ?? '')})</p>
          <Space wrap style={{ marginBottom: 12 }}>
            <a href={`tel:${stop.contact_phone}`} className="ant-btn ant-btn-default ant-btn-sm">Gọi người nhận</a>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address_line}, ${stop.district}, ${stop.city}`)}`} target="_blank" rel="noreferrer" className="ant-btn ant-btn-default ant-btn-sm">Chỉ đường</a>
            {stop.status === 'PENDING' && stop.actual_arrival_at == null && (
              <Button size="small" onClick={() => void handleArrive(Number(stop.trip_stop_id))}>Ghi nhận đã đến nơi</Button>
            )}
            {stop.status === 'FAILED' && (
              <Button size="small" type="primary" onClick={() => setRedeliverStopId(Number(stop.trip_stop_id))}>
                Tạo chuyến giao lại (không tính phí trùng)
              </Button>
            )}
          </Space>

          {/* Deliver/Fail Forms */}
          {query.data?.status === 'IN_PROGRESS' && stop.status === 'PENDING' && (
            <div style={{ marginTop: 12 }}>
              <ProofForm stop={stop} restaurant={false} onDone={() => void query.refetch()} />
              <FailureForm stopId={stop.trip_stop_id} onDone={() => void query.refetch()} />
            </div>
          )}

          {/* Crate Lifecycle Movement */}
          <Divider style={{ margin: '12px 0', fontSize: 13 }}>Quản lý thùng luân chuyển tại điểm giao</Divider>
          <ActionForm title="Giao hoặc thu thùng" path={v => `/assets/${v.assetId}/move`} fields={[
            { name: 'assetId', label: 'Mã thùng', type: 'select', options: options(stop.assets as Row[], 'asset_id', 'asset_code') },
            { name: 'action', label: 'Thao tác vòng đời', type: 'select', options: [
              { value: 'DELIVER', label: 'Giao thùng cho nhà hàng' },
              { value: 'COLLECT', label: 'Thu hồi thùng dơ về xe' },
              { value: 'ISSUE_TO_VEHICLE', label: 'Cấp thùng lên xe' },
              { value: 'REPORT_DAMAGED', label: 'Báo thùng hư hỏng' },
              { value: 'REPORT_LOST', label: 'Báo mất thùng' }
            ] },
            { name: 'note', label: 'Tình trạng và ghi chú' },
          ]} transform={v => ({ action: v.action, note: v.note, stopId: stop.trip_stop_id })} onDone={() => void query.refetch()} />
        </Card>
      })}
    </Card>}

    {/* REDELIVER MODAL */}
    <Modal
      open={redeliverStopId != null}
      title="Tạo lịch giao lại điểm thất bại"
      onCancel={() => setRedeliverStopId(null)}
      onOk={() => redeliverStopId && void handleRedeliver(redeliverStopId)}
      okText="Xác nhận giao lại"
    >
      <p>Hệ thống sẽ giữ nguyên giá trị đơn hàng và không tính trùng phí vận chuyển hoặc tiền hàng.</p>
      <Form layout="vertical">
        <Form.Item label="Chọn chuyến gán lại (để trống để tạo điểm chờ điều phối)">
          <Input placeholder="ID chuyến mục tiêu (hoặc để trống)" value={targetTripId} onChange={e => setTargetTripId(e.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  </>
}
