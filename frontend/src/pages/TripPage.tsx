import { useState } from 'react'
import { Alert, Button, Card, Descriptions, Space, Typography } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadApiFile } from '../api/http'
import { ActionForm, DataTable, options, useRows, type Row } from '../components/Workspace'

function ProofForm({ stop, restaurant }: { stop: Row; restaurant: boolean }) {
  const items = stop.items as Row[]
  return <ActionForm title={restaurant ? 'Xác nhận nhận hàng' : 'Kết quả giao hàng'} path={`/stops/${stop.trip_stop_id}/${restaurant ? 'receive' : 'deliver'}`} fields={[
    { name: 'receiver', label: 'Người nhận' }, { name: 'note', label: 'Ghi chú; nếu thiếu/thất bại ghi nơi giữ hàng và hướng xử lý', type: 'textarea' },
    { name: 'evidenceId', label: 'Ảnh bằng chứng', type: 'file', required: false },
    ...items.map(item => ({ name: `q${item.delivery_item_id}`, label: `${item.sku_name} — xuất ${item.loaded_quantity}`, type: 'number' as const, min: 0, max: Number(item.loaded_quantity), initial: Number(restaurant ? item.delivered_quantity : item.loaded_quantity) })),
  ]} transform={v => ({ receiver: v.receiver, note: v.note, evidenceId: v.evidenceId, items: items.map(item => ({ deliveryItemId: item.delivery_item_id, quantity: v[`q${item.delivery_item_id}`] })) })} />
}
function FailureForm({ stopId }: { stopId: unknown }) {
  const reasons=useRows('/delivery-failure-reasons')
  return <ActionForm title="Báo giao thất bại" path={`/stops/${stopId}/fail`} fields={[{name:'reasonCode',label:'Lý do',type:'select',options:options(reasons.data,'reason_code','label')},{name:'reason',label:'Mô tả chi tiết',type:'textarea'}]}/>
}
export function OrderDetail({ orderId }: { orderId: number }) {
  const query = useQuery({ queryKey: ['order', orderId], queryFn: () => api<Row>(`/orders/${orderId}`) })
  return <Card title={`Chi tiết đơn #${orderId}`} className="action-card" loading={query.isPending}>
    {query.error && <Alert type="error" message={query.error.message} />}{query.data && <>
      <Descriptions items={[{ key: 'code', label: 'Mã đơn', children: String(query.data.order_code) }, { key: 'status', label: 'Trạng thái', children: String(query.data.order_status) }, { key: 'date', label: 'Ngày giao', children: String(query.data.delivery_date) }]} />
      {(query.data.items as Row[]).map(item => <p key={String(item.order_item_id)}>Dòng #{String(item.order_item_id)} · {String(item.sku_name)} · Đặt {String(item.requested_quantity)} · Giá {String(item.unit_price)} đ</p>)}
      <Typography.Title level={5}>Lô thực tế đã phân bổ</Typography.Title>
      {(query.data.allocations as Row[]).map((row, i) => <p key={i}>Dòng #{String(row.order_item_id)} · {String(row.batch_code)} (ID {String(row.batch_id)}) · {String(row.allocated_quantity)}</p>)}
      {(query.data.stops as Row[]).map(stop => <div key={String(stop.trip_stop_id)}><p>Điểm giao #{String(stop.trip_stop_id)}: {String(stop.status)}</p>{stop.restaurant_confirmed_at ? <Alert type="success" message={`Nhà hàng đã xác nhận lúc ${stop.restaurant_confirmed_at}`} /> : ['DELIVERED', 'PARTIALLY_DELIVERED', 'FAILED'].includes(String(stop.status)) && <ProofForm stop={stop} restaurant />}</div>)}
    </>}
  </Card>
}
export default function TripPage({ canOptimize = false }: { canOptimize?: boolean }) {
  const [selected, setSelected] = useState<number>(); const [error, setError] = useState(''); const client = useQueryClient()
  const query = useQuery({ queryKey: ['trip', selected], queryFn: () => api<Row>(`/trips/${selected}`), enabled: !!selected })
  return <><DataTable path="/trips" rowKey="trip_id" columns={[[ 'trip_code', 'Mã chuyến' ], ['trip_date', 'Ngày'], ['status', 'Trạng thái']]} actions={row => <Button onClick={() => setSelected(Number(row.trip_id))}>Mở chuyến</Button>} />
    {error && <Alert type="error" message={error} />}{query.error && <Alert type="error" message={query.error.message} />}
    {query.data && <Card title={String(query.data.trip_code)} extra={<Space><Button onClick={()=>void downloadApiFile(`/trips/${selected}/manifest`,`manifest-${selected}.csv`)}>Tải manifest</Button>{canOptimize&&['PLANNED','LOADING'].includes(String(query.data.status))&&<Button type="primary" onClick={async()=>{try{await api(`/trips/${selected}/optimize`,'POST');await client.invalidateQueries()}catch(e){setError((e as Error).message)}}}>Tối ưu thứ tự điểm</Button>}{!canOptimize&&query.data.status==='IN_PROGRESS'&&<Button onClick={()=>navigator.geolocation.getCurrentPosition(async p=>{try{await api(`/trips/${selected}/telemetry`,'POST',{latitude:p.coords.latitude,longitude:p.coords.longitude,temperatureC:null});setError('')}catch(e){setError((e as Error).message)}},()=>setError('Không lấy được vị trí. Hãy cấp quyền định vị cho trình duyệt.'))}>Cập nhật vị trí</Button>}</Space>}>
      {query.data.status === 'PLANNED' && <Button type="primary" size="large" onClick={async () => { try { await api(`/trips/${selected}/start`, 'POST'); await client.invalidateQueries() } catch (e) { setError((e as Error).message) } }}>Đã đối chiếu và nhận hàng — Bắt đầu chuyến</Button>}
      {(query.data.stops as Row[]).map(stop => <Card key={String(stop.trip_stop_id)} className="action-card" title={`Điểm ${stop.stop_sequence}: ${stop.address_line}`}>
        <p>{String(stop.district)}, {String(stop.city)} · {String(stop.contact_name ?? '')}</p><Space wrap>
          <a href={`tel:${stop.contact_phone}`}>Gọi người nhận</a><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address_line}, ${stop.district}, ${stop.city}`)}`} target="_blank" rel="noreferrer">Mở chỉ đường</a>
        </Space><p>Trạng thái: {String(stop.status)}</p>
        {query.data?.status === 'IN_PROGRESS' && stop.status === 'PENDING' && <><ProofForm stop={stop} restaurant={false} /><FailureForm stopId={stop.trip_stop_id}/></>}
        <ActionForm title="Giao hoặc thu thùng" path={v => `/assets/${v.assetId}/move`} fields={[
          { name: 'assetId', label: 'Thùng tại điểm giao', type: 'select', options: options(stop.assets as Row[], 'asset_id', 'asset_code') }, { name: 'action', label: 'Thao tác', type: 'select', options: [{ value: 'DELIVER', label: 'Giao thùng' }, { value: 'COLLECT', label: 'Thu hồi thùng' }] }, { name: 'note', label: 'Tình trạng và ghi chú' },
        ]} transform={v => ({ action: v.action, note: v.note, stopId: stop.trip_stop_id })} />
      </Card>)}
    </Card>}
  </>
}
