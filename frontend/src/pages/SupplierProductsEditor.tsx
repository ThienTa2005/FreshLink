import { useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Tag, Typography } from 'antd'
import { api } from '../api/http'
import { useRows, type Row as WorkspaceRow } from '../components/Workspace'
import { ProductImage } from '../components/ProductImage'
import { ImageUploadInput } from '../components/ImageUploadInput'

export function SupplierProductsEditor({ organizationId }: { organizationId: number }) {
  const productsQuery = useRows(`/supplier/products?supplierId=${organizationId}`)
  const categoriesQuery = useRows('/public/categories')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(undefined)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<WorkspaceRow | null>(null)
  const [form] = Form.useForm()
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imageFileId, setImageFileId] = useState<number | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const categories = (categoriesQuery.data || []).map(c => ({
    value: Number(c.category_id),
    label: String(c.category_name),
  }))

  const products = (productsQuery.data || []).filter(p => {
    const matchCat = !categoryFilter || Number(p.category_id) === categoryFilter
    const matchSearch = !search || String(p.product_name).toLowerCase().includes(search.toLowerCase()) || String(p.product_code).toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  function openCreateModal() {
    setEditingProduct(null)
    setImageUrl('')
    setImageFileId(undefined)
    setError('')
    setSuccess('')
    form.resetFields()
    form.setFieldsValue({
      unit: 'KG',
      packSize: 1,
      packDescription: 'Sọt bảo ôn 15kg',
      minimum: 1,
      step: 1,
      storageTemperatureNote: '+2°C ~ +6°C',
      shelfLifeHours: 72,
    })
    setModalOpen(true)
  }

  function openEditModal(prod: WorkspaceRow) {
    setEditingProduct(prod)
    const curImg = String(prod.image_url || '')
    setImageUrl(curImg)
    setImageFileId(prod.image_file_id ? Number(prod.image_file_id) : undefined)
    setError('')
    setSuccess('')
    form.setFieldsValue({
      categoryId: prod.category_id ? Number(prod.category_id) : undefined,
      productCode: prod.product_code,
      name: prod.product_name,
      description: prod.description || '',
      unit: prod.base_unit || 'KG',
      packSize: prod.pack_size ? Number(prod.pack_size) : 1,
      packDescription: prod.pack_description || '',
      minimum: prod.minimum_order_quantity ? Number(prod.minimum_order_quantity) : 1,
      step: prod.quantity_step ? Number(prod.quantity_step) : 1,
      storageTemperatureNote: prod.storage_temperature_note || '+2°C ~ +6°C',
      shelfLifeHours: prod.shelf_life_hours ? Number(prod.shelf_life_hours) : 72,
    })
    setModalOpen(true)
  }

  async function handleSave(values: Record<string, unknown>) {
    setBusy(true)
    setError('')
    setSuccess('')
    const payload = {
      ...values,
      supplierId: organizationId,
      imageUrl: imageUrl || null,
      imageFileId: imageFileId || null,
    }

    try {
      if (editingProduct?.product_id) {
        await api(`/supplier/products/${editingProduct.product_id}`, 'PUT', payload)
        setSuccess('Đã cập nhật nông sản và hình ảnh thành công!')
      } else {
        await api('/supplier/products', 'POST', payload)
        setSuccess('Đã tạo nông sản mới thành công!')
      }
      await productsQuery.refetch()
      setTimeout(() => {
        setModalOpen(false)
        setSuccess('')
      }, 700)
    } catch (e) {
      setError((e as Error).message || 'Không thể lưu nông sản')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="supplier-products-console" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Tìm tên hoặc mã nông sản..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>search</span>}
            allowClear
          />
          <Select
            placeholder="Tất cả nhóm nông sản"
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories}
            style={{ minWidth: 180 }}
          />
        </Space>

        <Button
          type="primary"
          onClick={openCreateModal}
          style={{ borderRadius: 8, fontWeight: 700, background: '#176b45', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
          Thêm nông sản mới
        </Button>
      </div>

      {productsQuery.error && (
        <Alert type="error" message={productsQuery.error.message} action={<Button onClick={() => void productsQuery.refetch()}>Thử lại</Button>} />
      )}

      {/* Products Grid */}
      {products.length > 0 ? (
        <Row gutter={[16, 16]}>
          {products.map(prod => {
            const hasCustomImage = Boolean(prod.image_url)
            return (
              <Col xs={24} sm={12} lg={8} xl={6} key={String(prod.product_id)}>
                <Card
                  hoverable
                  className="product-catalog-card"
                  style={{ borderRadius: 14, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border)' }}
                  bodyStyle={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    {/* Image & Badges */}
                    <div style={{ position: 'relative', textAlign: 'center', marginBottom: 12 }}>
                      <ProductImage
                        src={String(prod.image_url || '')}
                        alt={String(prod.product_name)}
                        size="100%"
                        style={{ height: 160, borderRadius: 10 }}
                        showBadge={!hasCustomImage}
                      />
                      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}>
                        <Tag color="green" style={{ borderRadius: 4, fontWeight: 700, fontSize: 10.5 }}>
                          {String(prod.category_name || 'Nông sản')}
                        </Tag>
                      </div>
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        {hasCustomImage ? (
                          <Tag color="cyan" style={{ borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: 'middle', marginRight: 2 }}>cloud_done</span>
                            Cloudinary
                          </Tag>
                        ) : (
                          <Tag color="default" style={{ borderRadius: 4, fontSize: 10 }}>
                            Mẫu mặc định
                          </Tag>
                        )}
                      </div>
                    </div>

                    {/* Title & Info */}
                    <Typography.Title level={5} style={{ margin: '0 0 4px 0', fontSize: 15, color: '#005131' }} ellipsis>
                      {String(prod.product_name)}
                    </Typography.Title>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'Inter', marginBottom: 8 }}>
                      Mã: <b>{String(prod.product_code)}</b> · SKU: {String(prod.sku_code || prod.product_code + '-SKU')}
                    </div>

                    {/* Pack & Logistics metadata */}
                    <div style={{ background: '#f6f8f5', padding: '8px 10px', borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                      <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Quy cách: <b>{String(prod.pack_description || prod.pack_size + ' ' + prod.base_unit)}</b>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Tag color="blue" style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: 'middle', marginRight: 2 }}>ac_unit</span>
                          {String(prod.storage_temperature_note || '+2°C ~ +6°C')}
                        </Tag>
                        <Tag color="orange" style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: 'middle', marginRight: 2 }}>schedule</span>
                          Hạn: {String(prod.shelf_life_hours || 72)}h
                        </Tag>
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <Button
                    onClick={() => openEditModal(prod)}
                    style={{ width: '100%', borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                    Sửa thông tin & Đổi ảnh
                  </Button>
                </Card>
              </Col>
            )
          })}
        </Row>
      ) : (
        !productsQuery.isPending && (
          <div style={{ textAlign: 'center', padding: '48px 16px', background: '#fff', borderRadius: 14, border: '1px dashed var(--border)' }}>
            <ProductImage size={80} style={{ margin: '0 auto 12px' }} />
            <Typography.Title level={5} style={{ margin: '0 0 6px 0' }}>Chưa có nông sản nào trong danh mục</Typography.Title>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Hợp tác xã có thể tự đăng ký các sản phẩm thu hoạch tại nông trại và tải ảnh lên Cloudinary để chuỗi nhà hàng đặt mua.
            </p>
            <Button type="primary" onClick={openCreateModal} style={{ background: '#176b45', borderRadius: 8, fontWeight: 700 }}>
              + Thêm nông sản đầu tiên
            </Button>
          </div>
        )
      )}

      {/* Modal Add / Edit Product */}
      <Modal
        open={modalOpen}
        title={
          <Space>
            <span className="material-symbols-outlined" style={{ color: '#176b45', fontSize: 22 }}>
              {editingProduct ? 'edit' : 'add_circle'}
            </span>
            <span>{editingProduct ? 'Cập nhật nông sản & hình ảnh' : 'Khai báo nông sản mới'}</span>
          </Space>
        }
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={680}
        destroyOnClose
      >
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 14 }} />}
        {success && <Alert type="success" message={success} showIcon style={{ marginBottom: 14 }} />}

        <Form form={form} layout="vertical" onFinish={values => void handleSave(values)}>
          {/* Cloudinary Image Upload Section */}
          <Form.Item label={<b style={{ fontSize: 13.5 }}>Hình ảnh nông sản (Đẩy lên Cloudinary)</b>}>
            <ImageUploadInput
              value={imageUrl}
              onChange={setImageUrl}
              onFileIdChange={setImageFileId}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              * Nếu không tải ảnh, hệ thống sẽ tự động hiển thị hình minh họa mẫu nông sản sạch đạt chuẩn VietGAP.
            </div>
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Tên nông sản" rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}>
                <Input placeholder="Ví dụ: Cải bó xôi Mộc Châu, Cà chua beef..." />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="productCode" label="Mã nông sản" rules={[{ required: true, message: 'Vui lòng nhập mã sản phẩm' }]}>
                <Input placeholder="Ví dụ: MC-SPINACH-01, DLT-TOMATO" disabled={!!editingProduct} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="categoryId" label="Nhóm danh mục" rules={[{ required: true, message: 'Vui lòng chọn nhóm sản phẩm' }]}>
                <Select placeholder="Chọn nhóm" options={categories} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true, message: 'Vui lòng chọn đơn vị' }]}>
                <Select
                  options={[
                    { value: 'KG', label: 'kg (Kilogram)' },
                    { value: 'PACK', label: 'Gói / Bịch' },
                    { value: 'BOX', label: 'Hộp' },
                    { value: 'CRATE', label: 'Sọt / Thùng' },
                    { value: 'BUNCH', label: 'Bó' },
                    { value: 'BAG', label: 'Túi' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="packSize" label="Khối lượng quy cách (kg/đơn vị)" rules={[{ required: true, message: 'Nhập quy cách' }]}>
                <InputNumber min={0.001} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="packDescription" label="Mô tả bao bì đóng gói">
                <Input placeholder="Ví dụ: Sọt bảo ôn 15kg, Khay xốp đệm 10kg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="minimum" label="Số lượng đặt tối thiểu">
                <InputNumber min={0.001} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="step" label="Bước tăng số lượng">
                <InputNumber min={0.001} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="storageTemperatureNote" label="Nhiệt độ bảo quản chuỗi lạnh">
                <Input placeholder="Ví dụ: +2°C ~ +6°C" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="shelfLifeHours" label="Hạn sử dụng (giờ)">
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Mô tả nguồn gốc & Chứng nhận chất lượng">
                <Input.TextArea rows={3} placeholder="Nông trường canh tác hữu cơ, chuẩn VietGAP, không sử dụng thuốc trừ sâu..." />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <Button onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={busy} style={{ background: '#176b45', fontWeight: 700 }}>
              {editingProduct ? 'Lưu cập nhật' : 'Tạo sản phẩm & Đẩy ảnh'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
