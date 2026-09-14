import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Badge, Button, Card, Drawer, Layout, Result, Select, Space } from 'antd'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import { subscribeOfflineQueue, flushOfflineQueue } from '../api/offlineQueue'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/Brand'
import GlobalSearch from '../components/GlobalSearch'
import { can, roleNames } from '../components/permissions'
import { DataTable } from '../components/Workspace'
import RestaurantPage from './RestaurantPage'
import SupplierPage from './SupplierPage'
import OperationsPage from './OperationsPage'
import TripPage from './TripPage'
import { AnalyticsPage, InvoicesPage, MembersPage, NotificationsPage } from './ManagementPages'
import { DashboardPage, DetailPage, AccountPage, AdminPage } from './WorkspacePages'
import { WebQrScannerModal } from '../components/WebQrScannerModal'

export default function PortalPage() {
  const { user, membership, selectWorkspace, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobile, setMobile] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pendingOffline, setPendingOffline] = useState(0)
  const [qrModalOpen, setQrModalOpen] = useState(false)

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api<{ unread_count: number }>('/notifications/unread-count'),
    refetchInterval: 30000
  })

  const m = membership
  const has = (...r: string[]) => can(m, ...r)

  useEffect(() => {
    return subscribeOfflineQueue(count => setPendingOffline(count))
  }, [])

  useEffect(() => {
    const saved = () => setDirty(false)
    window.addEventListener('freshlink:saved', saved)
    return () => window.removeEventListener('freshlink:saved', saved)
  }, [])

  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  if (!user) return <Navigate to="/login" replace />
  if (!m) {
    return (
      <Result
        title="Chưa được cấp đơn vị"
        subTitle="Tài khoản chưa có membership hợp lệ. Vui lòng liên hệ quản trị viên."
        extra={<Button onClick={() => void logout()}>Đăng xuất</Button>}
      />
    )
  }

  const internal = m.organizationType === 'FRESHLINK'
  const supplier = m.organizationType === 'SUPPLIER'

  // Navigation items grouped according to Stitch Enterprise Information Architecture
  const navGroups = [
    {
      group: 'Điều hành',
      items: [
        { key: 'dashboard', label: 'Việc hôm nay', icon: 'dashboard', allow: true },
        {
          key: 'products',
          label: 'Sản phẩm HTX',
          icon: 'spa',
          allow: supplier && has('SUPPLIER_MANAGER', 'SUPPLIER_STAFF')
        },
        {
          key: 'orders',
          label: 'Đơn hàng B2B',
          icon: 'inventory_2',
          allow: !supplier && has('RESTAURANT_MANAGER', 'RESTAURANT_PURCHASER', 'RESTAURANT_RECEIVER', 'OPERATIONS_COORDINATOR', 'ACCOUNTANT', 'CUSTOMER_SUPPORT')
        },
        {
          key: 'supply-requests',
          label: supplier ? 'Yêu cầu cung ứng' : 'Phân nguồn',
          icon: 'local_florist',
          allow: has('SUPPLIER_MANAGER', 'SUPPLIER_STAFF', 'OPERATIONS_COORDINATOR')
        }
      ]
    },
    {
      group: 'Chất lượng & Vận hành',
      items: [
        {
          key: 'batches',
          label: 'Lô & Kiểm nhận KCS',
          icon: 'verified',
          allow: has('SUPPLIER_MANAGER', 'SUPPLIER_STAFF', 'QUALITY_INSPECTOR', 'OPERATIONS_COORDINATOR')
        },
        {
          key: 'trips',
          label: 'Chuyến giao & Lộ trình',
          icon: 'local_shipping',
          allow: has('DRIVER', 'OPERATIONS_COORDINATOR')
        },
        {
          key: 'claims',
          label: 'Khiếu nại & Bù trừ',
          icon: 'assignment_late',
          allow: has('RESTAURANT_MANAGER', 'RESTAURANT_RECEIVER', 'CUSTOMER_SUPPORT')
        },
        {
          key: 'assets',
          label: 'Thùng SmartCrate',
          icon: 'all_inbox',
          allow: has('RESTAURANT_MANAGER', 'RESTAURANT_RECEIVER', 'DRIVER', 'OPERATIONS_COORDINATOR')
        },
        {
          key: 'vietgap_docs',
          label: 'Kiểm định VietGAP HTX',
          icon: 'verified_user',
          allow: internal && has('SYSTEM_ADMIN', 'OPERATIONS_COORDINATOR')
        },
        {
          key: 'coop_rankings',
          label: 'Xếp hạng Tín nhiệm HTX',
          icon: 'military_tech',
          allow: internal && has('SYSTEM_ADMIN', 'OPERATIONS_COORDINATOR')
        },
        {
          key: 'passport',
          label: 'Hồ sơ & Chứng nhận VietGAP',
          icon: 'badge',
          allow: supplier && has('SUPPLIER_MANAGER')
        },
        {
          key: 'trust',
          label: '⭐ Điểm Tín Nhiệm HTX',
          icon: 'grade',
          allow: supplier && has('SUPPLIER_MANAGER', 'SUPPLIER_STAFF')
        }
      ]
    },
    {
      group: 'Tài chính & Hệ thống',
      items: [
        {
          key: 'greenCert',
          label: '🌿 Chứng nhận Xanh & ESG',
          icon: 'eco',
          allow: !internal && (supplier || has('RESTAURANT_MANAGER', 'RESTAURANT_PURCHASER'))
        },
        {
          key: supplier ? 'settlements' : 'invoices',
          label: supplier ? 'Đối soát NCC' : 'Tài chính & Hóa đơn',
          icon: 'receipt_long',
          allow: has('SUPPLIER_MANAGER', 'RESTAURANT_MANAGER', 'ACCOUNTANT')
        },
        {
          key: 'analytics',
          label: 'Phân tích & Báo cáo',
          icon: 'query_stats',
          allow: internal && has('OPERATIONS_COORDINATOR', 'QUALITY_INSPECTOR', 'CUSTOMER_SUPPORT', 'ACCOUNTANT')
        },
        {
          key: 'members',
          label: 'Thành viên & Quyền',
          icon: 'group',
          allow: !internal && has('RESTAURANT_MANAGER', 'SUPPLIER_MANAGER')
        },
        {
          key: 'admin',
          label: 'Quản trị hệ thống',
          icon: 'admin_panel_settings',
          allow: has('SYSTEM_ADMIN')
        },
        {
          key: 'account',
          label: 'Tài khoản của tôi',
          icon: 'manage_accounts',
          allow: true
        }
      ]
    }
  ]

  const segment = location.pathname.replace(/^\/portal\/?/, '') || 'dashboard'
  const [rawRoot, id] = segment.split('/')
  const root = rawRoot === 'quality' ? 'batches' : rawRoot

  const allNavItems = navGroups.flatMap(g => g.items)
  const permitted = root === 'notifications' || allNavItems.some(n => n.key === root && n.allow)

  let content: ReactNode
  if (!permitted) {
    content = <Result status="403" title="Màn hình không thuộc quyền hiện tại" extra={<Link to="/portal/dashboard">Về việc hôm nay</Link>} />
  } else if (root === 'dashboard') {
    content = <DashboardPage />
  } else if (root === 'notifications') {
    content = <NotificationsPage />
  } else if (root === 'account') {
    content = <AccountPage />
  } else if (root === 'admin') {
    content = <AdminPage />
  } else if (root === 'members') {
    content = <MembersPage organizationId={m.organizationId} />
  } else if (root === 'analytics') {
    content = <AnalyticsPage />
  } else if (id && /^\d+$/.test(id) && ['orders', 'batches', 'trips', 'claims', 'settlements'].includes(root)) {
    content = <DetailPage type={root} id={Number(id)} />
  } else if (root === 'invoices') {
    content = <InvoicesPage restaurantId={internal ? undefined : m.organizationId} accountant={has('ACCOUNTANT')} />
  } else if (root === 'vietgap_docs') {
    content = <OperationsPage initialTab="vietgap_docs" />
  } else if (root === 'coop_rankings') {
    content = <OperationsPage initialTab="coop_rankings" />
  } else if (root === 'greenCert') {
    content = supplier ? (
      <SupplierPage organizationId={m.organizationId} initialTab="greenCert" />
    ) : (
      <RestaurantPage organizationId={m.organizationId} initialTab="greenCert" />
    )
  } else if (supplier) {
    content = (
      <SupplierPage
        organizationId={m.organizationId}
        initialTab={
          root === 'batches' ? 'batches' :
          root === 'settlements' ? 'billing' :
          root === 'products' ? 'products' :
          root === 'supply-requests' ? 'requests' :
          root === 'passport' ? 'passport' :
          root === 'trust' ? 'trust' :
          'products'
        }
      />
    )
  } else if (!internal) {
    content = <RestaurantPage organizationId={m.organizationId} initialTab={root === 'orders' ? (id === 'new' ? 'order' : 'orders') : root} />
  } else if (root === 'trips') {
    content = has('OPERATIONS_COORDINATOR') ? (
      <OperationsPage initialTab="trips" />
    ) : (
      <TripPage canOptimize={false} />
    )
  } else if (root === 'assets' && has('DRIVER') && !has('OPERATIONS_COORDINATOR')) {
    content = (
      <Card title="Thùng luân chuyển SmartCrate">
        <p>Thao tác giao hoặc thu thùng được thực hiện theo từng điểm giao trong màn hình Chuyến giao.</p>
        <DataTable path="/assets" rowKey="asset_id" columns={[['asset_id', 'ID'], ['asset_code', 'Mã thùng'], ['status', 'Trạng thái'], ['condition_status', 'Tình trạng']]} />
      </Card>
    )
  } else {
    content = <OperationsPage initialTab={({ orders: 'overview', 'supply-requests': 'source', batches: 'gate', claims: 'claims', assets: 'assets', trips: 'trips', vietgap_docs: 'vietgap_docs', coop_rankings: 'coop_rankings' } as Record<string, string>)[root] ?? 'overview'} />
  }

  function go(path: string) {
    if (dirty && !window.confirm('Bạn có nội dung chưa lưu. Rời màn hình?')) return
    setDirty(false)
    navigate(path)
    setMobile(false)
  }

  // Abbreviation initials for organization (e.g. "VinCommerce" -> "VC", "FreshLink" -> "FL")
  const orgInitials = m.organizationName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || 'FL'

  const sidebar = (
    <aside className="portal-sidebar">
      <div className="portal-logo">
        <Logo />
      </div>

      {/* Organization Switcher Card */}
      <div className="org-switch">
        <div className="org-switch-header">
          <span>Không gian làm việc</span>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#d7f5e7', color: '#176b45', fontWeight: 700 }}>
            {m.organizationType}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#176b45', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
            {orgInitials}
          </div>
          <Select
            value={m.organizationId}
            options={user.memberships.map(x => ({ value: x.organizationId, label: x.organizationName }))}
            onChange={value => {
              if (dirty && !window.confirm('Đổi đơn vị sẽ bỏ các thay đổi chưa lưu. Tiếp tục?')) return
              selectWorkspace(value)
              setDirty(false)
              navigate('/portal/dashboard')
            }}
          />
        </div>
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Điều hướng nghiệp vụ">
        {navGroups.map(group => {
          const allowedItems = group.items.filter(it => it.allow)
          if (allowedItems.length === 0) return null
          return (
            <div key={group.group}>
              <div className="nav-group-title">{group.group}</div>
              {allowedItems.map(item => (
                <a
                  href={'/portal/' + item.key}
                  key={item.key}
                  className={root === item.key ? 'active' : ''}
                  onClick={e => {
                    e.preventDefault()
                    go('/portal/' + item.key)
                  }}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Real-time Cold Chain Telemetry Pill in Sidebar */}
      <div className="cold-chain-widget">
        <div className="radar-dot" />
        <div>
          <b>Kho lạnh Hub HN-02</b>
          <small>+3.4°C • Đạt chuẩn</small>
        </div>
      </div>
    </aside>
  )

  const currentLabel = allNavItems.find(n => n.key === root)?.label ?? 'Chi tiết nghiệp vụ'

  return (
    <Layout className="portal-layout">
      {sidebar}
      <Drawer placement="left" open={mobile} onClose={() => setMobile(false)} bodyStyle={{ padding: 0 }}>
        {sidebar}
      </Drawer>

      <div className="portal-main">
        {/* Top Header */}
        <header className="portal-header">
          <Button
            className="menu-trigger"
            type="text"
            icon={<span className="material-symbols-outlined">menu</span>}
            onClick={() => setMobile(true)}
          />

          <GlobalSearch />

          <div className="portal-header-actions">
            <Button
              type="default"
              className="portal-qr-scan-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 20,
                borderColor: '#176b45',
                color: '#176b45',
                fontWeight: 600,
                background: '#f0fdf4'
              }}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18, color: '#176b45' }}>qr_code_scanner</span>}
              onClick={() => setQrModalOpen(true)}
            >
              Quét QR
            </Button>

            {pendingOffline > 0 && (
              <Button
                size="small"
                type="primary"
                danger
                onClick={() => void flushOfflineQueue()}
                style={{ animation: 'pulse-warm 1.8s infinite', fontWeight: 700 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
                Đồng bộ {pendingOffline} ngoại tuyến
              </Button>
            )}

            <Badge count={unreadQuery.data?.unread_count ?? 0} size="small" offset={[-2, 2]}>
              <Link to="/portal/notifications" className="notification-badge-btn" aria-label="Thông báo">
                <span className="material-symbols-outlined">notifications</span>
              </Link>
            </Badge>

            {/* User Profile Capsule */}
            <div className="user-profile-capsule">
              <div className="user-avatar">
                {user.fullName[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="user-info">
                <span className="user-name">{user.fullName}</span>
                <span className="user-role">{m.roles.map(r => roleNames[r] ?? r).join(', ')}</span>
              </div>
            </div>

            <Button
              type="text"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>}
              onClick={() => void logout()}
              title="Đăng xuất"
            >
              <span className="hidden sm:inline">Thoát</span>
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="portal-content" onChangeCapture={() => setDirty(true)}>
          {/* Breadcrumb Indicator */}
          <div className="breadcrumbs">
            <Link to="/portal/dashboard">FreshLink Portal</Link>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
            <span style={{ color: '#176b45', fontWeight: 700 }}>{currentLabel}</span>
          </div>

          {pendingOffline > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16, borderRadius: 10 }}
              message={
                <Space wrap>
                  <span>Đang có {pendingOffline} thao tác tài xế lưu ngoại tuyến trong bộ nhớ đệm.</span>
                  <Button size="small" type="primary" onClick={() => void flushOfflineQueue()}>
                    Đồng bộ ngay
                  </Button>
                </Space>
              }
            />
          )}

          <div className="page-heading">
            <div>
              <h2>{currentLabel}</h2>
              <p style={{ margin: '4px 0 0', color: '#4e655c', fontSize: 13 }}>
                Đơn vị: <b>{m.organizationName}</b> ({m.organizationType})
              </p>
            </div>
          </div>

          {has('SYSTEM_ADMIN') && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 18, borderRadius: 10 }}
              message="Đang thao tác bằng tài khoản Quản trị hệ thống (System Administrator). Mọi thao tác ghi sẽ được lưu lại trong audit log."
            />
          )}

          <section key={m.organizationId + ':' + segment} style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {content}
          </section>
        </main>
      </div>
      <WebQrScannerModal open={qrModalOpen} onClose={() => setQrModalOpen(false)} />
    </Layout>
  )
}

