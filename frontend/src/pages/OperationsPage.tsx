import { useState } from 'react'
import { Alert, Button, Card, Input, Space, Statistic, Tabs } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { ActionForm, DataTable, QrButton, options, tomorrow, useRows, type Row } from '../components/Workspace'
import TripPage from './TripPage'

export default function OperationsPage({ initialTab }: { initialTab?: string }) {
  const { user } = useAuth(); const roles = user!.memberships.flatMap(m => m.roles)
  const can = (role: string) => roles.includes('SYSTEM_ADMIN') || roles.includes(role)
  const [date, setDate] = useState(tomorrow()); const [error, setError] = useState(''); const client = useQueryClient()
  const lookup = useQuery({ queryKey: ['lookup'], queryFn: () => api<{ organizations: Row[]; addresses: Row[]; drivers: Row[] }>('/operations/lookup') })
  const catalog = useRows(`/public/catalog?date=${date}`)
  const categories = useRows('/public/categories')
  const assetRows = useRows('/assets', can('OPERATIONS_COORDINATOR'))
  const stopRows = useRows('/operations/stops', can('OPERATIONS_COORDINATOR'))
  const claimRows = useRows('/claims', can('CUSTOMER_SUPPORT'))
  const billOrders = useRows('/billing/orders', can('ACCOUNTANT'))
  const billBatches = useRows('/billing/suppliers', can('ACCOUNTANT'))
  const settlements = useRows('/billing/settlements', can('ACCOUNTANT'))
  const offers = useRows(`/operations/offers?date=${date}`, can('OPERATIONS_COORDINATOR'))
  const demand = useRows(`/operations/demand?date=${date}`, can('OPERATIONS_COORDINATOR'))
  const orders = useRows(`/operations/orders?date=${date}`, can('OPERATIONS_COORDINATOR'))
  const batches = useRows('/batches', can('OPERATIONS_COORDINATOR') || can('QUALITY_INSPECTOR'))
  const dashboard = useQuery({ queryKey: ['dashboard', date], queryFn: () => api<Record<string, number>>(`/operations/dashboard?date=${date}`), enabled: can('OPERATIONS_COORDINATOR') })
  const docks = options(lookup.data?.addresses.filter(a => a.address_type === 'CROSS_DOCK'), 'address_id', 'address_name')
  return <><Space wrap className="action-card"><strong>Ngày vận hành</strong><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Space>
    {error && <Alert type="error" message={error} />}{lookup.error && <Alert type="error" message={lookup.error.message} />}
    <Tabs defaultActiveKey={initialTab} items={[
      ...(can('OPERATIONS_COORDINATOR') ? [
        { key: 'overview', label: 'Tổng quan', children: <><div className="stat-grid">{[['shortages', 'Đơn thiếu nguồn'], ['waitingBatches', 'Lô chờ kiểm'], ['trips', 'Chuyến chưa xong'], ['claims', 'Khiếu nại chờ xử lý']].map(([key, title]) => <Card key={key}><Statistic title={title} value={dashboard.data?.[key] ?? 0} loading={dashboard.isPending} /></Card>)}</div><DataTable path={`/operations/orders?date=${date}`} rowKey="order_id" columns={[[ 'order_code', 'Đơn' ], ['order_status', 'Trạng thái'], ['total_amount', 'Tổng tiền']]} /></> },
        { key: 'source', label: 'Phân nguồn', children: <><DataTable path={`/operations/demand?date=${date}`} rowKey="order_item_id" columns={[[ 'order_item_id', 'Dòng đơn' ], ['order_code', 'Đơn'], ['sku_name', 'Sản phẩm'], ['confirmed_quantity', 'Cần'], ['sourced_quantity', 'Đã phân nguồn']]} /><DataTable path={`/operations/offers?date=${date}`} rowKey="supplier_offer_id" columns={[[ 'organization_name', 'Nhà cung cấp' ], ['sku_name', 'Sản phẩm'], ['available_quantity', 'Năng lực'], ['reserved_quantity', 'Đã giữ'], ['supplier_unit_price', 'Giá']]} />
          <ActionForm title="Yêu cầu cung ứng" path="/operations/supply-requests" fields={[
            { name: 'orderItemId', label: 'Dòng đơn', type: 'select', options: options(demand.data, 'order_item_id', 'sku_name') }, { name: 'offerId', label: 'Nguồn cung', type: 'select', options: options(offers.data, 'supplier_offer_id', 'organization_name') }, { name: 'crossDockId', label: 'Điểm tập kết', type: 'select', options: docks }, { name: 'arrivalTime', label: 'Giờ yêu cầu đến', type: 'time', initial: '05:00' }, { name: 'quantity', label: 'Số lượng', type: 'number', min: 0.001 }, { name: 'commissionRate', label: 'Hoa hồng (%)', type: 'number', max: 100, initial: 0 },
          ]} /><ActionForm title="Chia hàng đạt vào đơn" path="/allocations" fields={[
            { name: 'batchId', label: 'Lô', type: 'select', options: options(batches.data?.filter(b => Number(b.accepted_quantity) > Number(b.allocated_quantity)), 'batch_id', 'batch_code') }, { name: 'orderItemId', label: 'Dòng đơn', type: 'select', options: options(demand.data, 'order_item_id', 'sku_name') }, { name: 'quantity', label: 'Lượng chia', type: 'number', min: 0.001 },
          ]} /></> },
        { key: 'trips', label: 'Điều phối giao', children: <><ActionForm title="Chuyến giao" path="/trips" fields={[
          { name: 'date', label: 'Ngày giao', type: 'date', initial: date }, { name: 'originId', label: 'Điểm tập kết', type: 'select', options: docks }, { name: 'driverId', label: 'Tài xế', type: 'select', options: options(lookup.data?.drivers, 'user_id', 'full_name') }, { name: 'orderIds', label: 'Đơn theo thứ tự điểm giao', type: 'multiple', options: options(orders.data?.filter(o => ['SOURCING', 'CONFIRMED'].includes(String(o.order_status))), 'order_id', 'order_code') },
        ]} /><TripPage /><DataTable path="/operations/stops" rowKey="trip_stop_id" columns={[[ 'label', 'Kiện theo điểm giao' ]]} actions={r => <QrButton type="DELIVERY_PACKAGE" id={r.trip_stop_id} />} /></> },
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
      ...(can('QUALITY_INSPECTOR') ? [{ key: 'gate', label: 'FreshLink Gate', children: <><DataTable path="/batches" rowKey="batch_id" columns={[[ 'batch_code', 'Mã lô' ], ['sku_name', 'Sản phẩm'], ['declared_quantity', 'Khai báo'], ['accepted_quantity', 'Đạt'], ['allocated_quantity', 'Đã chia'], ['review_quantity', 'Giữ lại'], ['rejected_quantity', 'Từ chối'], ['batch_status', 'Trạng thái']]} actions={r => <QrButton type="BATCH" id={r.batch_id} />} /><ActionForm title="Kiểm nhận lô" path={v => `/batches/${v.batchId}/inspect`} fields={[
        { name: 'batchId', label: 'Lô chờ kiểm', type: 'select', options: options(batches.data?.filter(b => b.batch_status === 'CREATED'), 'batch_id', 'batch_code') }, { name: 'accepted', label: 'Lượng đạt', type: 'number', initial: 0 }, { name: 'review', label: 'Lượng giữ lại', type: 'number', initial: 0 }, { name: 'rejected', label: 'Lượng từ chối', type: 'number', initial: 0 }, { name: 'note', label: 'Quy cách, bao bì, nhãn, ngoại quan và hướng xử lý', type: 'textarea' },
        { name: 'evidenceId', label: 'Ảnh kiểm nhận', type: 'file', required: false },
        ...[['SPECIFICATION', 'Đúng quy cách'], ['PACKAGING', 'Bao bì'], ['LABEL', 'Nhãn'], ['APPEARANCE', 'Ngoại quan']].map(([name, label]) => ({ name, label, type: 'select' as const, initial: 'PASS', options: [{ value: 'PASS', label: 'Đạt' }, { value: 'REVIEW', label: 'Cần kiểm lại' }, { value: 'FAIL', label: 'Không đạt' }] })),
      ]} transform={v => ({ accepted: v.accepted, review: v.review, rejected: v.rejected, note: v.note, evidenceId: v.evidenceId, checklist: Object.fromEntries(['SPECIFICATION', 'PACKAGING', 'LABEL', 'APPEARANCE'].map(k => [k, v[k]])) })} /></> }] : []),
      ...(can('CUSTOMER_SUPPORT') ? [{ key: 'claims', label: 'Khiếu nại', children: <><DataTable path="/claims" rowKey="complaint_id" columns={[[ 'complaint_id', 'ID' ], ['complaint_code', 'Mã'], ['description', 'Vấn đề'], ['status', 'Trạng thái'], ['final_resolution', 'Phương án']]} /><ActionForm title="Phương án xử lý" path={v => `/claims/${v.id}/resolve`} fields={[{ name: 'id', label: 'Khiếu nại', type: 'select', options: options(claimRows.data, 'complaint_id', 'complaint_code') }, { name: 'resolution', label: 'Phương án đã thống nhất', type: 'textarea' }]} transform={v => ({ resolution: v.resolution })} /></> }] : []),
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
