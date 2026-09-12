import { useState } from 'react'
import { Alert, Button, Card, Input, Space, Statistic, Tabs } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/http'
import { Link } from 'react-router-dom'
import { useUrlTab } from '../components/useUrlTab'
import { SourcingWorkbench } from './SourcingWorkbench'
import { useAuth } from '../auth/AuthContext'
import { ActionForm, DataTable, QrButton, options, tomorrow, useRows, type Row } from '../components/Workspace'
import TripPage from './TripPage'

export default function OperationsPage({ initialTab }: { initialTab?: string }) {
  const { membership } = useAuth(); const roles = membership?.roles ?? []
  const [tab,setTab]=useUrlTab(initialTab??(roles.includes('QUALITY_INSPECTOR')?'gate':roles.includes('CUSTOMER_SUPPORT')?'claims':roles.includes('ACCOUNTANT')?'billing':'overview'))
  const can = (role: string) => roles.includes('SYSTEM_ADMIN') || roles.includes(role)
  const [date, setDate] = useState(tomorrow()); const [error, setError] = useState(''); const client = useQueryClient()
  const lookup = useQuery({ queryKey: ['lookup'], queryFn: () => api<{ organizations: Row[]; addresses: Row[]; drivers: Row[] }>('/operations/lookup') })
  const catalog = useRows(`/public/catalog?date=${date}`)
  const categories = useRows('/public/categories')
  const assetRows = useRows('/assets', can('OPERATIONS_COORDINATOR'))
  const stopRows = useRows('/operations/stops', can('OPERATIONS_COORDINATOR'))
  const billOrders = useRows('/billing/orders', can('ACCOUNTANT'))
  const billBatches = useRows('/billing/suppliers', can('ACCOUNTANT'))
  const settlements = useRows('/billing/settlements', can('ACCOUNTANT'))
  const orders = useRows(`/operations/orders?date=${date}`, can('OPERATIONS_COORDINATOR'))
  const batches = useRows('/batches', can('OPERATIONS_COORDINATOR') || can('QUALITY_INSPECTOR'))
  const [cskhStatus, setCskhStatus] = useState<string>('')
  const [cskhDept, setCskhDept] = useState<string>('')
  const [cskhOverdue, setCskhOverdue] = useState(false)
  const dashboard = useQuery({ queryKey: ['dashboard', date], queryFn: () => api<Record<string, number>>(`/operations/dashboard?date=${date}`), enabled: can('OPERATIONS_COORDINATOR') })
  const docks = options(lookup.data?.addresses.filter(a => a.address_type === 'CROSS_DOCK'), 'address_id', 'address_name')
  return <><Space wrap className="action-card"><strong>Ngày vận hành</strong><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Space>
    {error && <Alert type="error" message={error} />}{lookup.error && <Alert type="error" message={lookup.error.message} />}
    <Tabs activeKey={tab} onChange={setTab} items={[
      ...(can('OPERATIONS_COORDINATOR') ? [
        { key: 'overview', label: 'Tổng quan', children: <><div className="stat-grid">{[['shortages', 'Đơn thiếu nguồn'], ['waitingBatches', 'Lô chờ kiểm'], ['trips', 'Chuyến chưa xong'], ['claims', 'Khiếu nại chờ xử lý']].map(([key, title]) => <Card key={key}><Statistic title={title} value={dashboard.data?.[key] ?? 0} loading={dashboard.isPending} /></Card>)}</div><DataTable path={`/operations/orders?date=${date}`} rowKey="order_id" columns={[[ 'order_code', 'Đơn' ], ['order_status', 'Trạng thái'], ['total_amount', 'Tổng tiền']]} /></> },
        {key:'source',label:'Phân nguồn',children:<SourcingWorkbench date={date}/>},
        { key: 'trips', label: 'Điều phối giao', children: <><ActionForm title="Chuyến giao" path="/trips" fields={[
          { name: 'date', label: 'Ngày giao', type: 'date', initial: date }, { name: 'originId', label: 'Điểm tập kết', type: 'select', options: docks }, { name: 'driverId', label: 'Tài xế', type: 'select', options: options(lookup.data?.drivers, 'user_id', 'full_name') }, { name: 'orderIds', label: 'Đơn theo thứ tự điểm giao', type: 'multiple', options: options(orders.data?.filter(o => ['SOURCING', 'CONFIRMED'].includes(String(o.order_status))), 'order_id', 'order_code') },
        ]} /><TripPage canOptimize /><DataTable path="/operations/stops" rowKey="trip_stop_id" columns={[[ 'label', 'Kiện theo điểm giao' ]]} actions={r => <QrButton type="DELIVERY_PACKAGE" id={r.trip_stop_id} />} /></> },
        { key: 'prices', label: 'Giá và cấu hình', children: <><ActionForm title="Giá bán" path="/operations/prices" fields={[
          { name: 'skuId', label: 'SKU', type: 'select', options: options(catalog.data, 'sku_id', 'sku_name') }, { name: 'price', label: 'Đơn giá bán (đ)', type: 'number' }, { name: 'date', label: 'Áp dụng từ ngày giao', type: 'date', initial: date },
        ]} /><ActionForm title="Sản phẩm và SKU" path="/operations/catalog" fields={[
          { name: 'categoryId', label: 'Nhóm sản phẩm', type: 'select', options: options(categories.data, 'category_id', 'category_name') }, { name: 'productCode', label: 'Mã sản phẩm' }, { name: 'name', label: 'Tên sản phẩm' }, { name: 'skuCode', label: 'Mã SKU' }, { name: 'packDescription', label: 'Quy cách' }, { name: 'unit', label: 'Đơn vị', type: 'select', options: [{ value: 'KG', label: 'kg' }, { value: 'PACK', label: 'Gói' }, { value: 'BOX', label: 'Hộp' }, { value: 'CRATE', label: 'Thùng' }] }, { name: 'packSize', label: 'Khối lượng mỗi đơn vị (kg)', type: 'number', min: 0.001 }, { name: 'minimum', label: 'Đặt tối thiểu', type: 'number', min: 0.001 }, { name: 'step', label: 'Bước tăng số lượng', type: 'number', min: 0.001 },
        ]} /><ActionForm title="Điểm tập kết" path="/addresses" fields={[
          { name: 'organizationId', label: 'Đơn vị FreshLink', type: 'select', options: options(lookup.data?.organizations.filter(o => o.organization_type === 'FRESHLINK'), 'organization_id', 'organization_name') }, { name: 'name', label: 'Tên điểm' }, { name: 'address', label: 'Địa chỉ' }, { name: 'district', label: 'Quận/huyện' }, { name: 'city', label: 'Tỉnh/thành phố' }, { name: 'contactName', label: 'Người liên hệ' }, { name: 'phone', label: 'Số điện thoại' },
        ]} transform={v => ({ ...v, type: 'CROSS_DOCK' })} /></> },
        { key: 'assets', label: 'Thùng', children: <><ActionForm title="Thùng mới" path="/assets" fields={[{ name: 'code', label: 'Mã thùng' }]} /><DataTable path="/assets" rowKey="asset_id" columns={[[ 'asset_id', 'ID' ], ['asset_code', 'Mã'], ['status', 'Trạng thái'], ['current_organization_id', 'Đơn vị giữ']]} actions={r => <QrButton type="RETURNABLE_ASSET" id={r.asset_id} />} /><ActionForm title="Luân chuyển thùng" path={v => `/assets/${v.assetId}/move`} fields={[
          { name: 'assetId', label: 'Thùng', type: 'select', options: options(assetRows.data, 'asset_id', 'asset_code') }, { name: 'action', label: 'Thao tác', type: 'select', options: [{ value: 'ISSUE', label: 'Cấp thùng cho chuyến' }, { value: 'CLEAN', label: 'Đã vệ sinh và kiểm tra đạt' }] }, { name: 'stopId', label: 'Điểm giao (khi cấp thùng)', type: 'select', required: false, options: options(stopRows.data, 'trip_stop_id', 'label') }, { name: 'note', label: 'Ghi chú' },
        ]} transform={v => ({ action: v.action, stopId: v.action === 'CLEAN' ? null : v.stopId, note: v.note })} /></> },
      ] : []),
      ...(can('QUALITY_INSPECTOR') || can('OPERATIONS_COORDINATOR') ? [{ key: 'gate', label: 'FreshLink Gate', children: <><DataTable path="/batches" rowKey="batch_id" columns={[[ 'batch_code', 'Mã lô' ], ['sku_name', 'Sản phẩm'], ['declared_quantity', 'Khai báo'], ['accepted_quantity', 'Đạt'], ['allocated_quantity', 'Đã chia'], ['review_quantity', 'Giữ lại'], ['rejected_quantity', 'Từ chối'], ['batch_status', 'Trạng thái']]} actions={r => <Link to={`/portal/batches/${r.batch_id}`}>Mở lô / kiểm nhận / tái kiểm</Link>} />{can('QUALITY_INSPECTOR')&&<ActionForm title="Kiểm nhận lô" path={v => `/batches/${v.batchId}/inspect`} fields={[
        { name: 'batchId', label: 'Lô chờ kiểm', type: 'select', options: options(batches.data?.filter(b => b.batch_status === 'CREATED'), 'batch_id', 'batch_code') }, { name: 'accepted', label: 'Lượng đạt', type: 'number', initial: 0 }, { name: 'review', label: 'Lượng giữ lại', type: 'number', initial: 0 }, { name: 'rejected', label: 'Lượng từ chối', type: 'number', initial: 0 }, { name: 'note', label: 'Quy cách, bao bì, nhãn, ngoại quan và hướng xử lý', type: 'textarea' },
        { name: 'evidenceId', label: 'Ảnh kiểm nhận', type: 'file', required: false },
        ...[['SPECIFICATION', 'Đúng quy cách'], ['PACKAGING', 'Bao bì'], ['LABEL', 'Nhãn'], ['APPEARANCE', 'Ngoại quan']].map(([name, label]) => ({ name, label, type: 'select' as const, initial: 'PASS', options: [{ value: 'PASS', label: 'Đạt' }, { value: 'REVIEW', label: 'Cần kiểm lại' }, { value: 'FAIL', label: 'Không đạt' }] })),
      ]} transform={v => ({ accepted: v.accepted, review: v.review, rejected: v.rejected, note: v.note, evidenceId: v.evidenceId, checklist: Object.fromEntries(['SPECIFICATION', 'PACKAGING', 'LABEL', 'APPEARANCE'].map(k => [k, v[k]])) })} />}</> }] : []),
      ...(can('CUSTOMER_SUPPORT') ? [{ key: 'claims', label: 'Hộp thư CSKH', children: <><Space wrap style={{ marginBottom: 16 }}>
        <select value={cskhStatus} onChange={e => setCskhStatus(e.target.value)} style={{ height: 38, padding: '0 10px', borderRadius: 6 }}>
          <option value="">-- Tất cả trạng thái --</option>
          <option value="SUBMITTED">Mới gửi</option>
          <option value="IN_REVIEW">Đang xử lý</option>
          <option value="RESOLVED">Đã có phương án</option>
          <option value="CLOSED">Đã đóng</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        <select value={cskhDept} onChange={e => setCskhDept(e.target.value)} style={{ height: 38, padding: '0 10px', borderRadius: 6 }}>
          <option value="">-- Tất cả bộ phận --</option>
          <option value="CSKH">CSKH</option>
          <option value="QC">Kiểm định QC</option>
          <option value="COORDINATOR">Điều phối giao</option>
          <option value="ACCOUNTANT">Kế toán</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={cskhOverdue} onChange={e => setCskhOverdue(e.target.checked)} />
          <b style={{ color: cskhOverdue ? '#cf1322' : 'inherit' }}>Chỉ quá hạn SLA</b>
        </label>
      </Space><DataTable path={`/claims/inbox?${cskhStatus ? `status=${cskhStatus}&` : ''}${cskhDept ? `department=${cskhDept}&` : ''}${cskhOverdue ? 'overdueOnly=true&' : ''}`} rowKey="complaint_id" columns={[[ 'complaint_code', 'Mã' ], ['restaurant_name', 'Khách hàng'], ['assigned_department', 'Bộ phận'], ['description', 'Vấn đề'], ['status', 'Trạng thái'], ['first_response_due_at', 'Hạn phản hồi'], ['resolution_due_at', 'Hạn giải quyết']]} actions={r => <Link to={`/portal/claims/${r.complaint_id}`}>Hồ sơ 360°</Link>} /></> }] : []),
      ...(can('ACCOUNTANT') ? [{ key: 'billing', label: 'Đối soát', children: <><DataTable path="/billing/orders" rowKey="order_id" columns={[[ 'order_id', 'ID' ], ['order_code', 'Đơn'], ['total_amount', 'Phải thu'], ['paid', 'Đã thu'], ['payment_status', 'Trạng thái']]} /><ActionForm title="Thanh toán thủ công" path="/billing/payments" fields={[
        { name: 'orderId', label: 'Đơn hàng', type: 'select', options: options(billOrders.data, 'order_id', 'order_code') }, { name: 'amount', label: 'Số tiền (đ)', type: 'number', min: 0.01 }, { name: 'method', label: 'Phương thức', type: 'select', options: [{ value: 'BANK_TRANSFER', label: 'Chuyển khoản' }, { value: 'CASH', label: 'Tiền mặt' }] }, { name: 'reference', label: 'Mã chứng từ / tham chiếu' },
      ]} /><ActionForm title="Điều chỉnh tiền đơn" path={v => `/billing/orders/${v.orderId}/adjust`} fields={[
        { name: 'orderId', label: 'Đơn hàng', type: 'select', options: options(billOrders.data, 'order_id', 'order_code') }, { name: 'amount', label: 'Mức điều chỉnh (+ tăng, − giảm)', type: 'number', min: -1000000000 }, { name: 'reason', label: 'Lý do đã thống nhất' },
      ]} transform={v => ({ amount: v.amount, reason: v.reason })} /><ActionForm title="Hoàn tiền" path={v => `/billing/orders/${v.orderId}/refund`} fields={[
        { name: 'orderId', label: 'Đơn hàng', type: 'select', options: options(billOrders.data, 'order_id', 'order_code') }, { name: 'amount', label: 'Số tiền hoàn', type: 'number', min: 0.01 }, { name: 'reference', label: 'Chứng từ hoàn tiền' }, { name: 'reason', label: 'Lý do' },
      ]} transform={v => ({ amount: v.amount, reference: v.reference, reason: v.reason })} /><DataTable path="/billing/suppliers" rowKey="batch_id" columns={[[ 'batch_id', 'ID lô' ], ['batch_code', 'Lô'], ['supplier_id', 'Nhà cung cấp'], ['accepted_quantity', 'Lượng đạt'], ['commission_rate', 'Hoa hồng (%)'], ['payable', 'Giá trị đối soát']]} />
      <ActionForm title="Chốt đối soát nhà cung cấp" path="/billing/settlements" fields={[
        { name: 'batchId', label: 'Lô hàng', type: 'select', options: options(billBatches.data, 'batch_id', 'batch_code') }, { name: 'adjustment', label: 'Điều chỉnh đã thống nhất', type: 'number', min: -1000000000, initial: 0 }, { name: 'note', label: 'Ghi chú và lý do điều chỉnh' },
      ]} /><DataTable path="/billing/settlements" rowKey="settlement_id" columns={[[ 'settlement_id', 'ID' ], ['settlement_code', 'Phiếu'], ['payable_amount', 'Phải trả'], ['status', 'Trạng thái'], ['paid_at', 'Ngày chi']]} /><ActionForm title="Chi trả nhà cung cấp" path={v => `/billing/settlements/${v.id}/pay`} fields={[
        { name: 'id', label: 'Phiếu đối soát', type: 'select', options: options(settlements.data, 'settlement_id', 'settlement_code') }, { name: 'reference', label: 'Mã chứng từ chi trả' },
      ]} transform={v => ({ reference: v.reference })} /></> }] : []),
      ...(can('SYSTEM_ADMIN') ? [{ key: 'partners', label: 'Tài khoản', children: <><DataTable path="/admin/partners/pending" rowKey="organization_id" columns={[[ 'organization_name', 'Đơn vị' ], ['organization_type', 'Loại']]} actions={r => <Button onClick={async () => { try { await api(`/admin/partners/${r.organization_id}/approve`, 'POST'); await client.invalidateQueries() } catch (e) { setError((e as Error).message) } }}>Duyệt hồ sơ</Button>} /><ActionForm title="Tài khoản nhân viên" path="/admin/staff" fields={[
        { name: 'email', label: 'Email' }, { name: 'fullName', label: 'Họ tên' }, { name: 'password', label: 'Mật khẩu ban đầu (ít nhất 12 ký tự)', type: 'password' }, { name: 'roles', label: 'Quyền được cấp', type: 'multiple', options: [{ value: 'OPERATIONS_COORDINATOR', label: 'Điều phối' }, { value: 'QUALITY_INSPECTOR', label: 'Kiểm hàng' }, { value: 'ACCOUNTANT', label: 'Kế toán' }, { value: 'CUSTOMER_SUPPORT', label: 'Chăm sóc khách hàng' }, { value: 'DRIVER', label: 'Tài xế' }] },
      ]} /></> }] : []),
    ]} />
  </>
}
