import { useState } from 'react'
import { Alert, Button, Card, Input, InputNumber, Select, Space, Table, Tabs, Typography } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/http'
import { ActionForm, DataTable, options, tomorrow, useRows, type Row } from '../components/Workspace'
import { OrderDetail } from './TripPage'

export default function RestaurantPage({ organizationId, initialTab = 'order' }: { organizationId: number; initialTab?: string }) {
  const [date, setDate] = useState(tomorrow()); const [cart, setCart] = useState<Record<string, number>>({})
  const [tab, setTab] = useState(initialTab); const [weeklyPlanId, setWeeklyPlanId] = useState<number>()
  const [address, setAddress] = useState<number>(); const [startTime, setStart] = useState('07:00'); const [endTime, setEnd] = useState('09:00')
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [selected, setSelected] = useState<number>()
  const [request, setRequest] = useState({ hash: '', key: crypto.randomUUID() }); const client = useQueryClient()
  const catalog = useRows(`/public/catalog?date=${date}`); const addresses = useRows(`/addresses?organizationId=${organizationId}`)
  const plans = useRows(`/weekly-plans?restaurantId=${organizationId}`)
  const total = (catalog.data ?? []).reduce((sum, row) => sum + Number(row.price ?? 0) * (cart[String(row.sku_id)] ?? 0), 0)
  const ordersPath = `/orders?restaurantId=${organizationId}`
  const orders = useRows(ordersPath)
  const order = useQuery({ queryKey: ['order', selected], queryFn: () => api<Row>(`/orders/${selected}`), enabled: !!selected })
  return <Tabs activeKey={tab} onChange={setTab} items={[
    { key: 'order', label: 'Đặt hàng', children: <>
      <Card title="Đặt hàng theo ngày giao"><Space wrap><Typography.Text strong>Ngày nhận hàng</Typography.Text><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Space>
        <Alert className="action-card" type="info" message="Giá và nguồn cung theo ngày đã chọn. Đơn đã chốt vẫn cần điều phối xác nhận nguồn." />
        {catalog.error && <Alert type="error" message={catalog.error.message} />}
        <Table<Row> rowKey="sku_id" loading={catalog.isPending} dataSource={catalog.data} pagination={false} scroll={{ x: 650 }} columns={[
          { title: 'Sản phẩm', dataIndex: 'sku_name' }, { title: 'Đơn vị', dataIndex: 'base_unit' }, { title: 'Giá (đ)', dataIndex: 'price', render: value => value == null ? 'Chưa có giá' : Number(value).toLocaleString('vi-VN') },
          { title: 'Nguồn dự kiến còn', dataIndex: 'available_quantity' }, { title: 'Số lượng', render: (_, row) => <InputNumber min={0} step={Number(row.quantity_step)} disabled={row.price == null} value={cart[String(row.sku_id)] ?? 0} onChange={v => setCart({ ...cart, [String(row.sku_id)]: v ?? 0 })} /> },
        ]} />
        <div className="form-grid action-card"><label>Địa chỉ giao<Select style={{ width: '100%' }} value={address} options={options(addresses.data?.filter(a => a.address_type === 'DELIVERY'), 'address_id', 'address_name')} onChange={value => setAddress(Number(value))} /></label>
          <label>Nhận từ<Input type="time" value={startTime} onChange={e => setStart(e.target.value)} /></label><label>Nhận đến<Input type="time" value={endTime} onChange={e => setEnd(e.target.value)} /></label></div>
        <Typography.Title level={4}>Tổng tiền: {total.toLocaleString('vi-VN')} đ</Typography.Title><p>Phí dịch vụ và giao hàng bản MVP: 0 đ.</p>
        {error && <Alert type="error" message={error} />}
        <Button type="primary" loading={busy} disabled={!address || !Object.values(cart).some(q => q > 0)} onClick={async () => {
          const body = { restaurantId: organizationId, addressId: address, date, startTime, endTime, weeklyPlanId, items: Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([skuId, quantity]) => ({ skuId: Number(skuId), quantity })) }
          const hash = JSON.stringify(body); const key = request.hash === hash ? request.key : crypto.randomUUID(); setRequest({ hash, key }); setBusy(true); setError('')
          try { const id = await api<number>('/orders', 'POST', body, key); setSelected(id); setCart({}); setWeeklyPlanId(undefined); await client.invalidateQueries() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
        }}>Xác nhận đặt hàng</Button>{weeklyPlanId && <Alert type="info" message="Giỏ hàng đang lấy từ kế hoạch tuần; giữ nguyên ngày và số lượng để xác nhận kế hoạch." action={<Button onClick={() => setWeeklyPlanId(undefined)}>Chuyển sang đơn riêng</Button>} />}
      </Card>{selected && <OrderDetail orderId={selected} />}
    </> },
    { key: 'orders', label: 'Đơn hàng', children: <><DataTable path={ordersPath} rowKey="order_id" columns={[[ 'order_code', 'Mã đơn' ], ['delivery_date', 'Ngày giao'], ['order_status', 'Trạng thái'], ['total_amount', 'Tổng tiền']]} actions={r => <Space><Button onClick={() => setSelected(Number(r.order_id))}>Chi tiết</Button><Button onClick={async () => {
      try { const old = await api<Row>(`/orders/${r.order_id}`); setCart(Object.fromEntries((old.items as Row[]).map(i => [String(i.sku_id), Number(i.requested_quantity)]))); setWeeklyPlanId(undefined); setTab('order'); setError('') } catch (e) { setError((e as Error).message) }
    }}>Đặt lại vào giỏ</Button></Space>} /><Alert type="info" message="Đặt lại: mở mục Đặt hàng, chọn ngày mới và kiểm tra lại giá trước khi xác nhận." />{selected && <OrderDetail orderId={selected} />}{order.error && <Alert type="error" message={order.error.message} />}</> },
    { key: 'weekly', label: 'Kế hoạch tuần', children: <><Alert type="info" message="Đây là nhu cầu dự kiến. Tạo và xác nhận đơn ngày tại mục Đặt hàng để chốt." /><ActionForm title="Nhu cầu tuần" path="/weekly-plans" fields={[
      { name: 'weekStart', label: 'Ngày thứ Hai đầu tuần', type: 'date' }, { name: 'skuId', label: 'Sản phẩm', type: 'select', options: options(catalog.data, 'sku_id', 'sku_name') }, { name: 'date', label: 'Ngày dự kiến', type: 'date' }, { name: 'quantity', label: 'Số lượng', type: 'number', min: 0.001 },
    ]} transform={v => ({ restaurantId: organizationId, weekStart: v.weekStart, items: [{ skuId: v.skuId, date: v.date, quantity: v.quantity }] })} /><DataTable path={`/weekly-plans?restaurantId=${organizationId}`} rowKey="weekly_plan_item_id" columns={[[ 'sku_name', 'Sản phẩm' ], ['demand_date', 'Ngày dự kiến'], ['planned_quantity', 'Số lượng'], ['status', 'Trạng thái kế hoạch']]} actions={row => row.converted_order_item_id == null && <Button onClick={() => {
      const lines = plans.data?.filter(p => p.weekly_plan_id === row.weekly_plan_id && p.demand_date === row.demand_date) ?? []
      setDate(String(row.demand_date)); setCart(Object.fromEntries(lines.map(i => [String(i.sku_id), Number(i.planned_quantity)]))); setWeeklyPlanId(Number(row.weekly_plan_id)); setTab('order')
    }}>Chuẩn bị đơn ngày</Button>} /></> },
    { key: 'profile', label: 'Địa chỉ', children: <><DataTable path={`/addresses?organizationId=${organizationId}`} rowKey="address_id" columns={[[ 'address_name', 'Tên' ], ['address_line', 'Địa chỉ'], ['district', 'Quận/huyện']]} /><ActionForm title="Địa chỉ giao" path="/addresses" fields={[
      { name: 'name', label: 'Tên địa chỉ' }, { name: 'address', label: 'Địa chỉ' }, { name: 'district', label: 'Quận/huyện' }, { name: 'city', label: 'Tỉnh/thành phố' }, { name: 'contactName', label: 'Người nhận' }, { name: 'phone', label: 'Số điện thoại' },
    ]} transform={v => ({ ...v, organizationId, type: 'DELIVERY' })} /></> },
    { key: 'claims', label: 'Khiếu nại', children: <><Select className="organization-select" placeholder="Chọn đơn cần phản ánh" value={selected} onChange={value => setSelected(Number(value))} options={options(orders.data, 'order_id', 'order_code')} /><ActionForm key={selected ?? 'new'} title="Khiếu nại" path="/claims" fields={[
      { name: 'orderItemId', label: 'Sản phẩm trong đơn', type: 'select', options: options(order.data?.items as Row[] | undefined, 'order_item_id', 'sku_name') }, { name: 'batchId', label: 'Lô liên quan', type: 'select', options: options(order.data?.allocations as Row[] | undefined, 'batch_id', 'batch_code') }, { name: 'quantity', label: 'Số lượng ảnh hưởng', type: 'number', min: 0.001 }, { name: 'description', label: 'Vấn đề và yêu cầu xử lý', type: 'textarea' },
    ]} /><DataTable path={`/claims?restaurantId=${organizationId}`} rowKey="complaint_id" columns={[[ 'complaint_code', 'Mã' ], ['description', 'Vấn đề'], ['status', 'Trạng thái'], ['final_resolution', 'Phương án']]} /></> },
    { key: 'billing', label: 'Thanh toán', children: <DataTable path={`/billing/orders?restaurantId=${organizationId}`} rowKey="order_id" columns={[[ 'order_code', 'Đơn' ], ['total_amount', 'Phải trả'], ['paid', 'Đã trả'], ['payment_status', 'Trạng thái']]} /> },
    { key: 'assets', label: 'Thùng đang giữ', children: <DataTable path={`/assets?restaurantId=${organizationId}`} rowKey="asset_id" columns={[[ 'asset_code', 'Mã thùng' ], ['status', 'Trạng thái'], ['condition_status', 'Tình trạng']]} /> },
  ]} />
}
