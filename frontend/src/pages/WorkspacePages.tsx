import { useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Input, List, Space, Statistic, Table, Tabs, Timeline } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/http'
import { ActionForm, DataTable, EvidenceLink, QrButton, type Row, useRows } from '../components/Workspace'
import { can, display, roleNames } from '../components/permissions'
import { useUrlTab } from '../components/useUrlTab'
import { OrderDetail } from './TripPage'
import TripPage from './TripPage'
import OperationsPage from './OperationsPage'
import { SystemCheckPage } from './ManagementPages'

export function DashboardPage(){
 const q=useRows('/workspace/tasks');const {membership}=useAuth()
 return <><p>Công việc theo đơn vị và quyền đang chọn. Mở từng mục để xử lý.</p>{can(membership,'RESTAURANT_MANAGER','RESTAURANT_PURCHASER')&&membership?.organizationType==='RESTAURANT'&&<Link className="button button-small" to="/portal/orders/new">Đặt hàng mới</Link>}{q.error&&<Alert type="error" message={q.error.message} action={<Button onClick={()=>void q.refetch()}>Thử lại</Button>}/>}<div className="stat-grid">{q.data?.map(x=><Card key={String(x.title)} loading={q.isPending}><Statistic title={String(x.title)} value={Number(x.count)}/><Link to={String(x.url)}>Mở công việc →</Link></Card>)}</div>{q.data?.length===0&&<Empty description="Chưa có công việc đang chờ"/>}</>
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
 {key:'staff',label:'Nhân viên & quyền',children:<><DataTable path="/admin/staff" rowKey="user_id" columns={[[ 'full_name','Họ tên'],['email','Email'],['roles','Quyền'],['status','Trạng thái']]} actions={r=><Button onClick={()=>setSelected(r)}>Sửa</Button>}/>{selected?.user_id!=null&&<ActionForm key={String(selected.user_id)} title="Cập nhật nhân viên" method="PUT" path={`/admin/staff/${selected.user_id}`} fields={[{name:'fullName',label:'Họ tên',initial:selected.full_name},{name:'status',label:'Trạng thái',type:'select',initial:selected.status,options:[{value:'ACTIVE',label:'Hoạt động'},{value:'DISABLED',label:'Khóa'}]},{name:'roles',label:'Quyền',type:'multiple',initial:selected.roles,options:Object.entries(roleNames).filter(([r])=>['OPERATIONS_COORDINATOR','QUALITY_INSPECTOR','ACCOUNTANT','CUSTOMER_SUPPORT','DRIVER'].includes(r)).map(([value,label])=>({value,label}))}]}/>}<OperationsPage initialTab="partners"/></>},
 {key:'catalog',label:'Danh mục & giá',children:<OperationsPage initialTab="prices"/>},
 {key:'audit',label:'Nhật ký',children:<DataTable path="/admin/audit-logs" rowKey="audit_log_id" columns={[[ 'actor_email','Người thực hiện'],['action_code','Hành động'],['entity_type','Đối tượng'],['entity_id','Mã nội bộ'],['occurred_at','Thời gian']]}/>},
 {key:'logins',label:'Đăng nhập',children:<DataTable path="/admin/login-history" rowKey="login_history_id" columns={[[ 'email','Email'],['success','Thành công'],['ip_address','Địa chỉ IP'],['occurred_at','Thời gian']]}/>},
 {key:'system',label:'Hệ thống',children:<SystemCheckPage/>},
 {key:'preview',label:'Xem trước vai trò',children:<Card><Space wrap>{Object.entries(roleNames).filter(([r])=>r!=='SYSTEM_ADMIN').map(([r,n])=><Button key={r} onClick={async()=>{try{await api('/admin/preview','POST',{role:r});setPreview(r)}catch(e){setError((e as Error).message)}}}>{n}</Button>)}</Space>{preview&&<Alert type="info" message={`Xem trước: ${roleNames[preview]}`} description="Đây là chế độ mô tả quyền, không có thao tác ghi và không giả danh tài khoản khác."/>}</Card>},
 ]}/></>
}
