import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Button, Card, Drawer, Layout, Result, Select, Space } from 'antd'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
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

export default function PortalPage(){
 const {user,membership,selectWorkspace,logout}=useAuth();const location=useLocation();const navigate=useNavigate();const [mobile,setMobile]=useState(false);const [dirty,setDirty]=useState(false)
 const m=membership;const has=(...r:string[])=>can(m,...r)
 useEffect(()=>{const saved=()=>setDirty(false);window.addEventListener('freshlink:saved',saved);return()=>window.removeEventListener('freshlink:saved',saved)},[])
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[dirty])
 if(!user)return <Navigate to="/login" replace/>
 if(!m)return <Result title="Chưa được cấp đơn vị" subTitle="Liên hệ quản trị viên để cấp quyền." extra={<Button onClick={()=>void logout()}>Đăng xuất</Button>}/>
 const internal=m.organizationType==='FRESHLINK'; const supplier=m.organizationType==='SUPPLIER'
 const nav=[
  {key:'dashboard',label:'Việc hôm nay',allow:true},
  {key:'orders',label:'Đơn hàng',allow:has('RESTAURANT_MANAGER','RESTAURANT_PURCHASER','RESTAURANT_RECEIVER','OPERATIONS_COORDINATOR','ACCOUNTANT','CUSTOMER_SUPPORT')},
  {key:'supply-requests',label:supplier?'Yêu cầu cung ứng':'Phân nguồn',allow:has('SUPPLIER_MANAGER','SUPPLIER_STAFF','OPERATIONS_COORDINATOR')},
  {key:'batches',label:'Lô hàng & kiểm nhận',allow:has('SUPPLIER_MANAGER','SUPPLIER_STAFF','QUALITY_INSPECTOR','OPERATIONS_COORDINATOR')},
  {key:'trips',label:'Chuyến giao',allow:has('DRIVER','OPERATIONS_COORDINATOR')},
  {key:'claims',label:'Khiếu nại',allow:has('RESTAURANT_MANAGER','RESTAURANT_RECEIVER','CUSTOMER_SUPPORT')},
  {key:'assets',label:'Thùng luân chuyển',allow:has('RESTAURANT_MANAGER','RESTAURANT_RECEIVER','DRIVER','OPERATIONS_COORDINATOR')},
  {key:supplier?'settlements':'invoices',label:supplier?'Đối soát':'Tài chính',allow:has('SUPPLIER_MANAGER','RESTAURANT_MANAGER','ACCOUNTANT')},
  {key:'analytics',label:'Báo cáo',allow:internal&&has('OPERATIONS_COORDINATOR','QUALITY_INSPECTOR','CUSTOMER_SUPPORT','ACCOUNTANT')},
  {key:'members',label:'Thành viên',allow:!internal&&has('RESTAURANT_MANAGER','SUPPLIER_MANAGER')},
  {key:'admin',label:'Quản trị hệ thống',allow:has('SYSTEM_ADMIN')},
  {key:'account',label:'Tài khoản của tôi',allow:true},
 ]
 const segment=location.pathname.replace(/^\/portal\/?/,'')||'dashboard';const [rawRoot,id]=segment.split('/');const root=rawRoot==='quality'?'batches':rawRoot
 const permitted=root==='notifications'||nav.some(n=>n.key===root&&n.allow)
 let content:ReactNode
 if(!permitted)content=<Result status="403" title="Màn hình không thuộc quyền hiện tại" extra={<Link to="/portal/dashboard">Về việc hôm nay</Link>}/>
 else if(root==='dashboard')content=<DashboardPage/>
 else if(root==='notifications')content=<NotificationsPage/>
 else if(root==='account')content=<AccountPage/>
 else if(root==='admin')content=<AdminPage/>
 else if(root==='members')content=<MembersPage organizationId={m.organizationId}/>
 else if(root==='analytics')content=<AnalyticsPage/>
 else if(id&&/^\d+$/.test(id)&&['orders','batches','trips','claims','settlements'].includes(root))content=<DetailPage type={root} id={Number(id)}/>
 else if(root==='invoices')content=<InvoicesPage restaurantId={internal?undefined:m.organizationId} accountant={has('ACCOUNTANT')}/>
 else if(supplier)content=<SupplierPage organizationId={m.organizationId} initialTab={root==='batches'?'batches':root==='settlements'?'billing':'requests'}/>
 else if(!internal)content=<RestaurantPage organizationId={m.organizationId} initialTab={root==='orders'?(id==='new'?'order':'orders'):root}/>
 else if(root==='trips')content=<TripPage canOptimize={has('OPERATIONS_COORDINATOR')}/>
 else if(root==='assets'&&has('DRIVER')&&!has('OPERATIONS_COORDINATOR'))content=<Card title="Thùng luân chuyển"><p>Thao tác giao hoặc thu thùng được thực hiện theo từng điểm giao trong màn hình Chuyến giao.</p><DataTable path="/assets" rowKey="asset_id" columns={[['asset_id','ID'],['asset_code','Mã thùng'],['status','Trạng thái'],['condition_status','Tình trạng']]}/></Card>
 else content=<OperationsPage initialTab={({orders:'overview','supply-requests':'source',batches:'gate',claims:'claims',assets:'assets'} as Record<string,string>)[root]}/>
 function go(path:string){if(dirty&&!window.confirm('Bạn có nội dung chưa lưu. Rời màn hình?'))return;setDirty(false);navigate(path);setMobile(false)}
 const sidebar=<aside className="portal-sidebar"><div className="portal-logo"><Logo/></div><div className="org-switch"><label>Không gian làm việc</label><Select value={m.organizationId} options={user.memberships.map(x=>({value:x.organizationId,label:x.organizationName}))} onChange={value=>{if(dirty&&!window.confirm('Đổi đơn vị sẽ bỏ các thay đổi chưa lưu. Tiếp tục?'))return;selectWorkspace(value);setDirty(false);navigate('/portal/dashboard')}}/></div><nav aria-label="Điều hướng nghiệp vụ">{nav.filter(n=>n.allow).map(n=><a href={'/portal/'+n.key} key={n.key} className={root===n.key?'active':''} onClick={e=>{e.preventDefault();go('/portal/'+n.key)}}>{n.label}</a>)}</nav></aside>
 return <Layout className="portal-layout">{sidebar}<Drawer placement="left" open={mobile} onClose={()=>setMobile(false)}>{sidebar}</Drawer><div className="portal-main"><header className="portal-header"><Button className="menu-trigger" onClick={()=>setMobile(true)}>☰</Button><GlobalSearch/><Space wrap><Link to="/portal/notifications">Thông báo</Link><span>{user.fullName}<small style={{display:'block'}}>{m.roles.map(r=>roleNames[r]??r).join(', ')}</small></span><Button onClick={()=>void logout()}>Đăng xuất</Button></Space></header><main className="portal-content" onChangeCapture={()=>setDirty(true)}><h2>{nav.find(n=>n.key===root)?.label??'Chi tiết nghiệp vụ'}</h2>{has('SYSTEM_ADMIN')&&<Alert type="info" showIcon message="Đang thao tác bằng tài khoản quản trị. Thay đổi nghiệp vụ ghi nhận người thực hiện là bạn."/>}<section key={m.organizationId+':'+segment}>{content}</section></main></div></Layout>
}
