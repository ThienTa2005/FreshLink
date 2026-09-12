import { useState } from 'react'
import { Alert, Button, Card, DatePicker, Empty, List, Space, Statistic, Tag } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api } from '../api/http'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { roleNames, entityUrl } from '../components/permissions'
import { useRows } from '../components/Workspace'
import { ActionForm, DataTable, type Row } from '../components/Workspace'

export function NotificationsPage(){
 const client=useQueryClient();const [unread,setUnread]=useState(false);const query=useQuery({queryKey:['notifications',unread],queryFn:()=>api<Row[]>(`/notifications?unreadOnly=${unread}&limit=100`),refetchInterval:30000})
 const mutate=async(path:string)=>{await api(path,'POST');await client.invalidateQueries({queryKey:['notifications']})}
 return <Card className="management-card" title="Trung tâm thông báo" extra={<Space><Button type={unread?'primary':'default'} onClick={()=>setUnread(!unread)}>Chưa đọc</Button><Button onClick={()=>void mutate('/notifications/read-all')}>Đánh dấu đã đọc</Button></Space>}>{query.error&&<Alert type="error" message={query.error.message}/>}<List loading={query.isPending} locale={{emptyText:<Empty description="Chưa có thông báo"/>}} dataSource={query.data??[]} renderItem={item=><List.Item className={item.read_at?'':'notification-unread'} actions={item.read_at?[]:[<Button key="read" type="link" onClick={()=>void mutate(`/notifications/${item.notification_id}/read`)}>Đã đọc</Button>]}><List.Item.Meta title={<Space><Link to={entityUrl(item.related_entity_type,item.related_entity_id)}>{String(item.title)}</Link>{!item.read_at&&<Tag color="green">Mới</Tag>}</Space>} description={<><p>{String(item.message)}</p><small>{String(item.created_at)}</small></>}/></List.Item>}/></Card>
}

export function MembersPage({organizationId}:{organizationId:number}){
 const {membership}=useAuth();const [selected,setSelected]=useState<Row>();const [link,setLink]=useState('');const [error,setError]=useState('');const client=useQueryClient()
 const prefix=membership?.organizationType==='RESTAURANT'?'RESTAURANT_':'SUPPLIER_';const roles=Object.entries(roleNames).filter(([r])=>r.startsWith(prefix)).map(([value,label])=>({value,label}))
 const invitations=useRows('/organizations/'+organizationId+'/invitations')
 const receive=(result:unknown)=>{const r=result as {token:string};setLink(window.location.origin+'/accept-invitation#token='+r.token)}
 async function revoke(id:unknown){try{await api('/organizations/'+organizationId+'/invitations/'+id,'DELETE');await invitations.refetch()}catch(e){setError((e as Error).message)}}
 return <>{error&&<Alert type="error" message={error}/>}<DataTable path={'/organizations/'+organizationId+'/members'} rowKey="member_id" columns={[[ 'full_name','Họ tên'],['email','Email'],['roles','Vai trò'],['status','Trạng thái']]} actions={r=><Button onClick={()=>setSelected(r)}>Quản lý quyền</Button>}/>
 {selected&&<><ActionForm key={String(selected.member_id)} title={'Quyền của '+selected.full_name} method="PUT" path={'/organizations/'+organizationId+'/members/'+selected.member_id+'/roles'} fields={[{name:'roles',label:'Vai trò',type:'multiple',options:roles,initial:String(selected.roles).split(',')}]} /><Button danger onClick={async()=>{if(!window.confirm('Vô hiệu hóa thành viên này?'))return;try{await api('/organizations/'+organizationId+'/members/'+selected.member_id,'DELETE');setSelected(undefined);await client.invalidateQueries()}catch(e){setError((e as Error).message)}}}>Vô hiệu hóa thành viên</Button></>}
 <ActionForm title="Mời thành viên" path={'/organizations/'+organizationId+'/invitations'} fields={[{name:'email',label:'Email'},{name:'roleCode',label:'Vai trò',type:'select',options:roles}]} onDone={receive}/>
 {link&&<Alert type="success" message="Đã tạo lời mời" description={<><p>Liên kết chỉ hiển thị lần này. Sao chép và gửi riêng cho người được mời; có hiệu lực 7 ngày.</p><a href={link}>{link}</a></>}/>}
 <List dataSource={invitations.data??[]} renderItem={r=><List.Item actions={r.status==='PENDING'?[<Button key="revoke" onClick={()=>void revoke(r.invitation_id)}>Thu hồi</Button>,<Button key="resend" onClick={async()=>{try{receive(await api('/organizations/'+organizationId+'/invitations','POST',{email:r.email,roleCode:r.role_code}));await invitations.refetch()}catch(e){setError((e as Error).message)}}}>Tạo lại liên kết</Button>]:[]}><List.Item.Meta title={String(r.email)} description={String(r.status)+' · '+String(r.expires_at)}/></List.Item>}/></>
}

