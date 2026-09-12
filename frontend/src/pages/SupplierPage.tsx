import { Tabs } from 'antd'
import { ActionForm, DataTable, EvidenceLink, QrButton, options, tomorrow, useRows } from '../components/Workspace'

export default function SupplierPage({ organizationId, initialTab = 'passport' }: { organizationId: number; initialTab?: string }) {
  const catalog = useRows(`/public/catalog?date=${tomorrow()}`)
  const requests = useRows(`/supplier/requests?supplierId=${organizationId}`)
  return <Tabs defaultActiveKey={initialTab} items={[
    { key: 'passport', label: 'Supplier Passport', children: <><DataTable path={`/supplier/passport?supplierId=${organizationId}`} rowKey="supplier_document_id" columns={[[ 'document_type', 'Loại hồ sơ' ], ['document_number', 'Số giấy tờ'], ['expiry_date', 'Hết hạn'], ['verification_status', 'Xác minh'], ['original_name', 'Tệp']]} actions={row => row.file_id ? <EvidenceLink id={Number(row.file_id)} /> : null} /><ActionForm title="Hồ sơ nguồn cung" path="/supplier/passport" fields={[
      { name: 'type', label: 'Loại hồ sơ', type: 'select', options: [{ value: 'BUSINESS_LICENSE', label: 'Đăng ký kinh doanh' }, { value: 'FOOD_SAFETY', label: 'An toàn thực phẩm' }, { value: 'VIETGAP', label: 'VietGAP' }, { value: 'ORIGIN_PROOF', label: 'Nguồn gốc' }, { value: 'OTHER', label: 'Khác' }] }, { name: 'number', label: 'Số giấy tờ', required: false }, { name: 'issuedDate', label: 'Ngày cấp', type: 'date', required: false }, { name: 'expiryDate', label: 'Ngày hết hạn', type: 'date', required: false }, { name: 'fileId', label: 'Ảnh / PDF hồ sơ', type: 'file' },
    ]} transform={v => ({ ...v, supplierId: organizationId, issuedDate: v.issuedDate || null, expiryDate: v.expiryDate || null })} /></> },
    { key: 'offers', label: 'Năng lực cung ứng', children: <ActionForm title="Năng lực cung ứng" path="/supplier/offers" fields={[
      { name: 'skuId', label: 'Sản phẩm', type: 'select', options: options(catalog.data, 'sku_id', 'sku_name') }, { name: 'date', label: 'Ngày có hàng', type: 'date', initial: tomorrow() }, { name: 'quantity', label: 'Số lượng có thể đáp ứng', type: 'number', min: 0.001 }, { name: 'price', label: 'Đơn giá cung cấp (đ)', type: 'number' },
    ]} transform={v => ({ ...v, supplierId: organizationId })} /> },
    { key: 'requests', label: 'Yêu cầu cung ứng', children: <><DataTable path={`/supplier/requests?supplierId=${organizationId}`} rowKey="supply_request_item_id" columns={[[ 'supply_request_item_id', 'ID dòng yêu cầu' ], ['request_code', 'Mã yêu cầu'], ['sku_name', 'Sản phẩm'], ['required_date', 'Ngày giao'], ['requested_quantity', 'Yêu cầu'], ['accepted_quantity', 'Đã nhận'], ['status', 'Trạng thái']]} />
      <ActionForm title="Phản hồi cung ứng" path={v => `/supplier/requests/${v.id}/respond`} fields={[
        { name: 'id', label: 'Dòng yêu cầu', type: 'select', options: options(requests.data?.filter(r => r.status === 'PENDING'), 'supply_request_item_id', 'sku_name') }, { name: 'quantity', label: 'Lượng nhận cung ứng (0 để từ chối)', type: 'number' },
      ]} transform={v => ({ quantity: v.quantity })} /></> },
    { key: 'batches', label: 'Lô và QR', children: <><ActionForm title="Lô hàng" path="/batches" fields={[
      { name: 'requestItemId', label: 'Yêu cầu đã xác nhận', type: 'select', options: options(requests.data?.filter(r => ['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(String(r.status))), 'supply_request_item_id', 'sku_name') }, { name: 'quantity', label: 'Số lượng khai báo', type: 'number', min: 0.001 }, { name: 'origin', label: 'Nguồn gốc và ghi chú thu hoạch / đóng gói', type: 'textarea' },
    ]} /><DataTable path={`/batches?supplierId=${organizationId}`} rowKey="batch_id" columns={[[ 'batch_code', 'Mã lô' ], ['sku_name', 'Sản phẩm'], ['declared_quantity', 'Khai báo'], ['accepted_quantity', 'Đạt'], ['review_quantity', 'Giữ lại'], ['rejected_quantity', 'Từ chối'], ['batch_status', 'Trạng thái']]} actions={r => <QrButton type="BATCH" id={r.batch_id} />} /></> },
    { key: 'billing', label: 'Đối soát', children: <><DataTable path={`/billing/suppliers?supplierId=${organizationId}`} rowKey="batch_id" columns={[[ 'batch_code', 'Lô' ], ['accepted_quantity', 'Lượng đạt'], ['supplier_unit_price', 'Đơn giá'], ['commission_rate', 'Hoa hồng (%)'], ['payable', 'Giá trị đối soát (đ)']]} /><DataTable path={`/billing/settlements?supplierId=${organizationId}`} rowKey="settlement_id" columns={[[ 'settlement_code', 'Phiếu đối soát' ], ['payable_amount', 'Phải trả'], ['status', 'Trạng thái'], ['paid_at', 'Thời gian chi trả'], ['external_reference', 'Chứng từ']]} /></> },
  ]} />
}
