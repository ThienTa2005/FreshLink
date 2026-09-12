import { useState } from 'react'
import { Alert, Button, Card, DatePicker, Empty, List, Space, Statistic, Tag } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api } from '../api/http'
import { ActionForm, DataTable, type Row } from '../components/Workspace'

export function NotificationsPage(){
 const client=useQueryClient();const [unread,setUnread]=useState(false);const query=useQuery({queryKey:['notifications',unread],queryFn:()=>api<Row[]>(`/notifications?unreadOnly=${unread}&limit=100`)})
 const mutate=async(path:string)=>{await api(path,'POST');await client.invalidateQueries({queryKey:['notifications']})}
 return <Card className="management-card" title="Trung tâm thông báo" extra={<Space><Button type={unread?'primary':'default'} onClick={()=>setUnread(!unread)}>Chưa đọc</Button><Button onClick={()=>void mutate('/notifications/read-all')}>Đánh dấu đã đọc</Button></Space>}>{query.error&&<Alert type="error" message={query.error.message}/>}<List loading={query.isPending} locale={{emptyText:<Empty description="Chưa có thông báo"/>}} dataSource={query.data??[]} renderItem={item=><List.Item className={item.read_at?'':'notification-unread'} actions={item.read_at?[]:[<Button key="read" type="link" onClick={()=>void mutate(`/notifications/${item.notification_id}/read`)}>Đã đọc</Button>]}><List.Item.Meta title={<Space><span>{String(item.title)}</span>{!item.read_at&&<Tag color="green">Mới</Tag>}</Space>} description={<><p>{String(item.message)}</p><small>{String(item.created_at)}</small></>}/></List.Item>}/></Card>
}

export function MembersPage({organizationId}:{organizationId:number}){
 return <div className="management-grid"><DataTable path={`/organizations/${organizationId}/members`} rowKey="member_id" columns={[[ 'full_name','Họ tên'],['email','Email'],['phone','Điện thoại'],['roles','Vai trò'],['status','Trạng thái'],['joined_at','Ngày tham gia']]}/><ActionForm title="Mời thành viên" path={`/organizations/${organizationId}/invitations`} fields={[{name:'email',label:'Email',type:'text'},{name:'roleCode',label:'Vai trò',type:'select',options:[{value:'RESTAURANT_MANAGER',label:'Quản lý nhà hàng'},{value:'RESTAURANT_PURCHASER',label:'Thu mua'},{value:'RESTAURANT_RECEIVER',label:'Nhận hàng'},{value:'SUPPLIER_MANAGER',label:'Quản lý nhà cung cấp'},{value:'SUPPLIER_STAFF',label:'Nhân viên nhà cung cấp'}]}]}/></div>
}

export function AnalyticsPage(){
 const [range,setRange]=useState<[string,string]>([dayjs().subtract(29,'day').format('YYYY-MM-DD'),dayjs().format('YYYY-MM-DD')]);const query=useQuery({queryKey:['kpis',...range],queryFn:()=>api<Record<string,Row>>(`/analytics/kpis?from=${range[0]}&to=${range[1]}`)})
 const cards:[string,unknown][]=[['Tổng đơn',query.data?.orders?.total],['Đơn đã giao',query.data?.orders?.delivered],['Điểm giao thành công',query.data?.delivery?.delivered],['Tỷ lệ lô đạt (%)',query.data?.quality?.acceptance_rate],['Khiếu nại',query.data?.claims?.total],['Công nợ quá hạn',query.data?.receivables?.overdue]]
 return <><Card className="filter-card"><DatePicker.RangePicker value={[dayjs(range[0]),dayjs(range[1])]} onChange={v=>{if(v?.[0]&&v[1])setRange([v[0].format('YYYY-MM-DD'),v[1].format('YYYY-MM-DD')])}}/></Card>{query.error&&<Alert type="error" message={query.error.message}/>}<div className="stat-grid">{cards.map(([label,value])=><Card key={String(label)}><Statistic title={label} value={Number(value??0)} loading={query.isPending}/></Card>)}</div><div className="insight-grid"><Card title="Vận hành giao nhận"><p>Đúng giờ: {String(query.data?.delivery?.on_time??0)}</p><p>Thất bại: {String(query.data?.delivery?.failed??0)}</p></Card><Card title="Chất lượng & CSKH"><p>Lô đạt: {String(query.data?.quality?.passed??0)}</p><p>Thời gian xử lý trung bình: {String(query.data?.claims?.avg_resolution_hours??'—')} giờ</p></Card></div></>
}

export function InvoicesPage({restaurantId,accountant}:{restaurantId?:number;accountant:boolean}){
 const suffix=restaurantId?`?restaurantId=${restaurantId}`:''
 return <>{accountant&&<ActionForm title="Phát hành hóa đơn" path="/billing/invoices" fields={[{name:'orderId',label:'ID đơn hàng',type:'number',min:1},{name:'dueDate',label:'Hạn thanh toán',type:'date'},{name:'taxAmount',label:'Thuế',type:'number',min:0,initial:0},{name:'note',label:'Ghi chú',type:'textarea',required:false}]}/>}<DataTable path={`/billing/invoices${suffix}`} rowKey="invoice_id" columns={[[ 'invoice_code','Hóa đơn'],['order_id','Đơn hàng'],['issued_at','Ngày phát hành'],['due_date','Hạn thanh toán'],['total_amount','Tổng tiền'],['paid_amount','Đã trả'],['balance_amount','Còn lại'],['status','Trạng thái']]}/></>
}

export function SystemCheckPage(){
 const query=useQuery({queryKey:['system-check'],queryFn:()=>api<Record<string,Row>>('/admin/system-check'),refetchInterval:60_000})
 const services=[['Cơ sở dữ liệu','database'],['Kho tệp','media'],['Email','email'],['Bản đồ','maps']]
 return <>{query.error&&<Alert type="error" message={query.error.message}/>}<div className="stat-grid">{services.map(([label,key])=>{const status=String(query.data?.[key]?.status??'CHECKING');return <Card key={key}><Statistic title={label} value={status}/><Tag color={status==='UP'||status==='CONFIGURED'?'green':status.includes('ONLY')||status==='NOT_CONFIGURED'?'gold':'blue'}>{status}</Tag></Card>})}</div><Alert type="info" showIcon message="Các tích hợp không cấu hình sẽ dùng chế độ fallback an toàn; backend vẫn khởi động và phục vụ nghiệp vụ cốt lõi."/></>
}
