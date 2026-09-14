import { useState } from 'react'
import { Alert, Button, Card, Descriptions, Input, List, Space, Table, Tabs, Timeline } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/http'
import { ActionForm, DataTable, EvidenceLink, QrButton, type Row, useRows, options, tomorrow } from '../components/Workspace'
import { can, display, roleNames } from '../components/permissions'
import { useUrlTab } from '../components/useUrlTab'
import { OrderDetail } from './TripPage'
import TripPage from './TripPage'
import { SystemCheckPage } from './ManagementPages'
import { FreshLinkMap, type ColdChainHubPoint, type VehicleMapPoint } from '../components/FreshLinkMap'

export function DashboardPage(){
 const q=useRows('/workspace/tasks');const {user,membership}=useAuth()
 const [syncTime,setSyncTime]=useState(()=>new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))

 const orgType=membership?.organizationType||'FRESHLINK'
 const roleName=(membership?.roles&&membership.roles[0])?(roleNames[membership.roles[0]]||membership.roles[0]):'Thành viên'
 const isBuyer=can(membership,'RESTAURANT_MANAGER','RESTAURANT_PURCHASER')&&orgType==='RESTAURANT'
 const isSupplier=orgType==='SUPPLIER'
 const isQC=can(membership,'QUALITY_INSPECTOR')

 const totalTasks=q.data?.reduce((acc,x)=>acc+(Number(x.count)||0),0)??0
 const todayStr=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date())

 const hubsQuery=useQuery({
  queryKey:['public-hubs'],
  queryFn:()=>api<ColdChainHubPoint[]>('/public/hubs')
 })

 const defaultHubs: ColdChainHubPoint[] = [
  {hubId:1,code:'HUB-HN-01',name:'Hub Trung Tâm Hà Nội #01 (Bắc Thăng Long)',type:'CENTRAL_CROSS_DOCK',address:'KCN Bắc Thăng Long, Huyện Đông Anh, Hà Nội',district:'Đông Anh',city:'Hà Nội',latitude:21.1458,longitude:105.8452,temperatureC:3.4,humidityPercent:88,capacityCrates:3500,activeTrucks:18,phone:'0123456789'},
  {hubId:2,code:'HUB-HN-02',name:'Hub Trung Chuyển Hoàng Mai #02',type:'URBAN_CROSS_DOCK',address:'Km 12 Đường Ngọc Hồi, Quận Hoàng Mai, Hà Nội',district:'Hoàng Mai',city:'Hà Nội',latitude:20.9572,longitude:105.8488,temperatureC:3.8,humidityPercent:86,capacityCrates:2200,activeTrucks:12,phone:'0123456789'},
  {hubId:3,code:'HUB-MC-01',name:'Hub Vùng Nông Sản Mộc Châu (Tây Bắc)',type:'REGIONAL_COLLECTION_HUB',address:'Tiểu khu Vườn Đào, TT. Nông Trường Mộc Châu, Sơn La',district:'Mộc Châu',city:'Sơn La',latitude:20.8436,longitude:104.6642,temperatureC:4.1,humidityPercent:91,capacityCrates:2800,activeTrucks:8,phone:'0123456789'},
  {hubId:4,code:'HUB-DL-01',name:'Hub Nông Sản Công Nghệ Cao Đà Lạt',type:'REGIONAL_COLLECTION_HUB',address:'Đường Vạn Thành, Phường 5, TP. Đà Lạt, Lâm Đồng',district:'Đà Lạt',city:'Lâm Đồng',latitude:11.9404,longitude:108.4182,temperatureC:3.8,humidityPercent:89,capacityCrates:4000,activeTrucks:15,phone:'0123456789'},
  {hubId:5,code:'HUB-HCM-01',name:'Hub Trung Tâm Miền Nam (Củ Chi - TP.HCM)',type:'CENTRAL_CROSS_DOCK',address:'KCN Tân Phú Trung, Quốc lộ 22, Củ Chi, TP. Hồ Chí Minh',district:'Củ Chi',city:'TP. Hồ Chí Minh',latitude:10.9632,longitude:106.5298,temperatureC:3.6,humidityPercent:87,capacityCrates:4200,activeTrucks:22,phone:'0123456789'}
 ]

 const hubsData = hubsQuery.data && hubsQuery.data.length > 0 ? hubsQuery.data : defaultHubs

 const activeVehicles: VehicleMapPoint[] = [
  {vehicle_id:101,vehicle_code:'29H-824.12',driver_name:'Nguyễn Văn Tuấn',driver_phone:'0981234567',latitude:21.0362,longitude:105.7906,temperatureC:3.5,speedKmH:38,status:'Đang giao Cầu Giấy'},
  {vehicle_id:102,vehicle_code:'29C-912.45',driver_name:'Trần Văn Mạnh',driver_phone:'0977654321',latitude:21.0069,longitude:105.8452,temperatureC:3.9,speedKmH:45,status:'Đang giao Hai Bà Trưng'},
  {vehicle_id:103,vehicle_code:'49A-345.89',driver_name:'Lê Hoàng Nam',driver_phone:'0912334455',latitude:11.9520,longitude:108.4350,temperatureC:3.2,speedKmH:52,status:'Đang gom hàng Đà Lạt'}
 ]

 const hour=new Date().getHours()
 const greeting=hour<12?'Chào buổi sáng':hour<18?'Chào buổi chiều':'Chào buổi tối'

 function getTaskMeta(title:string){
  const t=title.toLowerCase()
  if(t.includes('duyệt')||t.includes('phê duyệt')){
   return {icon:'pending_actions',color:'#693b00',bg:'#ffdcbf',badge:'tag-gold',desc:'Hồ sơ hoặc đơn đặt đang chờ xem xét và phê duyệt theo phân quyền.'}
  }
  if(t.includes('giao')||t.includes('xe')||t.includes('chuyến')){
   return {icon:'local_shipping',color:'#005131',bg:'#a4f4c3',badge:'tag-green',desc:'Tiến trình lộ trình giao hàng nông sản tươi sống đến điểm nhận.'}
  }
  if(t.includes('nhận hàng')||t.includes('kiểm')||t.includes('qc')){
   return {icon:'verified_user',color:'#005131',bg:'#cbe9db',badge:'tag-green',desc:'Thực hiện kiểm tra chỉ tiêu VietGAP, nhiệt độ và đối chiếu kiện hàng.'}
  }
  if(t.includes('ngoại lệ')||t.includes('phương án')||t.includes('khiếu nại')||t.includes('hỏng')||t.includes('thiếu')){
   return {icon:'warning',color:'#ba1a1a',bg:'#ffdad6',badge:'tag-red',desc:'Cần giải quyết sự cố sai lệch số lượng hoặc hàng không đạt quy cách.'}
  }
  if(t.includes('tiền')||t.includes('công nợ')||t.includes('thanh toán')||t.includes('phiếu')||t.includes('chi trả')){
   return {icon:'receipt_long',color:'#40690a',bg:'#bff286',badge:'tag-gold',desc:'Bảng kê chi tiết thanh toán và đối soát công nợ định kỳ.'}
  }
  if(t.includes('yêu cầu')||t.includes('cung ứng')){
   return {icon:'eco',color:'#005131',bg:'#d7f5e7',badge:'tag-green',desc:'Nhu cầu rau củ quả chuẩn bị xuất kho từ hợp tác xã hoặc nông trại.'}
  }
  return {icon:'task_alt',color:'#005131',bg:'#e7fff3',badge:'tag-blue',desc:'Nhiệm vụ nghiệp vụ cần thao tác để đảm bảo chuỗi cung ứng liên tục.'}
 }

 return (
  <div className="dashboard-console" style={{display:'flex',flexDirection:'column',gap:20}}>
   {/* HERO BANNER WITH GREETING & ORG CONTEXT */}
   <div className="dashboard-hero">
    <div className="dashboard-hero-content">
     <h2>
      <span>{greeting}, {user?.fullName||'Quý khách'}</span>
      <span className="material-symbols-outlined" style={{fontSize:26,color:'#a4f4c3'}}>waving_hand</span>
     </h2>
     <p>
      Không gian làm việc: <b>{membership?.organizationName||'Hệ thống FreshLink'}</b> ({roleName}) — Giám sát chuỗi lạnh & nông sản B2B thời gian thực.
     </p>
    </div>
    <div className="dashboard-hero-meta">
     <div className="dashboard-hero-pill">
      <span className="material-symbols-outlined" style={{fontSize:16,color:'#a4f4c3'}}>calendar_month</span>
      <span>{todayStr}</span>
     </div>
     <div className="dashboard-hero-pill">
      <span className="radar-dot" style={{width:8,height:8,borderRadius:'50%',background:'#a4f4c3',display:'inline-block'}}></span>
      <span>Đồng bộ: {syncTime}</span>
     </div>
     <Button
      size="small"
      style={{borderRadius:9999,background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',fontWeight:600}}
      onClick={()=>{
       void q.refetch()
       setSyncTime(new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
      }}
     >
      <span className="material-symbols-outlined" style={{fontSize:14,verticalAlign:'middle',marginRight:4}}>refresh</span>
      Làm mới
     </Button>
     {isBuyer&&(
      <Link to="/portal/orders/new" className="button button-small" style={{background:'#a4f4c3',color:'#002111',fontWeight:700,borderRadius:9999,border:'none'}}>
       <span className="material-symbols-outlined" style={{fontSize:16,verticalAlign:'middle',marginRight:4}}>add_shopping_cart</span>
       Đặt hàng mới
      </Link>
     )}
    </div>
   </div>

   {/* BENTO METRICS GRID */}
   <div className="kpi-bento-grid">
    <div className="kpi-bento-card">
     <div className="kpi-card-header">
      <span className="kpi-label">Việc cần xử lý</span>
      <div className="kpi-icon-wrap" style={{background:totalTasks>0?'#ffdad6':'#d7f5e7',color:totalTasks>0?'#ba1a1a':'#005131'}}>
       <span className="material-symbols-outlined">{totalTasks>0?'notifications_active':'check_circle'}</span>
      </div>
     </div>
     <div className="kpi-value" style={{color:totalTasks>0?'#ba1a1a':'#005131'}}>
      {totalTasks} <span style={{fontSize:14,fontWeight:500,color:'var(--text-muted)'}}>hạng mục</span>
     </div>
     <div className="kpi-sub">
      <span className="material-symbols-outlined" style={{fontSize:15,color:totalTasks>0?'#ba1a1a':'#005131'}}>
       {totalTasks>0?'priority_high':'done_all'}
      </span>
      <span>{totalTasks>0?'Cần thao tác ngay':'Không có việc tồn đọng'}</span>
     </div>
    </div>

    <div className="kpi-bento-card">
     <div className="kpi-card-header">
      <span className="kpi-label">{isSupplier?'Sản lượng cung ứng':isBuyer?'Tỷ lệ đúng giờ SLA':'Lệnh điều phối mạng lưới'}</span>
      <div className="kpi-icon-wrap">
       <span className="material-symbols-outlined">{isSupplier?'scale':isBuyer?'timer':'local_shipping'}</span>
      </div>
     </div>
     <div className="kpi-value">
      {isSupplier?'4.820,5 kg':isBuyer?'99.4%':'184.250.000 đ'}
     </div>
     <div className="kpi-sub">
      <span className="material-symbols-outlined" style={{fontSize:15,color:'#005131'}}>trending_up</span>
      <span style={{color:'#005131',fontWeight:650}}>+14.8%</span>
      <span>so với tuần trước</span>
     </div>
    </div>

    <div className="kpi-bento-card">
     <div className="kpi-card-header">
      <span className="kpi-label">Chuỗi lạnh kiểm soát</span>
      <div className="kpi-icon-wrap" style={{background:'#dcfaec',color:'#005131'}}>
       <span className="material-symbols-outlined">ac_unit</span>
      </div>
     </div>
     <div className="kpi-value" style={{color:'#005131'}}>
      +3.4°C
     </div>
     <div className="kpi-sub">
      <span className="material-symbols-outlined" style={{fontSize:15,color:'#005131'}}>verified</span>
      <span>100% cảm biến đạt dải chuẩn</span>
     </div>
    </div>

    <div className="kpi-bento-card">
     <div className="kpi-card-header">
      <span className="kpi-label">{isQC?'Đạt chuẩn KCS (QC)':'Thùng IoT luân chuyển'}</span>
      <div className="kpi-icon-wrap">
       <span className="material-symbols-outlined">{isQC?'biotech':'all_inbox'}</span>
      </div>
     </div>
     <div className="kpi-value">
      {isQC?'98.2%':'90.6%'}
     </div>
     <div className="kpi-sub">
      <span className="material-symbols-outlined" style={{fontSize:15,color:'#005131'}}>check_circle</span>
      <span>{isQC?'122/124 lô thông quan':'1.450/1.600 thùng thu hồi'}</span>
     </div>
    </div>
   </div>

   {/* INTERACTIVE COLD CHAIN NETWORK MAP */}
   <div style={{ marginBottom: 24 }}>
    <FreshLinkMap
     title="Bản đồ Mạng Lưới Chuỗi Lạnh & Vị Trí Kho B2B"
     subtitle="Giám sát trực quan các Hub Cross-dock, vùng thu mua nông sản Tây Bắc / Đà Lạt và đội xe lạnh vệ tinh"
     hubs={hubsData}
     vehicles={activeVehicles}
     height="430px"
     zoom={6}
     center={[16.0, 107.5]}
    />
   </div>

   {/* COLD CHAIN TELEMETRY STRIP */}
   <div className="hub-telemetry-section">
    <div className="hub-telemetry-header">
     <div style={{display:'flex',alignItems:'center',gap:8}}>
      <span className="material-symbols-outlined" style={{color:'#005131'}}>sensors</span>
      <strong style={{fontSize:14,color:'var(--text-primary)'}}>Mạng lưới kho lạnh & Giám sát nhiệt độ Cross-dock</strong>
     </div>
     <span style={{fontSize:12,color:'var(--text-muted)'}}>Cập nhật qua IoT Gateway</span>
    </div>
    <div className="hub-telemetry-grid">
     {hubsData.slice(0, 4).map(hub => (
      <div key={hub.code} className="hub-telemetry-item">
       <div className="hub-dot"></div>
       <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{hub.name}</div>
        <div style={{fontSize:11.5,color:'var(--text-secondary)',fontFamily:'Inter'}}>
         +{hub.temperatureC?.toFixed(1)}°C · {hub.district}, {hub.city} · {hub.activeTrucks ?? 12} xe xuất bến
        </div>
       </div>
      </div>
     ))}
    </div>
   </div>

   {/* ACTIONS REQUIRED / TASKS LIST */}
   <Card
    title={
     <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
       <span className="material-symbols-outlined" style={{color:'#005131',fontSize:24}}>rule</span>
       <span style={{fontSize:16,fontWeight:850}}>Nhiệm vụ cần xử lý theo vai trò (Action Items)</span>
       {totalTasks>0&&(
        <span className="tag tag-gold" style={{fontSize:12}}>{totalTasks} việc đang chờ</span>
       )}
      </div>
      <span style={{fontSize:12,color:'var(--text-muted)',fontWeight:500}}>
       Dựa trên phân quyền {roleName}
      </span>
     </div>
    }
    loading={q.isPending}
   >
    {q.error&&(
     <Alert type="error" message={q.error.message} action={<Button onClick={()=>void q.refetch()}>Thử lại</Button>} style={{marginBottom:16}}/>
    )}

    {q.data&&q.data.length>0?(
     <div className="tasks-action-grid">
      {q.data.map(task=>{
       const meta=getTaskMeta(String(task.title))
       const count=Number(task.count)||0
       return (
        <div key={String(task.title)+String(task.url)} className="task-card">
         <div>
          <div className="task-card-top">
           <div className="task-card-icon" style={{background:meta.bg,color:meta.color}}>
            <span className="material-symbols-outlined">{meta.icon}</span>
           </div>
           <span className={`task-badge-count ${count>0?meta.badge:'tag-green'}`}>
            {count} mục
           </span>
          </div>
          <h4>{String(task.title)}</h4>
          <p>{meta.desc}</p>
         </div>
         <Link to={String(task.url)} className="task-link-btn">
          <span>Mở công việc</span>
          <span className="material-symbols-outlined" style={{fontSize:16}}>arrow_forward</span>
         </Link>
        </div>
       )
      })}
     </div>
    ):(
     !q.isPending&&(
      <div style={{textAlign:'center',padding:'36px 16px'}}>
       <div style={{width:56,height:56,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
        <span className="material-symbols-outlined" style={{fontSize:32}}>verified</span>
       </div>
       <h4 style={{fontSize:16,fontWeight:700,margin:'0 0 4px 0'}}>Tất cả công việc đã hoàn tất!</h4>
       <p style={{color:'var(--text-secondary)',fontSize:13,margin:0,maxWidth:440,display:'inline-block'}}>
        Chuỗi cung ứng vận hành trơn tru và không có công việc nào đang chờ bạn xử lý tại tổ chức này.
       </p>
      </div>
     )
    )}
   </Card>

   {/* QUICK OPERATIONAL SHORTCUTS FILTERED BY ROLE */}
   {(() => {
    const shortcuts = [
     {
      to: '/portal/products',
      label: 'Sản phẩm HTX',
      icon: 'spa',
      allow: isSupplier && can(membership, 'SUPPLIER_MANAGER', 'SUPPLIER_STAFF'),
     },
     {
      to: '/portal/orders',
      label: 'Đơn hàng B2B',
      icon: 'receipt_long',
      allow: !isSupplier && can(membership, 'RESTAURANT_MANAGER', 'RESTAURANT_PURCHASER', 'RESTAURANT_RECEIVER', 'OPERATIONS_COORDINATOR', 'ACCOUNTANT', 'CUSTOMER_SUPPORT'),
     },
     {
      to: '/portal/supply-requests',
      label: isSupplier ? 'Yêu cầu cung ứng' : 'Phân nguồn cung',
      icon: 'local_florist',
      allow: can(membership, 'SUPPLIER_MANAGER', 'SUPPLIER_STAFF', 'OPERATIONS_COORDINATOR'),
     },
     {
      to: '/portal/batches',
      label: 'Lô hàng & QC',
      icon: 'biotech',
      allow: can(membership, 'SUPPLIER_MANAGER', 'SUPPLIER_STAFF', 'QUALITY_INSPECTOR', 'OPERATIONS_COORDINATOR'),
     },
     {
      to: '/portal/trips',
      label: 'Chuyến giao xe lạnh',
      icon: 'local_shipping',
      allow: can(membership, 'DRIVER', 'OPERATIONS_COORDINATOR'),
     },
     {
      to: '/portal/claims',
      label: 'Khiếu nại & Bù trừ',
      icon: 'assignment_late',
      allow: can(membership, 'RESTAURANT_MANAGER', 'RESTAURANT_RECEIVER', 'CUSTOMER_SUPPORT'),
     },
     {
      to: isSupplier ? '/portal/settlements' : '/portal/invoices',
      label: isSupplier ? 'Đối soát HTX' : 'Tài chính & Hóa đơn',
      icon: 'payments',
      allow: isSupplier ? can(membership, 'SUPPLIER_MANAGER') : can(membership, 'RESTAURANT_MANAGER', 'ACCOUNTANT'),
     },
     {
      to: '/portal/assets',
      label: 'Thùng SmartCrate',
      icon: 'all_inbox',
      allow: can(membership, 'RESTAURANT_MANAGER', 'RESTAURANT_RECEIVER', 'DRIVER', 'OPERATIONS_COORDINATOR'),
     },
     {
      to: '/portal/admin',
      label: 'Quản trị hệ thống',
      icon: 'admin_panel_settings',
      allow: can(membership, 'SYSTEM_ADMIN'),
     },
     {
      to: '/trace/demo',
      target: '_blank',
      label: 'Tra cứu QR VietGAP',
      icon: 'qr_code_scanner',
      allow: true,
     },
    ].filter(s => s.allow)

    if (shortcuts.length === 0) return null

    return (
     <Card
      title={
       <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span className="material-symbols-outlined" style={{color:'#005131',fontSize:22}}>bolt</span>
        <span style={{fontSize:15,fontWeight:750}}>Phím tắt nghiệp vụ chính ({roleName})</span>
       </div>
      }
      size="small"
     >
      <div className="quick-shortcuts-grid">
       {shortcuts.map(s => (
        <Link key={s.to} to={s.to} target={s.target} className="quick-shortcut-card">
         <span className="material-symbols-outlined" style={{color:'#005131'}}>{s.icon}</span>
         <span>{s.label}</span>
        </Link>
       ))}
      </div>
     </Card>
    )
   })()}
  </div>
 )
}
export function AccountPage(){const {discardSession}=useAuth();return <ActionForm title="Đổi mật khẩu" path="/auth/change-password" fields={[{name:'currentPassword',label:'Mật khẩu hiện tại',type:'password'},{name:'newPassword',label:'Mật khẩu mới (12–72 ký tự, tối đa 72 byte)',type:'password'}]} onDone={discardSession}/>}

export function DetailPage({type,id}:{type:string;id:number}){
 if(type==='orders')return <OrderDetail orderId={id}/>
 if(type==='trips')return <TripPage initialSelected={id}/>
 if(type==='batches')return <BatchDetail id={id}/>
 if(type==='claims')return <ClaimDossierDetail id={id}/>
 if(type==='settlements')return <SettlementStatementDetail id={id}/>
 return <RecordDetail type={type} id={id}/>
}
function ClaimDossierDetail({id}:{id:number}){
 const q=useQuery({queryKey:['claim-dossier',id],queryFn:()=>api<Row>(`/claims/${id}/dossier`)});const d=q.data
 const complaint=(d?.complaint as Row)||{};const items=(d?.items as Row[])||[];const delivery=(d?.delivery as Row)||null;const notes=(d?.notes as Row[])||[]
 const isStaff=Boolean(d?.isInternalStaff)
 const [noteContent,setNoteContent]=useState('');const [isInternal,setIsInternal]=useState(true);const [delegateDept,setDelegateDept]=useState('QC')
 const [closeModal,setCloseModal]=useState(false);const [resolution,setResolution]=useState('');const [refundAmount,setRefundAmount]=useState(0);const [busy,setBusy]=useState(false);const [error,setError]=useState('')

 async function postNote(){if(!noteContent.trim())return;setBusy(true);setError('');try{await api(`/claims/${id}/notes`,'POST',{content:noteContent,isInternal});setNoteContent('');await q.refetch()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function delegate(){setBusy(true);setError('');try{await api(`/claims/${id}/delegate`,'POST',{department:delegateDept,note:`Chuyển tiếp xử lý: ${delegateDept}`});await q.refetch()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function closeCase(){if(!resolution.trim())return;setBusy(true);setError('');try{await api(`/claims/${id}/close`,'POST',{finalResolution:resolution,refundAmount});setCloseModal(false);await q.refetch()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}

 return <Card title={<Space><span>Hồ sơ khiếu nại 360° #{id}</span><span className={`tag ${complaint.status==='CLOSED'?'tag-green':'tag-gold'}`}>{display(complaint.status)}</span></Space>} loading={q.isPending}>
  {error&&<Alert type="error" message={error} style={{marginBottom:12}}/>}
  {Boolean(d?.isSlaOverdue)&&<Alert type="error" message="CẢNH BÁO: Khiếu nại đã quá hạn cam kết SLA xử lý!" showIcon style={{marginBottom:12}}/>}
  <Descriptions bordered column={{xs:1,sm:2,md:3}}>
   <Descriptions.Item label="Mã khiếu nại">{String(complaint.complaint_code??'')}</Descriptions.Item>
   <Descriptions.Item label="Khách hàng">{String(complaint.restaurant_name??'')}</Descriptions.Item>
   <Descriptions.Item label="Đơn liên quan"><Link to={`/portal/orders/${complaint.order_id}`}>{String(complaint.order_code??'')}</Link></Descriptions.Item>
   <Descriptions.Item label="Hạn phản hồi">{String(complaint.first_response_due_at??'Chưa đặt')}</Descriptions.Item>
   <Descriptions.Item label="Hạn giải quyết">{String(complaint.resolution_due_at??'Chưa đặt')}</Descriptions.Item>
   <Descriptions.Item label="Bộ phận">{String(complaint.assigned_department??'CSKH')}</Descriptions.Item>
   <Descriptions.Item label="Mô tả" span={3}>{String(complaint.description??'')}</Descriptions.Item>
   {complaint.final_resolution!=null&&<Descriptions.Item label="Phương án giải quyết" span={3}><b style={{color:'#176b45'}}>{String(complaint.final_resolution)}</b></Descriptions.Item>}
  </Descriptions>
  {delivery&&<Card title="Giao nhận liên quan" size="small" style={{marginTop:16}}><p>Chuyến xe: <b>{String(delivery.trip_code??'')}</b> · Tài xế: <b>{String(delivery.driver_name??'')}</b> ({String(delivery.driver_phone??'')})</p><p>Trạng thái: {display(delivery.stop_status)} · Đến lúc: {display(delivery.actual_arrival_at,'arrival')}</p></Card>}
  <Card title="Sản phẩm & Lô hàng ảnh hưởng" size="small" style={{marginTop:16}}><List dataSource={items} renderItem={it=><List.Item><b>{String(it.sku_name)}</b> — Lô: {String(it.batch_code??'Chưa rõ')} · SL ảnh hưởng: <b>{String(it.affected_quantity)}</b></List.Item>}/></Card>
  <Card title="Lịch sử ghi chú & Phản hồi" size="small" style={{marginTop:16}}>
   <List dataSource={notes} renderItem={n=><List.Item><List.Item.Meta title={<Space><span>{String(n.author_name??'Hệ thống')}</span><span className={`tag ${n.is_internal?'tag-gold':'tag-green'}`}>{n.is_internal?'Ghi chú nội bộ':'Gửi nhà hàng'}</span><small>{String(n.created_at)}</small></Space>} description={<p style={{margin:0}}>{String(n.note_content)}</p>}/></List.Item>}/>
   <div style={{marginTop:16}}><Input.TextArea rows={2} placeholder="Nhập ghi chú / nội dung phản hồi..." value={noteContent} onChange={e=>setNoteContent(e.target.value)}/><Space style={{marginTop:8}}>{isStaff&&<label><input type="checkbox" checked={isInternal} onChange={e=>setIsInternal(e.target.checked)}/> Ghi chú nội bộ (chỉ nhân viên)</label>}<Button type="primary" loading={busy} disabled={!noteContent.trim()} onClick={()=>void postNote()}>Gửi ghi chú</Button></Space></div>
  </Card>
  {isStaff&&complaint.status!=='CLOSED'&&<Space style={{marginTop:16}} wrap>
   <select value={delegateDept} onChange={e=>setDelegateDept(e.target.value)} style={{height:38,padding:'0 10px',borderRadius:6}}>
    <option value="QC">Chuyển cho QC</option><option value="COORDINATOR">Chuyển cho Điều phối</option><option value="ACCOUNTANT">Chuyển cho Kế toán</option><option value="CSKH">Trả về CSKH</option>
   </select>
   <Button onClick={()=>void delegate()} loading={busy}>Chuyển bộ phận</Button>
   <Button type="primary" danger onClick={()=>setCloseModal(true)}>Đóng khiếu nại (Đủ điều kiện)</Button>
  </Space>}
  {closeModal&&<Card title="Đóng khiếu nại" style={{marginTop:16}}><Input.TextArea rows={3} placeholder="Mô tả nguyên nhân và giải pháp đã thực hiện..." value={resolution} onChange={e=>setResolution(e.target.value)}/><div style={{marginTop:8}}><label>Số tiền hoàn / bồi thường (đ): </label><input type="number" min="0" value={refundAmount} onChange={e=>setRefundAmount(Number(e.target.value))} style={{height:36,padding:'0 10px'}}/></div><Space style={{marginTop:12}}><Button onClick={()=>setCloseModal(false)}>Hủy</Button><Button type="primary" danger loading={busy} disabled={!resolution.trim()} onClick={()=>void closeCase()}>Xác nhận đóng hồ sơ</Button></Space></Card>}
 </Card>
}
function SettlementStatementDetail({id}:{id:number}){
 const q=useQuery({queryKey:['settlement-statement',id],queryFn:()=>api<Row>(`/billing/settlements/${id}/statement`)});const d=q.data
 const s=(d?.settlement as Row)||d||{};const items=(d?.items as Row[])||[]
 return <Card title={`Bảng kê đối soát chi tiết #${id}`} loading={q.isPending} extra={<Button onClick={()=>window.print()}>In bảng kê</Button>}>
  <Descriptions bordered column={{xs:1,sm:2}}>
   <Descriptions.Item label="Mã đối soát">{String(s.settlement_code??'')}</Descriptions.Item>
   <Descriptions.Item label="Nhà cung cấp">{String(s.supplier_name??'')}</Descriptions.Item>
   <Descriptions.Item label="Kỳ đối soát">{String(s.period_start_date??s.period_start??'')} đến {String(s.period_end_date??s.period_end??'')}</Descriptions.Item>
   <Descriptions.Item label="Tổng tiền thanh toán"><b style={{color:'#176b45'}}>{display(d?.totalAmount??s.payable_amount,'price')} đ</b></Descriptions.Item>
   <Descriptions.Item label="Trạng thái">{display(s.status)}</Descriptions.Item>
   <Descriptions.Item label="Chứng từ">{String(s.external_reference??'Chưa có')}</Descriptions.Item>
  </Descriptions>
  <Card title="Chi tiết các lô hàng trong kỳ" size="small" style={{marginTop:16}}>
   <Table<Row> rowKey={r=>String(r.settlement_item_id??r.batch_id??Math.random())} dataSource={items} pagination={false} scroll={{x:'max-content'}}
     columns={[
       {key:'batch_code',title:'Mã lô',dataIndex:'batch_code',render:(v:unknown)=>display(v,'batch_code')},
       {key:'sku_name',title:'Mặt hàng',dataIndex:'sku_name',render:(v:unknown)=>display(v,'sku_name')},
       {key:'delivered_quantity',title:'Số lượng',dataIndex:'delivered_quantity',render:(v:unknown)=>display(v,'quantity')},
       {key:'supplier_unit_price',title:'Đơn giá',dataIndex:'supplier_unit_price',render:(v:unknown)=>display(v,'price')},
       {key:'net_amount',title:'Thành tiền',dataIndex:'net_amount',render:(v:unknown)=>display(v,'price')}
     ]}/>
  </Card>
 </Card>
}
function RecordDetail({type,id}:{type:string;id:number}){
 const path=type==='settlements'?`/workspace/settlements/${id}`:`/${type}/${id}`;const q=useQuery({queryKey:[path],queryFn:()=>api<Row>(path)})
 const fields=type==='settlements'?['settlement_code','payable_amount','status','paid_at','external_reference']:['complaint_code','description','status','final_resolution','submitted_at']
 return <Card title={type==='settlements'?'Chi tiết đối soát':'Chi tiết khiếu nại'} loading={q.isPending}>{q.error&&<Alert type="error" message={q.error.message}/>}<Descriptions column={1} items={fields.map(k=>({key:k,label:({settlement_code:'Mã phiếu',payable_amount:'Phải trả',status:'Trạng thái',paid_at:'Ngày thanh toán',external_reference:'Chứng từ',complaint_code:'Mã khiếu nại',description:'Nội dung',final_resolution:'Phương án',submitted_at:'Ngày gửi'} as Record<string,string>)[k],children:display(q.data?.[k],k)}))}/><List dataSource={q.data?.items as Row[]??[]} renderItem={x=><List.Item>{String(x.sku_name??x.batch_code??'')} · {display(x.affected_quantity??x.net_amount)}</List.Item>}/></Card>
}
export function BatchDetail({id}:{id:number}){
 const {membership}=useAuth();const qc=can(membership,'QUALITY_INSPECTOR');const supplier=membership?.organizationType==='SUPPLIER';const [scan,setScan]=useState('');const navigate=useNavigate()
 const q=useQuery({queryKey:['batch',id],queryFn:()=>api<Row>(`/batches/${id}`)});const docs=useRows(`/batches/${id}/document-requests`);const b=q.data
 const refresh=()=>{void q.refetch();void docs.refetch()}
 return <><Space><Input placeholder="Mã QR / mã lô để tìm" value={scan} onChange={e=>setScan(e.target.value)}/><Button onClick={()=>navigate('/portal/batches?search='+encodeURIComponent(scan))}>Tìm lô</Button></Space><Card loading={q.isPending} title={String(b?.batch_code??'Chi tiết lô')}>{q.error&&<Alert type="error" message={q.error.message}/>}<Descriptions items={['sku_name','supplier_name','declared_quantity','accepted_quantity','review_quantity','rejected_quantity','batch_status','trace_note'].map(k=>({key:k,label:({sku_name:'Sản phẩm',supplier_name:'NCC',declared_quantity:'Khai báo',accepted_quantity:'Đạt',review_quantity:'Giữ lại',rejected_quantity:'Từ chối',batch_status:'Trạng thái',trace_note:'Nguồn gốc'} as Record<string,string>)[k],children:display(b?.[k],k)}))}/><QrButton type="BATCH" id={id}/></Card>
 {supplier&&b?.batch_status==='CREATED'&&<><ActionForm title="Sửa lô" method="PUT" path={`/batches/${id}`} fields={[{name:'quantity',label:'Số lượng',type:'number',min:0.001,initial:b.declared_quantity},{name:'origin',label:'Nguồn gốc',type:'textarea',initial:b.trace_note}]} onDone={refresh}/><ActionForm title="Hủy lô chưa kiểm" path={`/batches/${id}/cancel`} fields={[{name:'reason',label:'Lý do'}]} onDone={refresh}/></>}
 {qc&&b?.batch_status==='CREATED'&&<ActionForm title="Kiểm nhận lô" path={`/batches/${id}/inspect`} fields={[{name:'accepted',label:'Đạt',type:'number',initial:b.declared_quantity},{name:'review',label:'Giữ lại',type:'number',initial:0},{name:'rejected',label:'Từ chối (gồm lượng thiếu)',type:'number',initial:0},{name:'note',label:'Kết quả kiểm nhận',type:'textarea'},{name:'evidenceId',label:'Ảnh kiểm nhận',type:'file',required:false},...['SPECIFICATION','PACKAGING','LABEL','APPEARANCE'].map((name,i)=>({name,label:['Quy cách','Bao bì','Nhãn','Ngoại quan'][i],type:'select' as const,initial:'PASS',options:[{value:'PASS',label:'Đạt'},{value:'REVIEW',label:'Cần kiểm lại'},{value:'FAIL',label:'Không đạt'}]}))]} transform={v=>{if(Math.abs(Number(v.accepted)+Number(v.review)+Number(v.rejected)-Number(b.declared_quantity))>0.00001)throw new Error('Tổng đạt + giữ + từ chối phải bằng lượng khai báo');return {...v,checklist:Object.fromEntries(['SPECIFICATION','PACKAGING','LABEL','APPEARANCE'].map(k=>[k,v[k]]))}}} onDone={refresh}/>}
 {qc&&Number(b?.review_quantity)>0&&<ActionForm title="Tái kiểm lượng cách ly" path={`/batches/${id}/reinspect`} fields={[{name:'accepted',label:'Đạt sau tái kiểm',type:'number',initial:b?.review_quantity},{name:'rejected',label:'Từ chối',type:'number',initial:0},{name:'note',label:'Kết luận',type:'textarea'}]} transform={v=>{if(Math.abs(Number(v.accepted)+Number(v.rejected)-Number(b?.review_quantity))>0.00001)throw new Error('Tổng phải bằng lượng cách ly');return v}} onDone={refresh}/>}
 {qc&&<ActionForm title="Yêu cầu bổ sung hồ sơ" path={`/batches/${id}/document-requests`} fields={[{name:'documentType',label:'Loại hồ sơ'},{name:'message',label:'Nội dung cần bổ sung',type:'textarea'}]} onDone={refresh}/>}
 <Card title="Hồ sơ bổ sung">{docs.error&&<Alert type="error" message={docs.error.message}/>}<List dataSource={docs.data??[]} renderItem={d=><List.Item><Space direction="vertical"><strong>{String(d.document_type)} · {display(d.status)}</strong><p>{String(d.message)}</p>{d.submitted_file_id!=null&&<EvidenceLink id={Number(d.submitted_file_id)}/>} {supplier&&['OPEN','REJECTED'].includes(String(d.status))&&<ActionForm title="Nộp hồ sơ" path={`/batches/document-requests/${d.document_request_id}/submit`} fields={[{name:'fileId',label:'Tệp',type:'file'},{name:'note',label:'Ghi chú',required:false}]} onDone={refresh}/>} {qc&&d.status==='SUBMITTED'&&<ActionForm title="Duyệt hồ sơ" path={`/batches/document-requests/${d.document_request_id}/review`} fields={[{name:'accepted',label:'Kết quả',type:'select',options:[{value:'yes',label:'Chấp nhận'},{value:'no',label:'Bổ sung lại'}]},{name:'note',label:'Phản hồi'}]} transform={v=>({...v,accepted:v.accepted==='yes'})} onDone={refresh}/>}</Space></List.Item>}/></Card>
 <Card title="Lịch sử kiểm nhận"><Timeline items={(b?.inspections as Row[]??[]).map(x=>({children:<>{display(x.inspected_at,'inspected_at')} · {String(x.general_note)} · Đạt {String(x.accepted_quantity)}, giữ {String(x.review_quantity)}, từ chối {String(x.rejected_quantity)}</>}))}/></Card></>
}

export function AdminPage(){
 const [tab,setTab]=useUrlTab('partners');const [selected,setSelected]=useState<Row>();const [error,setError]=useState('');const [preview,setPreview]=useState<string>();const partners=useRows('/admin/partners')
 return <>{error&&<Alert type="error" message={error}/>}<Tabs activeKey={tab} onChange={setTab} items={[
 {key:'partners',label:'Đối tác',children:<><DataTable path="/admin/partners" rowKey="organization_id" columns={[[ 'organization_name','Đơn vị'],['organization_type','Loại'],['status','Trạng thái']]} actions={r=><Space><Button onClick={()=>setSelected(r)}>Xem / xử lý</Button>{r.status==='PENDING'&&<Button onClick={async()=>{try{await api(`/admin/partners/${r.organization_id}/approve`,'POST');await partners.refetch()}catch(e){setError((e as Error).message)}}}>Duyệt</Button>}</Space>}/>{selected&&<><ActionForm key={String(selected.organization_id)} title={`Xử lý ${selected.organization_name}`} method="PATCH" path={`/admin/partners/${selected.organization_id}/status`} fields={[{name:'status',label:'Trạng thái',type:'select',options:[{value:'REJECTED',label:'Từ chối'},{value:'SUSPENDED',label:'Tạm dừng'},{value:'ACTIVE',label:'Kích hoạt lại'}]},{name:'reason',label:'Lý do',type:'textarea'}]}/><ActionForm title="Yêu cầu bổ sung đăng ký" path={`/admin/partners/${selected.organization_id}/request-information`} fields={[{name:'reason',label:'Nội dung cần bổ sung',type:'textarea'}]}/></>}</>},
 {key:'staff',label:'Nhân viên & quyền',children:<><DataTable path="/admin/staff" rowKey="user_id" columns={[[ 'full_name','Họ tên'],['email','Email'],['roles','Quyền'],['status','Trạng thái']]} actions={r=><Button onClick={()=>setSelected(r)}>Sửa</Button>}/>{selected?.user_id!=null&&<ActionForm key={String(selected.user_id)} title="Cập nhật nhân viên" method="PUT" path={`/admin/staff/${selected.user_id}`} fields={[{name:'fullName',label:'Họ tên',initial:selected.full_name},{name:'status',label:'Trạng thái',type:'select',initial:selected.status,options:[{value:'ACTIVE',label:'Hoạt động'},{value:'DISABLED',label:'Khóa'}]},{name:'roles',label:'Quyền',type:'multiple',initial:selected.roles,options:Object.entries(roleNames).filter(([r])=>['OPERATIONS_COORDINATOR','QUALITY_INSPECTOR','ACCOUNTANT','CUSTOMER_SUPPORT','DRIVER'].includes(r)).map(([value,label])=>({value,label}))}]}/>}<ActionForm title="Thêm tài khoản nhân viên mới" path="/admin/staff" fields={[{name:'email',label:'Email'},{name:'fullName',label:'Họ tên'},{name:'password',label:'Mật khẩu ban đầu (ít nhất 12 ký tự)',type:'password'},{name:'roles',label:'Quyền được cấp',type:'multiple',options:Object.entries(roleNames).filter(([r])=>['OPERATIONS_COORDINATOR','QUALITY_INSPECTOR','ACCOUNTANT','CUSTOMER_SUPPORT','DRIVER'].includes(r)).map(([value,label])=>({value,label}))}]} onDone={()=>setSelected(undefined)}/></>},
 {key:'catalog',label:'Danh mục & giá',children:<><DataTable path="/operations/catalog" rowKey="sku_id" columns={[['sku_name','Tên SKU'],['sku_code','Mã SKU'],['category_name','Nhóm'],['base_unit','Đơn vị'],['pack_size','Quy cách'],['active','Đang bán']]} /><ActionForm title="Thiết lập đơn giá bán SKU" path="/operations/prices" fields={[{name:'skuId',label:'SKU',type:'select',options:options(useRows('/public/catalog?date='+tomorrow()).data,'sku_id','sku_name')},{name:'price',label:'Đơn giá bán (đ)',type:'number'},{name:'date',label:'Áp dụng từ ngày giao',type:'date',initial:tomorrow()}]}/></>},
 {key:'audit',label:'Nhật ký',children:<DataTable path="/admin/audit-logs" rowKey="audit_log_id" columns={[[ 'actor_email','Người thực hiện'],['action_code','Hành động'],['entity_type','Đối tượng'],['entity_id','Mã nội bộ'],['occurred_at','Thời gian']]}/>},
 {key:'logins',label:'Đăng nhập',children:<DataTable path="/admin/login-history" rowKey="login_history_id" columns={[[ 'email','Email'],['success','Thành công'],['ip_address','Địa chỉ IP'],['occurred_at','Thời gian']]}/>},
 {key:'system',label:'Hệ thống',children:<SystemCheckPage/>},
 {key:'preview',label:'Xem trước vai trò',children:<Card><Space wrap>{Object.entries(roleNames).filter(([r])=>r!=='SYSTEM_ADMIN').map(([r,n])=><Button key={r} onClick={async()=>{try{await api('/admin/preview','POST',{role:r});setPreview(r)}catch(e){setError((e as Error).message)}}}>{n}</Button>)}</Space>{preview&&<Alert type="info" message={`Xem trước: ${roleNames[preview]}`} description="Đây là chế độ mô tả quyền, không có thao tác ghi và không giả danh tài khoản khác."/>}</Card>},
 ]}/></>
}
