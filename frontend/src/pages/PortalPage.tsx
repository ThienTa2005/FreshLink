import { useState, type ReactNode } from 'react'
import { Button, Drawer, Layout, Result, Select, Space, Typography } from 'antd'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/Brand'
import RestaurantPage from './RestaurantPage'
import SupplierPage from './SupplierPage'
import OperationsPage from './OperationsPage'
import TripPage from './TripPage'
import { AnalyticsPage, InvoicesPage, MembersPage, NotificationsPage } from './ManagementPages'

type NavItem = { key:string; label:string; icon:string; href:string; roles:string[] }
const nav:NavItem[]=[
 {key:'dashboard',label:'Tổng quan',icon:'▦',href:'/portal/dashboard',roles:['*']},
 {key:'orders',label:'Đơn hàng',icon:'▤',href:'/portal/orders',roles:['RESTAURANT_MANAGER','RESTAURANT_PURCHASER','RESTAURANT_RECEIVER']},
 {key:'supply',label:'Cung ứng & vùng trồng',icon:'♧',href:'/portal/supply-requests',roles:['SUPPLIER_MANAGER','SUPPLIER_STAFF','OPERATIONS_COORDINATOR']},
 {key:'quality',label:'Lô & kiểm hàng QC',icon:'✓',href:'/portal/quality',roles:['SUPPLIER_MANAGER','SUPPLIER_STAFF','QUALITY_INSPECTOR','OPERATIONS_COORDINATOR']},
 {key:'trips',label:'Chuyến giao & lộ trình',icon:'⌁',href:'/portal/trips',roles:['DRIVER','OPERATIONS_COORDINATOR']},
 {key:'claims',label:'Khiếu nại & bù trừ',icon:'!',href:'/portal/claims',roles:['RESTAURANT_MANAGER','RESTAURANT_RECEIVER','CUSTOMER_SUPPORT']},
 {key:'assets',label:'Thùng & tài sản',icon:'□',href:'/portal/assets',roles:['RESTAURANT_MANAGER','RESTAURANT_RECEIVER','DRIVER','OPERATIONS_COORDINATOR']},
 {key:'billing',label:'Tài chính & đối soát',icon:'₫',href:'/portal/invoices',roles:['RESTAURANT_MANAGER','SUPPLIER_MANAGER','ACCOUNTANT']},
 {key:'analytics',label:'Phân tích & báo cáo',icon:'↗',href:'/portal/analytics',roles:['OPERATIONS_COORDINATOR','QUALITY_INSPECTOR','CUSTOMER_SUPPORT','ACCOUNTANT']},
 {key:'members',label:'Thành viên & phân quyền',icon:'◎',href:'/portal/members',roles:['RESTAURANT_MANAGER','SUPPLIER_MANAGER']},
 {key:'admin',label:'Quản trị hệ thống',icon:'⚙',href:'/portal/admin/security',roles:['SYSTEM_ADMIN']},
]
const routeTab:Record<string,string>={dashboard:'overview',orders:'orders','orders/new':'order','supply-requests':'source',quality:'gate',batches:'batches',trips:'trips',claims:'claims',assets:'assets',invoices:'billing',analytics:'overview',members:'partners','admin/security':'partners'}
const titles:Record<string,string>={dashboard:'Tổng quan điều hành',orders:'Quản lý đơn hàng','orders/new':'Tạo đơn hàng','supply-requests':'Điều phối cung ứng',quality:'Lô và kiểm hàng QC',batches:'Quản lý lô hàng',trips:'Chuyến giao và lộ trình',claims:'Khiếu nại và bù trừ',assets:'Thùng và tài sản luân chuyển',invoices:'Tài chính và đối soát',analytics:'Phân tích và báo cáo',members:'Thành viên và phân quyền',notifications:'Trung tâm thông báo','admin/security':'Quản trị hệ thống'}

