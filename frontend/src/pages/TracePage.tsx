import { Alert, Card, Descriptions, Spin, Typography } from 'antd'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import type { Row } from '../components/Workspace'
export default function TracePage() {
  const { code } = useParams()
  const query = useQuery({ queryKey: ['trace', code], queryFn: () => api<{ type: string; batches?: Row[]; assets?: Row[] }>(`/public/trace/${code}`) })
  return <main className="public-form"><Link className="brand" to="/">FreshLink</Link><Typography.Title level={2}>Truy xuất nguồn hàng</Typography.Title>
    <Alert type="info" message="Thông tin đã được ghi nhận trong hệ thống. QR không thay thế chứng nhận chất lượng." showIcon />
    {query.isPending && <Spin />}{query.error && <Alert type="error" message={query.error.message} />}
    {(query.data?.batches ?? query.data?.assets ?? []).map((row, index) => <Card key={index} className="action-card"><Descriptions column={1} items={[
      ['batch_code', 'Mã lô'], ['sku_name', 'Sản phẩm'], ['pack_description', 'Quy cách'], ['organization_name', 'Nhà cung cấp'], ['harvest_at', 'Thu hoạch'], ['packed_at', 'Đóng gói'], ['received_at', 'Kiểm nhận'], ['batch_status', 'Trạng thái lô'], ['asset_code', 'Mã thùng'], ['status', 'Trạng thái'], ['condition_status', 'Tình trạng'],
    ].filter(([key]) => row[key] != null).map(([key, label]) => ({ key, label, children: String(row[key]) }))} /></Card>)}
  </main>
}
