import { useState } from 'react'
import { Alert, Button, Card, Descriptions, Space, Typography } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadApiFile } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { can, display } from '../components/permissions'
import { Link } from 'react-router-dom'
import { ActionForm, DataTable, options, useRows, type Row } from '../components/Workspace'

function ProofForm({ stop, restaurant }: { stop: Row; restaurant: boolean }) {
  const items = stop.items as Row[]
  const {user}=useAuth()
  return <ActionForm title={restaurant ? 'Xác nhận nhận hàng' : 'Kết quả giao hàng'} path={`/stops/${stop.trip_stop_id}/${restaurant ? 'receive' : 'deliver'}`} fields={[
    { name: 'receiver', label: 'Người nhận', initial:restaurant?user?.fullName:stop.contact_name }, { name: 'note', label: 'Ghi chú (bắt buộc khi có sai lệch)', type: 'textarea',required:false },
    { name: 'evidenceId', label: 'Ảnh bằng chứng', type: 'file', required: false },
    ...items.map(item => ({ name: `q${item.delivery_item_id}`, label: `${item.sku_name} — xuất ${item.loaded_quantity}`, type: 'number' as const, min: 0, max: Number(item.loaded_quantity), initial: Number(restaurant ? item.delivered_quantity : item.loaded_quantity) })),
  ]} transform={v => ({ receiver: v.receiver, note: v.note||'', evidenceId: v.evidenceId, items: items.map(item => ({ deliveryItemId: item.delivery_item_id, quantity: v[`q${item.delivery_item_id}`] })) })} />
}
function FailureForm({ stopId }: { stopId: unknown }) {
  const reasons=useRows('/delivery-failure-reasons')
  return <ActionForm title="Báo giao thất bại" path={`/stops/${stopId}/fail`} fields={[{name:'reasonCode',label:'Lý do',type:'select',options:options(reasons.data,'reason_code','label')},{name:'reason',label:'Mô tả chi tiết',type:'textarea'}]}/>
}
export function OrderDetail({ orderId }: { orderId: number }) {
  const {membership}=useAuth();const buyer=can(membership,'RESTAURANT_MANAGER','RESTAURANT_PURCHASER')&&membership?.organizationType==='RESTAURANT';const receiver=can(membership,'RESTAURANT_MANAGER','RESTAURANT_RECEIVER')&&membership?.organizationType==='RESTAURANT'
  const query = useQuery({ queryKey: ['order', orderId], queryFn: () => api<Row>(`/orders/${orderId}`) })
  return <Card title={`Chi tiết đơn #${orderId}`} className="action-card" loading={query.isPending}>
    {query.error && <Alert type="error" message={query.error.message} />}{query.data && <>
      <Descriptions items={[{ key: 'code', label: 'Mã đơn', children: String(query.data.order_code) }, { key: 'status', label: 'Trạng thái', children: display(query.data.order_status) }, { key: 'date', label: 'Ngày giao', children: String(query.data.delivery_date) },{key:'cutoff',label:'Hạn thay đổi',children:display(query.data.cutoffAt,'cutoff_at')}]} />
      {query.data.rejection_reason!=null&&<Alert type="warning" message={String(query.data.rejection_reason)}/>}
      {buyer&&query.data.order_status==='DRAFT'&&<ActionForm title="Gửi đơn nháp" path={`/orders/${orderId}/submit`} fields={[]} onDone={()=>void query.refetch()}/>}
      {can(membership,'RESTAURANT_MANAGER')&&query.data.order_status==='SUBMITTED'&&<ActionForm title="Duyệt đơn" path={`/orders/${orderId}/approve`} fields={[{name:'approved',label:'Quyết định',type:'select',options:[{value:'yes',label:'Duyệt'},{value:'no',label:'Trả về để sửa'}]},{name:'reason',label:'Lý do (bắt buộc khi từ chối)',required:false}]} transform={v=>({...v,approved:v.approved==='yes'})} onDone={()=>void query.refetch()}/>}
      {buyer&&['DRAFT','SUBMITTED','CONFIRMED','SOURCING'].includes(String(query.data.order_status))&&<ActionForm title="Hủy đơn" path={`/orders/${orderId}/cancel`} fields={[{name:'reason',label:'Lý do hủy'}]} onDone={()=>void query.refetch()}/>}
      {(query.data.items as Row[]).map(item => <p key={String(item.order_item_id)}>Dòng #{String(item.order_item_id)} · {String(item.sku_name)} · Đặt {String(item.requested_quantity)} · Giá {String(item.unit_price)} đ</p>)}
      <Typography.Title level={5}>Lô thực tế đã phân bổ</Typography.Title>
      {(query.data.allocations as Row[]).map((row, i) => <div key={i}><p>{String((query.data?.items as Row[]).find(x=>x.order_item_id===row.order_item_id)?.sku_name)} · {String(row.batch_code)} · {String(row.allocated_quantity)}</p>{receiver&&<ActionForm title="Báo thiếu / hỏng" path="/claims" fields={[{name:'quantity',label:'Số lượng ảnh hưởng',type:'number',min:0.001,max:Number(row.allocated_quantity)},{name:'description',label:'Vấn đề và yêu cầu xử lý',type:'textarea'},{name:'evidenceId',label:'Ảnh',type:'file',required:false}]} transform={v=>({...v,orderItemId:row.order_item_id,batchId:row.batch_id})}/>}</div>)}
      {(query.data.stops as Row[]).map(stop => <div key={String(stop.trip_stop_id)}><p>Giao nhận: {display(stop.status)}</p>{(stop.items as Row[]).map(x=><p key={String(x.delivery_item_id)}>{String(x.sku_name)} · Xuất {String(x.loaded_quantity)} · Tài xế giao {String(x.delivered_quantity??0)} · Nhà hàng nhận {String(x.received_quantity??'Chưa xác nhận')}</p>)}{stop.restaurant_confirmed_at ? <Alert type="success" message={`Nhà hàng đã xác nhận lúc ${display(stop.restaurant_confirmed_at,'confirmed_at')}`} /> : receiver&&['DELIVERED', 'PARTIALLY_DELIVERED', 'FAILED'].includes(String(stop.status)) && <ProofForm stop={stop} restaurant />}</div>)}
      <Typography.Title level={5}>Tiến trình</Typography.Title>{(query.data.history as Row[]??[]).map((x,i)=><p key={i}>{display(x.created_at??x.changed_at,'created_at')} · {display(x.new_status)} · {String(x.full_name??'')} · {String(x.reason??'')}</p>)}
    </>}
  </Card>
}
export default function TripPage({ canOptimize = false,initialSelected }: { canOptimize?: boolean;initialSelected?:number }) {
  const [selected] = useState<number|undefined>(initialSelected); const [error, setError] = useState(''); const client = useQueryClient()
  const query = useQuery({ queryKey: ['trip', selected], queryFn: () => api<Row>(`/trips/${selected}`), enabled: !!selected })
  return <>{!selected&&<DataTable path="/trips" rowKey="trip_id" columns={[[ 'trip_code', 'Mã chuyến' ], ['trip_date', 'Ngày'], ['status', 'Trạng thái']]} actions={row => <Link to={`/portal/trips/${row.trip_id}`}>Mở chuyến</Link>} />}
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