export default function PortalPage(){
 const {user,logout}=useAuth();const location=useLocation();const [mobile,setMobile]=useState(false);const [org,setOrg]=useState<number>()
 if(!user)return <Navigate to="/login" replace />
 const roles=user.memberships.flatMap(m=>m.roles);const admin=roles.includes('SYSTEM_ADMIN');const has=(...r:string[])=>admin||r.some(x=>roles.includes(x))
 const allowed=nav.filter(item=>admin||item.roles.includes('*')||item.roles.some(r=>roles.includes(r)))
 const segment=location.pathname.replace(/^\/portal\/?/,'')||'dashboard';const root=segment.split('/')[0];const active=segment.startsWith('admin/')?'admin':root==='supply-requests'?'supply':root==='invoices'?'billing':root
 const organizations=user.memberships.filter(m=>m.organizationType!=='FRESHLINK');const organizationId=organizations.some(m=>m.organizationId===org)?org:organizations[0]?.organizationId
 let content:ReactNode
 const requested=nav.find(item=>item.key===active)
 if(requested&&!allowed.some(item=>item.key===requested.key))content=<Result status="403" title="Bạn không có quyền truy cập" subTitle="Màn hình này không thuộc vai trò hiện tại của bạn." extra={<Link className="button button-small" to="/portal/dashboard">Về tổng quan</Link>}/>
 else if(root==='notifications')content=<NotificationsPage />
 else if(root==='members'&&organizationId)content=<MembersPage organizationId={organizationId} />
 else if(root==='analytics')content=<AnalyticsPage />
 else if(root==='invoices')content=<InvoicesPage restaurantId={has('ACCOUNTANT')?undefined:organizationId} accountant={has('ACCOUNTANT')} />
 else if(root==='trips'&&has('DRIVER')&&!has('OPERATIONS_COORDINATOR'))content=<TripPage />
 else if(root==='orders'&&organizationId)content=<RestaurantPage organizationId={organizationId} initialTab={routeTab[segment]??'orders'} />
 else if(root==='batches'&&organizationId&&has('SUPPLIER_MANAGER','SUPPLIER_STAFF'))content=<SupplierPage organizationId={organizationId} initialTab="batches" />
 else if(root==='supply-requests'&&organizationId&&has('SUPPLIER_MANAGER','SUPPLIER_STAFF')&&!has('OPERATIONS_COORDINATOR'))content=<SupplierPage organizationId={organizationId} initialTab="requests" />
 else if(['claims','assets','invoices'].includes(root)&&organizationId&&!has('CUSTOMER_SUPPORT','ACCOUNTANT','OPERATIONS_COORDINATOR'))content=<RestaurantPage organizationId={organizationId} initialTab={root==='invoices'?'billing':root} />
 else if(has('OPERATIONS_COORDINATOR','QUALITY_INSPECTOR','CUSTOMER_SUPPORT','ACCOUNTANT'))content=<OperationsPage initialTab={routeTab[segment]??routeTab[root]} />
 else if(organizationId&&has('SUPPLIER_MANAGER','SUPPLIER_STAFF'))content=<SupplierPage organizationId={organizationId} />
 else if(organizationId)content=<RestaurantPage organizationId={organizationId} />
 else content=<Result status="info" title="Tài khoản chưa có đơn vị phù hợp" subTitle="Liên hệ quản trị viên để được cấp quyền truy cập." />
 const sidebar=<aside className="portal-sidebar"><div className="portal-logo"><Logo /></div>{organizations.length>0&&<div className="org-switch"><label>Đơn vị đối tác</label><Select value={organizationId} options={organizations.map(m=>({value:m.organizationId,label:m.organizationName}))} onChange={setOrg} /></div>}<nav aria-label="Điều hướng nghiệp vụ">{allowed.map(item=><Link key={item.key} className={active===item.key?'active':''} to={item.href} onClick={()=>setMobile(false)}><i>{item.icon}</i><span>{item.label}</span></Link>)}</nav><div className="cold-chain"><b><span /> Hệ thống đang hoạt động</b><small>Dữ liệu được đồng bộ theo thời gian thực.</small></div></aside>
 return <Layout className="portal-layout">{sidebar}<Drawer className="mobile-menu" placement="left" open={mobile} onClose={()=>setMobile(false)} width={292} styles={{body:{padding:0}}}>{sidebar}</Drawer><div className="portal-main"><header className="portal-header"><Button className="menu-trigger" onClick={()=>setMobile(true)} aria-label="Mở menu">☰</Button><div className="global-search">⌕ <input aria-label="Tìm kiếm" placeholder="Mã đơn hàng, sản phẩm, nhà cung cấp..." /></div><div className="pilot-status"><span /> Pilot: Cầu Giấy & Đống Đa</div><Space><Link className="notification-button" to="/portal/notifications" aria-label="Thông báo">♢<b /></Link><div className="user-summary"><strong>{user.fullName}</strong><small>{roles[0]?.replaceAll('_',' ')}</small></div><Button onClick={()=>void logout()}>Đăng xuất</Button></Space></header><main className="portal-content"><div className="breadcrumbs"><Link to="/portal/dashboard">FreshLink</Link><span>/</span><span>{titles[segment]??titles[root]??'Không gian làm việc'}</span></div><div className="page-heading"><div><Typography.Title level={2}>{titles[segment]??titles[root]??'Không gian làm việc'}</Typography.Title><p>Dữ liệu nghiệp vụ được phân quyền theo tài khoản và đơn vị đang chọn.</p></div></div><section key={segment}>{content}</section></main></div></Layout>
}
