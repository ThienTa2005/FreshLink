import { useState } from 'react'
import { Button, Layout, Menu, Result, Select, Space, Typography } from 'antd'
import { Link, Navigate } from 'react-router-dom'
import { portals, useAuth } from '../auth/AuthContext'
import RestaurantPage from './RestaurantPage'
import SupplierPage from './SupplierPage'
import OperationsPage from './OperationsPage'
import TripPage from './TripPage'
const labels: Record<string, string> = { restaurant: 'Nhà hàng', supplier: 'Nhà cung cấp', operations: 'Vận hành FreshLink', driver: 'Tài xế' }
export default function PortalPage() {
  const { user, logout } = useAuth()
  const [selected, setSelected] = useState<string>(); const [org, setOrg] = useState<number>()
  if (!user) return <Navigate to="/login" replace />
  const available = portals(user); const current = selected ?? (available.includes('operations') ? 'operations' : available[0])
  const organizations = user.memberships.filter(m => m.organizationType === (current === 'restaurant' ? 'RESTAURANT' : 'SUPPLIER'))
  const organizationId = organizations.some(m => m.organizationId === org) ? org : organizations[0]?.organizationId
  return <Layout className="portal-layout"><Layout.Header className="portal-header"><Link className="brand" to="/">FreshLink</Link><Space><Typography.Text>{user.fullName}</Typography.Text><Button onClick={() => void logout()}>Đăng xuất</Button></Space></Layout.Header>
    <Menu mode="horizontal" selectedKeys={[current]} items={available.map(key => ({ key, label: labels[key] }))} onClick={({ key }) => { setSelected(key); setOrg(undefined) }} />
    <Layout.Content className="portal-content"><Typography.Title level={2}>{labels[current]}</Typography.Title>
      {['restaurant', 'supplier'].includes(current) && <Select className="organization-select" value={organizationId} placeholder="Chọn đơn vị" options={organizations.map(m => ({ value: m.organizationId, label: m.organizationName }))} onChange={setOrg} />}
      {current === 'operations' ? <OperationsPage /> : current === 'driver' ? <TripPage /> : organizationId ? current === 'restaurant' ? <RestaurantPage key={organizationId} organizationId={organizationId} /> : <SupplierPage key={organizationId} organizationId={organizationId} /> : <Result status="info" title="Tài khoản chưa có đơn vị thuộc cổng này" subTitle="Dùng tài khoản đối tác đã được duyệt để thao tác." />}
    </Layout.Content></Layout>
}
