import { useState } from 'react'
import { Alert, Button, Card, Space, Tabs, Tag, Input, Table } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { can } from '../components/permissions'
import { useUrlTab } from '../components/useUrlTab'
import { ActionForm, DataTable, EvidenceLink, tomorrow, useRows, type Row } from '../components/Workspace'
import { OffersEditor } from './OffersEditor'
import { SupplierProductsEditor } from './SupplierProductsEditor'
import { FreshLinkMap } from '../components/FreshLinkMap'

interface DiaryEvent {
  date: string
  stage: string
  activity: string
  materials: string
  phiDays?: number
}

export default function SupplierPage({ organizationId, initialTab = 'products' }: { organizationId: number; initialTab?: string }) {
  const { membership } = useAuth()
  const manager = can(membership, 'SUPPLIER_MANAGER')
  const [tab, setTab] = useUrlTab(initialTab)
  const [selected, setSelected] = useState<Row>()
  const navigate = useNavigate()

  const catalog = useRows('/public/catalog?date=' + tomorrow())
  const requests = useRows('/supplier/requests?supplierId=' + organizationId)

  // Query VietGAP status for this supplier
  const vietgapQuery = useQuery({
    queryKey: ['vietgap-status', organizationId],
    queryFn: () => api<{ hasApprovedVietgap: boolean; document?: Row }>(`/supplier/passport/vietgap-status?supplierId=${organizationId}`)
  })
  const hasVietgap = vietgapQuery.data?.hasApprovedVietgap ?? false
  const vietgapDoc = vietgapQuery.data?.document

  // State for interactive digital cultivation diary builder
  const [diaryEvents, setDiaryEvents] = useState<DiaryEvent[]>([])
  const [newDate, setNewDate] = useState('')
  const [newStage, setNewStage] = useState('Bón phân')
  const [newActivity, setNewActivity] = useState('')
  const [newMaterials, setNewMaterials] = useState('')
  const [newPhi, setNewPhi] = useState<number | undefined>(undefined)

  const loadStandardDiary = () => {
    setDiaryEvents([
      { date: '2026-08-10', stage: 'Làm đất & Khử trùng', activity: 'Cày ải phơi đất 7 ngày, bón vôi nông nghiệp khử trùng', materials: 'Vôi bột 50kg/sào' },
      { date: '2026-08-15', stage: 'Xuống giống F1', activity: 'Gieo hạt giống F1 có chứng nhận xuất xứ, tưới ẩm định kỳ', materials: 'Hạt giống F1 tuyển chọn' },
      { date: '2026-08-25', stage: 'Bón phân hữu cơ vi sinh', activity: 'Bón thúc đợt 1 bằng phân trùn quế hoai mục, làm cỏ xới xáo', materials: 'Phân trùn quế Sông Gianh 80kg/sào' },
      { date: '2026-09-02', stage: 'Phòng trừ BVTV sinh học', activity: 'Phun phòng trừ bọ nhảy bằng chế phẩm sinh học tỏi ớt gừng tự nhiên', materials: 'Dung dịch tỏi ớt thảo mộc', phiDays: 7 },
      { date: '2026-09-12', stage: 'Thu hoạch & Đóng sọt', activity: 'Thu hoạch thủ công sáng sớm, cách ly 10 ngày đảm bảo an toàn PHI', materials: 'Sọt nhựa thực phẩm SmartCrate' }
    ])
  }

  const addDiaryEvent = () => {
    if (!newDate || !newActivity) return
    setDiaryEvents(prev => [...prev, {
      date: newDate,
      stage: newStage,
      activity: newActivity,
      materials: newMaterials,
      phiDays: newPhi
    }])
    setNewActivity('')
    setNewMaterials('')
    setNewPhi(undefined)
  }

  return (
    <Tabs
      activeKey={tab === 'billing' && !manager ? 'products' : tab}
      onChange={setTab}
      items={[
        {
          key: 'products',
          label: 'Sản phẩm HTX',
          children: <SupplierProductsEditor organizationId={organizationId} />
        },
        {
          key: 'requests',
          label: 'Yêu cầu cung ứng',
          children: (
            <>
              <DataTable
                path={'/supplier/requests?supplierId=' + organizationId}
                rowKey="supply_request_item_id"
                columns={[
                  ['request_code', 'Mã yêu cầu'],
                  ['sku_name', 'Sản phẩm'],
                  ['requested_quantity', 'Yêu cầu'],
                  ['accepted_quantity', 'Đã nhận'],
                  ['required_date', 'Ngày'],
                  ['required_arrival_time', 'Giờ đến Gate'],
                  ['address_name', 'Điểm Gate'],
                  ['supplier_unit_price', 'Đơn giá'],
                  ['status', 'Trạng thái']
                ]}
                actions={r => (
                  <Button onClick={() => {
                    setSelected(r)
                    setDiaryEvents([])
                  }}>
                    {r.status === 'PENDING' ? 'Phản hồi' : 'Chuẩn bị lô'}
                  </Button>
                )}
              />

              {selected && (
                <Card
                  style={{ marginTop: 20, borderRadius: 14, border: '1.5px solid #a7f3d0' }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ color: '#059669' }}>inventory_2</span>
                        <span>{String(selected.request_code)} · {String(selected.sku_name)}</span>
                      </div>
                      {hasVietgap ? (
                        <Tag color="success">✓ ĐỦ ĐIỀU KIỆN TẠO QR VIETGAP</Tag>
                      ) : (
                        <Tag color="warning">CHƯA DUYỆT VIETGAP (LÔ THƯỜNG)</Tag>
                      )}
                    </div>
                  }
                >
                  {selected.status === 'PENDING' ? (
                    <ActionForm
                      key={String(selected.supply_request_item_id)}
                      title="Phản hồi cung ứng"
                      path={'/supplier/requests/' + selected.supply_request_item_id + '/respond'}
                      fields={[
                        {
                          name: 'quantity',
                          label: 'Lượng nhận (0 = từ chối)',
                          type: 'number',
                          max: Number(selected.requested_quantity),
                          initial: selected.requested_quantity
                        }
                      ]}
                      onDone={() => {
                        setSelected(undefined)
                        void requests.refetch()
                      }}
                    />
                  ) : ['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(String(selected.status)) ? (
                    <>
                      <Alert
                        type="info"
                        showIcon
                        message={`Còn được khai báo: ${String(selected.remaining_quantity)} kg`}
                        style={{ marginBottom: 16, borderRadius: 8 }}
                      />

                      {/* Cultivation Diary Builder Section (when VietGAP verified) */}
                      {hasVietgap && (
                        <div style={{ marginBottom: 20, padding: 16, background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <strong style={{ color: '#065f46', fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu_book</span>
                              Nhật Ký Canh Tác Điện Tử VietGAP (Bắt buộc cho Mã QR Động)
                            </strong>
                            <Button
                              size="small"
                              type="dashed"
                              onClick={loadStandardDiary}
                              style={{ borderColor: '#059669', color: '#065f46', fontWeight: 600 }}
                            >
                              ✨ Nạp 5 mốc VietGAP chuẩn mẫu
                            </Button>
                          </div>

                          {diaryEvents.length > 0 && (
                            <Table
                              size="small"
                              pagination={false}
                              dataSource={diaryEvents.map((item, i) => ({ ...item, key: i }))}
                              columns={[
                                { title: 'Ngày', dataIndex: 'date', width: 110 },
                                { title: 'Giai đoạn', dataIndex: 'stage', width: 140, render: s => <Tag color="green">{s}</Tag> },
                                { title: 'Công việc cụ thể', dataIndex: 'activity' },
                                { title: 'Vật tư / Chế phẩm', dataIndex: 'materials' },
                                { title: 'Cách ly PHI (ngày)', dataIndex: 'phiDays', width: 130, render: p => p ? <Tag color="volcano">{p} ngày</Tag> : '—' },
                                {
                                  title: '',
                                  width: 60,
                                  render: (_, __, i) => (
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      onClick={() => setDiaryEvents(prev => prev.filter((_, idx) => idx !== i))}
                                    >
                                      Xóa
                                    </Button>
                                  )
                                }
                              ]}
                              style={{ marginBottom: 12 }}
                            />
                          )}

                          <Space wrap style={{ marginTop: 8 }}>
                            <Input
                              type="date"
                              placeholder="Ngày"
                              value={newDate}
                              onChange={e => setNewDate(e.target.value)}
                              style={{ width: 130 }}
                            />
                            <select
                              value={newStage}
                              onChange={e => setNewStage(e.target.value)}
                              style={{ height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid #d9d9d9' }}
                            >
                              <option value="Làm đất">Làm đất & Khử vôi</option>
                              <option value="Xuống giống">Xuống giống</option>
                              <option value="Bón phân">Bón phân hữu cơ</option>
                              <option value="Phun BVTV">Phun BVTV sinh học</option>
                              <option value="Tưới tiêu">Tưới tiêu nước sạch</option>
                              <option value="Thu hoạch">Thu hoạch sớm</option>
                            </select>
                            <Input
                              placeholder="Mô tả công việc canh tác..."
                              value={newActivity}
                              onChange={e => setNewActivity(e.target.value)}
                              style={{ width: 220 }}
                            />
                            <Input
                              placeholder="Vật tư / phân bón..."
                              value={newMaterials}
                              onChange={e => setNewMaterials(e.target.value)}
                              style={{ width: 160 }}
                            />
                            <Input
                              type="number"
                              placeholder="Số ngày cách ly"
                              value={newPhi ?? ''}
                              onChange={e => setNewPhi(e.target.value ? Number(e.target.value) : undefined)}
                              style={{ width: 120 }}
                            />
                            <Button onClick={addDiaryEvent} type="primary" style={{ background: '#176b45' }}>
                              + Thêm dòng
                            </Button>
                          </Space>
                        </div>
                      )}

                      <ActionForm
                        key={String(selected.supply_request_item_id)}
                        title={hasVietgap ? "Tạo Lô Hàng & Sinh Mã QR VietGAP" : "Tạo Lô Hàng Thường"}
                        path="/batches"
                        fields={[
                          {
                            name: 'quantity',
                            label: 'Số lượng khai báo (kg)',
                            type: 'number',
                            min: 0.001,
                            max: Number(selected.remaining_quantity),
                            initial: selected.remaining_quantity
                          },
                          ...(hasVietgap ? [
                            {
                              name: 'varietyName',
                              label: 'Tên giống cây trồng cụ thể (VD: Cải thìa F1 giống Nhật, Xà lách thủy canh...)',
                              required: true
                            },
                            {
                              name: 'plantingDate',
                              label: 'Ngày gieo trồng / xuống giống',
                              type: 'date' as const,
                              required: false
                            },
                            {
                              name: 'packagingFacility',
                              label: 'Cơ sở sơ chế & đóng gói',
                              initial: 'Xưởng sơ chế nông sản HTX đạt chuẩn HACCP',
                              required: false
                            }
                          ] : []),
                          {
                            name: 'origin',
                            label: 'Nguồn gốc / thổ nhưỡng / vùng trồng',
                            type: 'textarea',
                            initial: 'Nông trường công nghệ cao đạt chuẩn VietGAP'
                          }
                        ]}
                        transform={v => ({
                          ...v,
                          requestItemId: selected.supply_request_item_id,
                          varietyName: v.varietyName || null,
                          plantingDate: v.plantingDate || null,
                          packagingFacility: v.packagingFacility || null,
                          cultivationDiary: diaryEvents.length > 0 ? JSON.stringify(diaryEvents) : null
                        })}
                        onDone={id => navigate('/portal/batches/' + id)}
                      />
                    </>
                  ) : (
                    <Alert type="info" message="Yêu cầu này không còn ở trạng thái chuẩn bị lô" />
                  )}
                </Card>
              )}
            </>
          )
        },
        {
          key: 'offers',
          label: 'Năng lực cung ứng',
          children: <OffersEditor organizationId={organizationId} catalog={catalog.data ?? []} />
        },
        {
          key: 'batches',
          label: 'Lô & QR VietGAP',
          children: (
            <>
              {/* VietGAP Status Banner */}
              {hasVietgap ? (
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '1.5px solid #86efac',
                  borderRadius: 14,
                  padding: '16px 20px',
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#059669' }}>verified</span>
                    <div>
                      <strong style={{ color: '#065f46', fontSize: 16 }}>
                        Đã Xác Thực VietGAP Quốc Gia: {String(vietgapDoc?.document_number ?? 'VietGAP-TT-12-04-26')}
                      </strong>
                      <p style={{ margin: '2px 0 0', color: '#047857', fontSize: 13.5 }}>
                        Tổ chức chứng nhận: {String(vietgapDoc?.certifying_body ?? 'TQC CGLOBAL')} • Hạn dùng: {String(vietgapDoc?.expiry_date ?? 'Còn hiệu lực')}
                      </p>
                    </div>
                  </div>
                  <Tag color="success" style={{ fontWeight: 700, padding: '4px 12px', fontSize: 12 }}>
                    ✓ ĐỦ ĐIỀU KIỆN TẠO MÃ QR ĐỘNG
                  </Tag>
                </div>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="Chưa Mở Khóa Chức Năng Cấp Mã QR Truy Xuất Nguồn Gốc VietGAP"
                  description={
                    <div>
                      <p style={{ margin: '4px 0 10px' }}>
                        Để đảm bảo uy tín và tính pháp lý minh bạch cho toàn sàn, chỉ những Hợp tác xã đã tải lên <strong>Giấy chứng nhận VietGAP</strong> và được <strong>Admin FreshLink phê duyệt</strong> mới được cấp quyền sinh Mã QR Động chuẩn quốc gia.
                      </p>
                      <Button
                        type="primary"
                        onClick={() => setTab('passport')}
                        style={{ background: '#176b45', fontWeight: 600 }}
                      >
                        Tải lên Giấy chứng nhận VietGAP ngay
                      </Button>
                    </div>
                  }
                  style={{ borderRadius: 14, marginBottom: 18 }}
                />
              )}

              <DataTable
                path={'/batches?supplierId=' + organizationId}
                rowKey="batch_id"
                columns={[
                  ['batch_code', 'Mã lô hàng'],
                  ['sku_name', 'Sản phẩm'],
                  ['declared_quantity', 'Khai báo (kg)'],
                  ['accepted_quantity', 'Đạt KCS (kg)'],
                  ['review_quantity', 'Giữ lại (kg)'],
                  ['rejected_quantity', 'Từ chối (kg)'],
                  ['batch_status', 'Trạng thái']
                ]}
                actions={r => (
                  <Space>
                    <Link to={'/portal/batches/' + r.batch_id}>Mở lô / In QR</Link>
                    <Link to={'/trace/' + r.batch_code} target="_blank" style={{ color: '#059669', fontWeight: 600 }}>
                      Xem QR Động
                    </Link>
                  </Space>
                )}
              />
            </>
          )
        },
        {
          key: 'passport',
          label: 'Hồ sơ nhà cung cấp',
          children: (
            <>
              <DataTable
                path={'/supplier/passport?supplierId=' + organizationId}
                rowKey="supplier_document_id"
                columns={[
                  ['document_type', 'Loại hồ sơ'],
                  ['document_number', 'Số hiệu'],
                  ['certifying_body', 'Tổ chức cấp'],
                  ['certification_scope', 'Phạm vi chứng nhận'],
                  ['expiry_date', 'Hết hạn'],
                  ['verification_status', 'Xác minh Admin'],
                  ['rejection_reason', 'Phản hồi']
                ]}
                actions={r => <Space>{r.file_id != null && <EvidenceLink id={Number(r.file_id)} />}</Space>}
              />

              <ActionForm
                title="Tải lên hồ sơ chứng nhận & Minh chứng VietGAP"
                path="/supplier/passport"
                fields={[
                  {
                    name: 'type',
                    label: 'Loại hồ sơ',
                    type: 'select',
                    options: [
                      { value: 'VIETGAP', label: '🛡️ Giấy chứng nhận VietGAP (Mở khóa tạo mã QR)' },
                      { value: 'FOOD_SAFETY', label: 'Chứng nhận Cơ sở đủ điều kiện An toàn thực phẩm' },
                      { value: 'BUSINESS_LICENSE', label: 'Giấy phép đăng ký HTX / Doanh nghiệp' },
                      { value: 'ORIGIN_PROOF', label: 'Giấy xác nhận vùng trồng / Mã số vùng trồng' },
                      { value: 'OTHER', label: 'Hồ sơ khác' }
                    ]
                  },
                  { name: 'number', label: 'Số hiệu chứng nhận (VD: VietGAP-TT-12-04-26-0001)' },
                  { name: 'certifyingBody', label: 'Tổ chức chứng nhận (VD: TQC CGLOBAL, QUACERT, NHO...)' },
                  { name: 'scope', label: 'Phạm vi chứng nhận (VD: Rau ăn lá, củ, quả các loại...)' },
                  { name: 'issuedDate', label: 'Ngày cấp', type: 'date', required: false },
                  { name: 'expiryDate', label: 'Ngày hết hạn', type: 'date', required: false },
                  { name: 'fileId', label: 'Tệp hình ảnh chụp / Scan PDF chứng chỉ gốc', type: 'file' }
                ]}
                transform={v => ({
                  ...v,
                  supplierId: organizationId,
                  certifyingBody: v.certifyingBody || null,
                  scope: v.scope || null,
                  issuedDate: v.issuedDate || null,
                  expiryDate: v.expiryDate || null
                })}
              />
              <div style={{ marginTop: 12 }}>
                <a href={'/trace/supplier-' + organizationId} target="_blank" rel="noreferrer">
                  Tra cứu hồ sơ công khai của đơn vị
                </a>
              </div>
            </>
          )
        },
        {
          key: 'hubs',
          label: 'Bản đồ Gate & Hub',
          children: (
            <FreshLinkMap
              title="Hệ thống Cổng Kiểm Nhận Gate & Hub Chuỗi Lạnh"
              subtitle="Vị trí các điểm tiếp nhận nông sản đạt chuẩn VietGAP của FreshLink trên toàn quốc"
              hubs={[
                { hubId: 1, code: 'GATE-HN-01', name: 'Gate KCS #01 - Hub Bắc Thăng Long (Đông Anh)', type: 'CENTRAL_CROSS_DOCK', address: 'KCN Bắc Thăng Long, Huyện Đông Anh, Hà Nội', district: 'Đông Anh', city: 'Hà Nội', latitude: 21.1458, longitude: 105.8452, temperatureC: 3.4, humidityPercent: 88, capacityCrates: 3500, activeTrucks: 18, phone: '0123456789' },
                { hubId: 2, code: 'GATE-HN-02', name: 'Gate KCS #02 - Hub Hoàng Mai (Ngọc Hồi)', type: 'URBAN_CROSS_DOCK', address: 'Km 12 Đường Ngọc Hồi, Quận Hoàng Mai, Hà Nội', district: 'Hoàng Mai', city: 'Hà Nội', latitude: 20.9572, longitude: 105.8488, temperatureC: 3.8, humidityPercent: 86, capacityCrates: 2200, activeTrucks: 12, phone: '0123456789' },
                { hubId: 3, code: 'HUB-MC-01', name: 'Hub Thu Gom Nông Sản Mộc Châu (Sơn La)', type: 'REGIONAL_COLLECTION_HUB', address: 'Tiểu khu Vườn Đào, TT. Nông Trường Mộc Châu, Sơn La', district: 'Mộc Châu', city: 'Sơn La', latitude: 20.8436, longitude: 104.6642, temperatureC: 4.1, humidityPercent: 91, capacityCrates: 2800, activeTrucks: 8, phone: '0123456789' },
                { hubId: 4, code: 'HUB-DL-01', name: 'Hub Công Nghệ Cao Đà Lạt (Lâm Đồng)', type: 'REGIONAL_COLLECTION_HUB', address: 'Đường Vạn Thành, Phường 5, TP. Đà Lạt, Lâm Đồng', district: 'Đà Lạt', city: 'Lâm Đồng', latitude: 11.9404, longitude: 108.4182, temperatureC: 3.8, humidityPercent: 89, capacityCrates: 4000, activeTrucks: 15, phone: '0123456789' },
                { hubId: 5, code: 'GATE-HCM-01', name: 'Gate KCS #03 - Hub Tây Bắc TP.HCM (Củ Chi)', type: 'CENTRAL_CROSS_DOCK', address: 'KCN Tân Phú Trung, Quốc lộ 22, Củ Chi, TP. Hồ Chí Minh', district: 'Củ Chi', city: 'TP. Hồ Chí Minh', latitude: 10.9632, longitude: 106.5298, temperatureC: 3.6, humidityPercent: 87, capacityCrates: 4200, activeTrucks: 22, phone: '0123456789' }
              ]}
              height="480px"
              zoom={6}
              center={[16.0, 107.5]}
            />
          )
        },
        ...(manager ? [
          {
            key: 'farms',
            label: 'Vùng trồng & Địa chỉ',
            children: (
              <>
                <DataTable
                  path={'/addresses?organizationId=' + organizationId}
                  rowKey="address_id"
                  columns={[
                    ['address_name', 'Tên vùng trồng'],
                    ['address_line', 'Địa chỉ cụ thể'],
                    ['district', 'Huyện/TX'],
                    ['city', 'Tỉnh/TP']
                  ]}
                />
                <ActionForm
                  title="Thêm vùng trồng / Nông trại HTX cụ thể"
                  path="/addresses"
                  fields={[
                    { name: 'name', label: 'Tên vùng trồng / Nông trại (VD: Nông trường Mộc Châu #1)' },
                    { name: 'address', label: 'Số nhà / Thôn / Bản / Tiểu khu' },
                    { name: 'ward', label: 'Xã / Thị trấn' },
                    { name: 'district', label: 'Huyện / Thị xã' },
                    { name: 'city', label: 'Tỉnh / Thành phố' },
                    { name: 'contactName', label: 'Chủ nhiệm / Quản lý nông trại' },
                    { name: 'phone', label: 'Số điện thoại liên hệ' }
                  ]}
                  transform={v => ({ ...v, organizationId, type: 'FARM' })}
                />
              </>
            )
          },
          {
            key: 'billing',
            label: 'Đối soát',
            children: (
              <>
                <DataTable
                  path={'/billing/suppliers?supplierId=' + organizationId}
                  rowKey="batch_id"
                  columns={[
                    ['batch_code', 'Lô'],
                    ['accepted_quantity', 'Lượng đạt'],
                    ['supplier_unit_price', 'Đơn giá'],
                    ['payable', 'Giá trị đối soát']
                  ]}
                />
                <DataTable
                  path={'/billing/settlements?supplierId=' + organizationId}
                  rowKey="settlement_id"
                  columns={[
                    ['settlement_code', 'Phiếu đối soát'],
                    ['payable_amount', 'Phải trả'],
                    ['status', 'Trạng thái'],
                    ['paid_at', 'Ngày trả']
                  ]}
                  actions={r => <Link to={'/portal/settlements/' + r.settlement_id}>Chi tiết</Link>}
                />
              </>
            )
          }
        ] : [])
      ]}
    />
  )
}
