import { Alert, Button, Card, Descriptions, Spin, Tag, Timeline } from 'antd'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import type { Row } from '../components/Workspace'
import { Logo } from '../components/Brand'

export default function TracePage() {
  const { code } = useParams()
  const query = useQuery({
    queryKey: ['trace', code],
    queryFn: () => api<{ type: string; batches?: Row[]; assets?: Row[] }>(`/public/trace/${code}`)
  })

  const rows = query.data?.batches ?? query.data?.assets ?? []

  return (
    <main className="public-form" style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Logo />
        <Button onClick={() => window.print()} icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span>}>
          In chứng thư
        </Button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className="eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified_user</span>
            Hệ Thống Truy Xuất Nông Sản B2B
          </span>
          <Tag color="green">Mã định danh: {code}</Tag>
        </div>
        <h2 style={{ margin: 0, fontSize: '2rem', color: '#173128', fontWeight: 800 }}>
          Hồ Sơ Nguồn Gốc & Chuỗi Lạnh
        </h2>
        <p style={{ color: '#4e655c', margin: '6px 0 0' }}>
          Dữ liệu đối chiếu từ nông trại thu hoạch, FreshLink Gate KCS và lộ trình vận chuyển xe lạnh.
        </p>
      </div>

      <Alert
        type="info"
        showIcon
        message="Chứng thư số minh bạch"
        description="Thông tin lô hàng và tem SmartCrate được đối chiếu tự động với cơ sở dữ liệu phân phối theo thời gian thực."
        style={{ borderRadius: 12, marginBottom: 20 }}
      />

      {query.isPending && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 12, color: '#4e655c' }}>Đang tra cứu cơ sở dữ liệu chuỗi lạnh…</p>
        </div>
      )}

      {query.error && (
        <Alert
          type="error"
          showIcon
          message="Không tìm thấy thông tin"
          description={`Mã tra cứu "${code}" không tồn tại hoặc chưa được đồng bộ trên hệ thống.`}
          style={{ borderRadius: 12 }}
        />
      )}

      {rows.map((row, index) => (
        <Card
          key={index}
          className="action-card"
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#176b45' }}>inventory_2</span>
              <span>Chi tiết định danh #{String(row.batch_code ?? row.asset_code ?? code)}</span>
            </div>
          }
          extra={<Tag color="blue">{String(row.batch_status ?? row.status ?? 'ACTIVE')}</Tag>}
          style={{ borderRadius: 16, border: '1px solid #e3e8e2', boxShadow: '0 4px 16px rgba(23,49,40,0.05)', marginBottom: 20 }}
        >
          <Descriptions
            bordered
            column={{ xs: 1, sm: 2 }}
            items={[
              ['batch_code', 'Mã lô hàng'],
              ['sku_name', 'Mặt hàng nông sản'],
              ['pack_description', 'Quy cách đóng gói'],
              ['organization_name', 'Đơn vị cung ứng / HTX'],
              ['harvest_at', 'Thời điểm thu hoạch'],
              ['packed_at', 'Thời điểm đóng gói'],
              ['received_at', 'Kiểm nhận tại Gate'],
              ['asset_code', 'Mã thùng SmartCrate'],
              ['status', 'Trạng thái vận hành'],
              ['condition_status', 'Tình trạng thùng']
            ]
              .filter(([key]) => row[key] != null)
              .map(([key, label]) => ({
                key,
                label: <strong>{label}</strong>,
                children: String(row[key])
              }))}
          />

          {/* Farm-to-Table Timeline Graphic */}
          <div style={{ marginTop: 24, padding: 18, background: '#f8fbf9', borderRadius: 12, border: '1px solid #e3ebe5' }}>
            <h4 style={{ margin: '0 0 16px', color: '#176b45', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>timeline</span>
              Tiến trình luân chuyển chuỗi cung ứng
            </h4>
            <Timeline
              items={[
                {
                  color: 'green',
                  children: (
                    <div>
                      <strong>1. Nông trại chuẩn VietGAP thu hoạch & phân loại</strong>
                      <p style={{ margin: 0, color: '#66766e', fontSize: 12 }}>Đóng gói tại vùng trồng, dán tem QR sơ cấp</p>
                    </div>
                  )
                },
                {
                  color: 'green',
                  children: (
                    <div>
                      <strong>2. Tiếp nhận & Kiểm định tại FreshLink Gate KCS</strong>
                      <p style={{ margin: 0, color: '#66766e', fontSize: 12 }}>Thẩm định 4 tiêu chí: Quy cách, Bao bì, Nhãn mác, Ngoại quan</p>
                    </div>
                  )
                },
                {
                  color: 'blue',
                  children: (
                    <div>
                      <strong>3. Luân chuyển xe lạnh chuyên dụng (+2°C đến +6°C)</strong>
                      <p style={{ margin: 0, color: '#66766e', fontSize: 12 }}>Xếp thùng SmartCrate, giám sát cảm biến vi khí hậu thời gian thực</p>
                    </div>
                  )
                },
                {
                  color: 'gray',
                  children: (
                    <div>
                      <strong>4. Bàn giao gian bếp nhà hàng F&B</strong>
                      <p style={{ margin: 0, color: '#66766e', fontSize: 12 }}>Ký nhận điện tử đối chiếu số lượng và thu hồi thùng rỗng sạch</p>
                    </div>
                  )
                }
              ]}
            />
          </div>
        </Card>
      ))}

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Link to="/" className="back-link">
          ← Quay lại Trang chủ FreshLink
        </Link>
      </div>
    </main>
  )
}