export function AnalyticsPage(){
 const [range,setRange]=useState<[string,string]>([dayjs().subtract(29,'day').format('YYYY-MM-DD'),dayjs().format('YYYY-MM-DD')]);const query=useQuery({queryKey:['kpis',...range],queryFn:()=>api<Record<string,Row>>(`/analytics/kpis?from=${range[0]}&to=${range[1]}`)})
 const cards:[string,unknown][]=[['Tổng đơn',query.data?.orders?.total],['Đơn đã giao',query.data?.orders?.delivered],['Điểm giao thành công',query.data?.delivery?.delivered],['Tỷ lệ lô đạt (%)',query.data?.quality?.acceptance_rate],['Khiếu nại',query.data?.claims?.total],['Công nợ quá hạn',query.data?.receivables?.overdue]]
 return <><Card className="filter-card"><DatePicker.RangePicker value={[dayjs(range[0]),dayjs(range[1])]} onChange={v=>{if(v?.[0]&&v[1])setRange([v[0].format('YYYY-MM-DD'),v[1].format('YYYY-MM-DD')])}}/></Card>{query.error&&<Alert type="error" message={query.error.message}/>}<div className="stat-grid">{cards.map(([label,value])=><Card key={String(label)}><Statistic title={label} value={Number(value??0)} loading={query.isPending}/></Card>)}</div><div className="insight-grid"><Card title="Vận hành giao nhận"><p>Đúng giờ: {String(query.data?.delivery?.on_time??0)}</p><p>Thất bại: {String(query.data?.delivery?.failed??0)}</p></Card><Card title="Chất lượng & CSKH"><p>Lô đạt: {String(query.data?.quality?.passed??0)}</p><p>Thời gian xử lý trung bình: {String(query.data?.claims?.avg_resolution_hours??'—')} giờ</p></Card></div></>
}

export function InvoicesPage({restaurantId,accountant}:{restaurantId?:number;accountant:boolean}){
 const suffix=restaurantId?`?restaurantId=${restaurantId}`:''
 const [selectedInvoiceId,setSelectedInvoiceId]=useState<number|null>(null)
 const adjustmentsQuery=useQuery({queryKey:['adjustments',selectedInvoiceId],queryFn:()=>api<Row[]>(`/billing/invoices/${selectedInvoiceId}/adjustments`),enabled:selectedInvoiceId!=null})

 return <>{accountant&&<>
  <Card title="Quyết toán nhà cung cấp theo kỳ" style={{marginBottom:16}}>
   <ActionForm title="Tạo đợt quyết toán NCC theo kỳ" path="/billing/settlements/period" fields={[{name:'supplierId',label:'ID Nhà cung cấp',type:'number',min:1},{name:'startDate',label:'Từ ngày',type:'date'},{name:'endDate',label:'Đến ngày',type:'date'}]}/>
  </Card>
  <ActionForm title="Phát hành hóa đơn" path="/billing/invoices" fields={[{name:'orderId',label:'ID đơn hàng',type:'number',min:1},{name:'dueDate',label:'Hạn thanh toán',type:'date'},{name:'taxAmount',label:'Thuế',type:'number',min:0,initial:0},{name:'note',label:'Ghi chú',type:'textarea',required:false}]}/>
  <ActionForm title="Điều chỉnh công nợ (Credit / Debit Note)" path={v=>`/billing/invoices/${v.invoiceId}/adjust`} fields={[
   {name:'invoiceId',label:'ID Hóa đơn',type:'number',min:1},
   {name:'adjustmentType',label:'Loại điều chỉnh',type:'select',options:[{value:'CREDIT_NOTE',label:'Credit Note (Giảm nợ)'},{value:'DEBIT_NOTE',label:'Debit Note (Tăng nợ)'}]},
   {name:'amount',label:'Số tiền điều chỉnh (đ)',type:'number',min:1},
   {name:'reason',label:'Lý do (sai lệch, bồi thường, chiết khấu)',type:'textarea'}
  ]}/>
 </>}
 <DataTable path={`/billing/invoices${suffix}`} rowKey="invoice_id" columns={[[ 'invoice_id','ID'],[ 'invoice_code','Hóa đơn'],['order_id','Đơn hàng'],['issued_at','Ngày phát hành'],['due_date','Hạn thanh toán'],['total_amount','Tổng tiền'],['paid_amount','Đã trả'],['balance_amount','Còn lại'],['status','Trạng thái']]} actions={r=><Button size="small" onClick={()=>setSelectedInvoiceId(Number(r.invoice_id))}>Xem điều chỉnh</Button>}/>
 {selectedInvoiceId!=null&&<Card title={`Lịch sử Credit/Debit Notes — Hóa đơn #${selectedInvoiceId}`} style={{marginTop:16}} extra={<Button onClick={()=>setSelectedInvoiceId(null)}>Đóng</Button>}>
  {adjustmentsQuery.error&&<Alert type="error" message={adjustmentsQuery.error.message}/>}
  <List loading={adjustmentsQuery.isPending} dataSource={adjustmentsQuery.data??[]} renderItem={it=><List.Item><List.Item.Meta title={<Space><span>{String(it.adjustment_code)}</span><Tag color={it.adjustment_type==='CREDIT_NOTE'?'green':'blue'}>{String(it.adjustment_type)}</Tag><b>{String(it.amount)} đ</b></Space>} description={<p>{String(it.reason)} · <small>{String(it.created_at)}</small></p>}/></List.Item>}/>
  {adjustmentsQuery.data?.length===0&&<p>Hóa đơn chưa có điều chỉnh nào.</p>}
 </Card>}
 </>
}

export function SystemCheckPage(){
 const query=useQuery({queryKey:['system-check'],queryFn:()=>api<Record<string,Row>>('/admin/system-check'),refetchInterval:60_000})
 const services=[['Cơ sở dữ liệu','database'],['Kho tệp','media'],['Email','email'],['Bản đồ','maps']]
 return <>{query.error&&<Alert type="error" message={query.error.message}/>}<div className="stat-grid">{services.map(([label,key])=>{const status=String(query.data?.[key]?.status??'CHECKING');return <Card key={key}><Statistic title={label} value={status}/><Tag color={status==='UP'||status==='CONFIGURED'?'green':status.includes('ONLY')||status==='NOT_CONFIGURED'?'gold':'blue'}>{status}</Tag></Card>})}</div><Alert type="info" showIcon message="Các tích hợp không cấu hình sẽ dùng chế độ fallback an toàn; backend vẫn khởi động và phục vụ nghiệp vụ cốt lõi."/></>
}
