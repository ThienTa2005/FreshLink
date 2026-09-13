import { useState } from 'react'
import { Alert, Button, Card, Input, Space, Statistic, Tabs, Tag } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/http'
import { Link } from 'react-router-dom'
import { useUrlTab } from '../components/useUrlTab'
import { SourcingWorkbench } from './SourcingWorkbench'
import { useAuth } from '../auth/AuthContext'
import { ActionForm, DataTable, EvidenceLink, QrButton, options, tomorrow, useRows, type Row } from '../components/Workspace'
import TripPage from './TripPage'
import { AiTripOptimizerModal } from '../components/AiTripOptimizerModal'
import { CoopTrustScoreModal } from '../components/CoopTrustScoreModal'

export default function OperationsPage({ initialTab }: { initialTab?: string }) {
  const { membership } = useAuth(); const roles = membership?.roles ?? []
  const [tab,setTab]=useUrlTab(initialTab??(roles.includes('QUALITY_INSPECTOR')?'gate':roles.includes('CUSTOMER_SUPPORT')?'claims':roles.includes('ACCOUNTANT')?'billing':'overview'))
  const can = (role: string) => roles.includes('SYSTEM_ADMIN') || roles.includes(role)
  const [date, setDate] = useState(tomorrow()); const [error, setError] = useState(''); const client = useQueryClient()
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [selectedDockId, setSelectedDockId] = useState<number>()
  const [trustModalOpen, setTrustModalOpen] = useState(false)
  const [selectedTrustSupplierId, setSelectedTrustSupplierId] = useState<number>()
  const [selectedTrustSupplierName, setSelectedTrustSupplierName] = useState<string>()
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
  const candidateOrders = orders.data?.filter(o => ['SOURCING', 'CONFIRMED'].includes(String(o.order_status))) || []

  return <><Space wrap className="action-card"><strong>Ngày vận hành</strong><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Space>
    {error && <Alert type="error" message={error} />}{lookup.error && <Alert type="error" message={lookup.error.message} />}
    <Tabs activeKey={tab} onChange={setTab} items={[
      ...(can('OPERATIONS_COORDINATOR') ? [
        { key: 'overview', label: 'Tổng quan', children: <>
          <div className="stat-grid">{[['shortages', 'Đơn thiếu nguồn'], ['waitingBatches', 'Lô chờ kiểm'], ['trips', 'Chuyến chưa xong'], ['claims', 'Khiếu nại chờ xử lý']].map(([key, title]) => <Card key={key}><Statistic title={title} value={dashboard.data?.[key] ?? 0} loading={dashboard.isPending} /></Card>)}</div>

          {/* REVENUE & PRICING SPREAD MARGIN MODEL */}
          <div style={{
            margin: '20px 0',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1.5px solid #a7f3d0',
            borderRadius: 14,
            padding: '20px 24px',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#059669' }}>payments</span>
                <div>
                  <h3 style={{ margin: 0, color: '#064e3b', fontSize: 17, fontWeight: 700 }}>
                    Báo Cáo Minh Bạch Doanh Thu Sàn & Khấu Trừ Chênh Lệch Giá (Revenue Model)
                  </h3>
                  <p style={{ margin: '2px 0 0', color: '#047857', fontSize: 13 }}>
                    Cơ chế dòng tiền 3 bên: Hợp tác xã (HTX) — FreshLink Platform — Nhà hàng F&B
                  </p>
                </div>
              </div>
              <Tag color="success" style={{ fontWeight: 700, padding: '4px 10px', fontSize: 12 }}>
                ĐỐI SOÁT TỰ ĐỘNG
              </Tag>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
              <div style={{ background: '#ffffff', borderRadius: 10, padding: '14px 16px', border: '1px solid #bbf7d0' }}>
                <strong style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#059669' }}>trending_up</span>
                  1. Chênh Lệch Giá Mua - Bán (Trading Margin)
                </strong>
                <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 12.5 }}>
                  FreshLink ký hợp đồng thu mua với HTX theo <code>supplier_unit_price</code> và phân phối cho Nhà hàng theo <code>selling_unit_price</code>. Khấu trừ chênh lệch tạo biên lợi nhuận gộp <strong>15% - 25%</strong>.
                </p>
              </div>

              <div style={{ background: '#ffffff', borderRadius: 10, padding: '14px 16px', border: '1px solid #bbf7d0' }}>
                <strong style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#059669' }}>percent</span>
                  2. Hoa Hồng Sàn B2B (Commission Fee)
                </strong>
                <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 12.5 }}>
                  Khấu trừ tự động <strong>3% - 8%</strong> trên tổng doanh số đối soát thanh toán định kỳ của HTX khi hoàn tất giao nhận qua cổng Gate KCS.
                </p>
              </div>

              <div style={{ background: '#ffffff', borderRadius: 10, padding: '14px 16px', border: '1px solid #bbf7d0' }}>
                <strong style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#059669' }}>local_shipping</span>
                  3. Phí Chuỗi Lạnh & Thùng SmartCrate
                </strong>
                <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 12.5 }}>
                  Phí vận hành đội xe lạnh chuyên dụng (+2°C ~ +6°C) và phí thuê, vệ sinh khử trùng thùng nhựa luân chuyển thông minh SmartCrate.
                </p>
              </div>
            </div>

            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: 8 }}>
              <small style={{ color: '#047857' }}>
                💡 <strong>Nguyên tắc minh bạch:</strong> Giá thu mua của HTX và giá xuất bán cho Nhà hàng đều được công khai minh bạch trên phiếu đối soát điện tử, loại bỏ hoàn toàn tầng lớp thương lái trung gian.
              </small>
            </div>
          </div>

          <DataTable path={`/operations/orders?date=${date}`} rowKey="order_id" columns={[[ 'order_code', 'Đơn' ], ['order_status', 'Trạng thái'], ['total_amount', 'Tổng tiền']]} />
        </> },
        {key:'source',label:'Phân nguồn',children:<SourcingWorkbench date={date}/>},
        { key: 'trips', label: 'Điều phối giao', children: <>
          {/* AI SMART DISPATCH HERO CARD */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1.5px solid #86efac',
            borderRadius: 14,
            padding: '18px 22px',
            marginBottom: 20,
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28 }}>smart_toy</span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, color: '#064e3b', fontSize: 18, fontWeight: 700 }}>
                      Điều Phối Thông Minh — Tối Ưu Ghép Chuyến Bằng AI
                    </h3>
                    <span style={{ background: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                      Google Gemini
                    </span>
                  </div>
                  <p style={{ margin: 0, color: '#047857', fontSize: 13.5 }}>
                    AI tự động phân tích tọa độ GPS, tải trọng xe lạnh, khoảng cách đường đi và chi phí để đề xuất gom chuyến tối ưu.
                    {candidateOrders.length > 0 ? (
                      <strong style={{ color: '#065f46', marginLeft: 6 }}>
                        (Đang có {candidateOrders.length} đơn hàng sẵn sàng chia chuyến)
                      </strong>
                    ) : (
                      <span style={{ color: '#64748b', marginLeft: 6 }}>(Chưa có đơn chờ chia chuyến ngày này)</span>
                    )}
                  </p>
                </div>
              </div>

              <Space size="middle" wrap>
                <select
                  value={selectedDockId ?? (docks[0] ? Number(docks[0].value) : '')}
                  onChange={e => setSelectedDockId(Number(e.target.value))}
                  style={{ height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #a7f3d0', background: '#ffffff', fontWeight: 500 }}
                >
                  {docks.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>

                <Button
                  type="primary"
                  size="large"
                  onClick={() => {
                    if (!selectedDockId && docks.length > 0) {
                      setSelectedDockId(Number(docks[0].value))
                    }
                    setAiModalOpen(true)
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    borderColor: '#047857',
                    height: 40,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>auto_awesome</span>
                  Phân tích & Gợi ý ghép chuyến AI
                </Button>
              </Space>
            </div>
          </div>

          <AiTripOptimizerModal
            open={aiModalOpen}
            onClose={() => setAiModalOpen(false)}
            date={date}
            originId={selectedDockId || (docks[0] ? Number(docks[0].value) : undefined)}
            drivers={lookup.data?.drivers}
            onApplied={async () => {
              await client.invalidateQueries()
            }}
          />

          <ActionForm title="Chuyến giao (Tự ghép tay thủ công)" path="/trips" fields={[
            { name: 'date', label: 'Ngày giao', type: 'date', initial: date }, { name: 'originId', label: 'Điểm tập kết', type: 'select', options: docks }, { name: 'driverId', label: 'Tài xế', type: 'select', options: options(lookup.data?.drivers, 'user_id', 'full_name') }, { name: 'orderIds', label: 'Đơn theo thứ tự điểm giao', type: 'multiple', options: options(candidateOrders, 'order_id', 'order_code') },
          ]} /><TripPage canOptimize /><DataTable path="/operations/stops" rowKey="trip_stop_id" columns={[[ 'label', 'Kiện theo điểm giao' ]]} actions={r => <QrButton type="DELIVERY_PACKAGE" id={r.trip_stop_id} />} /></> },
        { key: 'prices', label: 'Giá và cấu hình', children: <><ActionForm title="Giá bán" path="/operations/prices" fields={[
          { name: 'skuId', label: 'SKU', type: 'select', options: options(catalog.data, 'sku_id', 'sku_name') }, { name: 'price', label: 'Đơn giá bán (đ)', type: 'number' }, { name: 'date', label: 'Áp dụng từ ngày giao', type: 'date', initial: date },
        ]} /><ActionForm title="Sản phẩm và SKU" path="/operations/catalog" fields={[
          { name: 'categoryId', label: 'Nhóm sản phẩm', type: 'select', options: options(categories.data, 'category_id', 'category_name') }, { name: 'productCode', label: 'Mã sản phẩm' }, { name: 'name', label: 'Tên sản phẩm' }, { name: 'skuCode', label: 'Mã SKU' }, { name: 'packDescription', label: 'Quy cách' }, { name: 'unit', label: 'Đơn vị', type: 'select', options: [{ value: 'KG', label: 'kg' }, { value: 'PACK', label: 'Gói' }, { value: 'BOX', label: 'Hộp' }, { value: 'CRATE', label: 'Thùng' }] }, { name: 'packSize', label: 'Khối lượng mỗi đơn vị (kg)', type: 'number', min: 0.001 }, { name: 'minimum', label: 'Đặt tối thiểu', type: 'number', min: 0.001 }, { name: 'step', label: 'Bước tăng số lượng', type: 'number', min: 0.001 },
        ]} /><ActionForm title="Điểm tập kết" path="/addresses" fields={[
          { name: 'organizationId', label: 'Đơn vị FreshLink', type: 'select', options: options(lookup.data?.organizations.filter(o => o.organization_type === 'FRESHLINK'), 'organization_id', 'organization_name') }, { name: 'name', label: 'Tên điểm' }, { name: 'address', label: 'Số nhà, tên đường' }, { name: 'ward', label: 'Phường/xã' }, { name: 'district', label: 'Quận/huyện' }, { name: 'city', label: 'Tỉnh/thành phố', initial: 'Hà Nội' }, { name: 'contactName', label: 'Người liên hệ' }, { name: 'phone', label: 'Số điện thoại' },
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
      ...(can('SYSTEM_ADMIN') || can('OPERATIONS_COORDINATOR') ? [{
        key: 'vietgap_docs',
        label: 'Duyệt VietGAP HTX',
        children: (
          <>
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1.5px solid #86efac',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 16
            }}>
              <h3 style={{ margin: 0, color: '#064e3b', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#059669' }}>verified_user</span>
                Trung Tâm Kiểm Định & Phê Duyệt Hồ Sơ VietGAP Nông Sản
              </h3>
              <p style={{ margin: '4px 0 0', color: '#047857', fontSize: 13.5 }}>
                Khi Quản trị viên duyệt chứng chỉ VietGAP, Hợp tác xã sẽ lập tức được cấp quyền sinh <strong>Mã QR Động</strong> và phát hành chứng thư truy xuất nguồn gốc công khai trên toàn hệ thống.
              </p>
            </div>

            <DataTable
              path="/admin/supplier-documents/pending"
              rowKey="supplier_document_id"
              columns={[
                ['supplier_name', 'Hợp tác xã / NCC'],
                ['document_type', 'Loại hồ sơ'],
                ['document_number', 'Số chứng nhận'],
                ['certifying_body', 'Tổ chức cấp'],
                ['certification_scope', 'Phạm vi cây trồng'],
                ['issued_date', 'Ngày cấp'],
                ['expiry_date', 'Hết hạn'],
                ['verification_status', 'Trạng thái']
              ]}
              actions={r => (
                <Space wrap>
                  {r.file_id != null && <EvidenceLink id={Number(r.file_id)} />}
                  {r.verification_status !== 'APPROVED' && (
                    <Button
                      type="primary"
                      size="small"
                      style={{ background: '#176b45' }}
                      onClick={async () => {
                        try {
                          await api(`/admin/supplier-documents/${r.supplier_document_id}/verify`, 'POST', { approved: true })
                          await client.invalidateQueries()
                        } catch (e) {
                          setError((e as Error).message)
                        }
                      }}
                    >
                      Duyệt VietGAP
                    </Button>
                  )}
                  {r.verification_status === 'PENDING' && (
                    <Button
                      danger
                      size="small"
                      onClick={async () => {
                        const reason = window.prompt('Lý do từ chối hoặc yêu cầu bổ sung:', 'Chứng chỉ mờ hoặc hết hạn hiệu lực')
                        if (reason === null) return
                        try {
                          await api(`/admin/supplier-documents/${r.supplier_document_id}/verify`, 'POST', { approved: false, reason })
                          await client.invalidateQueries()
                        } catch (e) {
                          setError((e as Error).message)
                        }
                      }}
                    >
                      Từ chối
                    </Button>
                  )}
                </Space>
              )}
            />
          </>
        )
      }] : []),
      ...(can('SYSTEM_ADMIN') || can('OPERATIONS_COORDINATOR') ? [{
        key: 'coop_rankings',
        label: 'Xếp Hạng Tín Nhiệm HTX',
        children: (
          <>
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1.5px solid #86efac',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#064e3b', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#059669' }}>military_tech</span>
                  Hệ Thống Đánh Giá & Xếp Hạng Tín Nhiệm Hợp Tác Xã (Coop Trust Score)
                </h3>
                <p style={{ margin: '4px 0 0', color: '#047857', fontSize: 13.5 }}>
                  Thang điểm 100 tính toán tự động dựa trên 5 trụ cột: Tỷ lệ KCS Gate (35%), Cam kết cung ứng (25%), Chứng nhận VietGAP (20%), Khiếu nại (10%), Thâm niên (10%).
                </p>
              </div>
              <Button
                type="primary"
                style={{ background: '#176b45', fontWeight: 600 }}
                onClick={async () => {
                  try {
                    await api('/admin/suppliers/recalculate-trust', 'POST')
                    await client.invalidateQueries()
                  } catch (e) {
                    setError((e as Error).message)
                  }
                }}
              >
                🔄 Tính toán lại toàn sàn
              </Button>
            </div>

            <DataTable
              path="/suppliers/trust-scores"
              rowKey="supplier_id"
              columns={[
                ['rank', 'Thứ hạng'],
                ['organization_name', 'Hợp tác xã / NCC'],
                ['supplier_score', 'Tổng điểm (0-100)'],
                ['tier_rank', 'Hạng danh hiệu'],
                ['quality_score', 'Điểm KCS Gate (35đ)'],
                ['fulfillment_score', 'Cam kết cung ứng (25đ)'],
                ['cert_score', 'Chứng nhận (20đ)'],
                ['has_approved_vietgap', 'VietGAP Quốc Gia']
              ]}
              actions={r => (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={() => {
                    setSelectedTrustSupplierId(Number(r.supplier_id))
                    setSelectedTrustSupplierName(String(r.organization_name))
                    setTrustModalOpen(true)
                  }}
                >
                  Bảng điểm 5 trụ cột
                </Button>
              )}
            />
          </>
        )
      }] : []),
      ...(can('SYSTEM_ADMIN') ? [{ key: 'partners', label: 'Tài khoản', children: <><DataTable path="/admin/partners/pending" rowKey="organization_id" columns={[[ 'organization_name', 'Đơn vị' ], ['organization_type', 'Loại']]} actions={r => <Button onClick={async () => { try { await api(`/admin/partners/${r.organization_id}/approve`, 'POST'); await client.invalidateQueries() } catch (e) { setError((e as Error).message) } }}>Duyệt hồ sơ</Button>} /><ActionForm title="Tài khoản nhân viên" path="/admin/staff" fields={[
        { name: 'email', label: 'Email' }, { name: 'fullName', label: 'Họ tên' }, { name: 'password', label: 'Mật khẩu ban đầu (ít nhất 12 ký tự)', type: 'password' }, { name: 'roles', label: 'Quyền được cấp', type: 'multiple', options: [{ value: 'OPERATIONS_COORDINATOR', label: 'Điều phối' }, { value: 'QUALITY_INSPECTOR', label: 'Kiểm hàng' }, { value: 'ACCOUNTANT', label: 'Kế toán' }, { value: 'CUSTOMER_SUPPORT', label: 'Chăm sóc khách hàng' }, { value: 'DRIVER', label: 'Tài xế' }] },
      ]} /></> }] : []),
    ]} />
    <CoopTrustScoreModal supplierId={selectedTrustSupplierId} supplierName={selectedTrustSupplierName} open={trustModalOpen} onClose={() => setTrustModalOpen(false)} />
  </>
}
