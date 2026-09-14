import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, InputNumber, Select, Space, Table, Tabs, Switch, Tag, Spin, Tooltip } from 'antd'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { can, display } from '../components/permissions'
import { useUrlTab } from '../components/useUrlTab'
import { ActionForm, DataTable, options, tomorrow, useRows, type Row } from '../components/Workspace'
import { WeeklyEditor } from './WeeklyEditor'
import { ProductImage } from '../components/ProductImage'
import { CoopTrustScoreModal } from '../components/CoopTrustScoreModal'
import { GreenCertificateModal, type GreenCertificateData, type EsgSummaryData } from '../components/GreenCertificateModal'
import { SmartOcrModal } from '../components/SmartOcrModal'

export default function RestaurantPage({organizationId,initialTab='orders'}:{organizationId:number;initialTab?:string}){
 const {membership}=useAuth();const purchaser=can(membership,'RESTAURANT_MANAGER','RESTAURANT_PURCHASER');const manager=can(membership,'RESTAURANT_MANAGER');const receiver=can(membership,'RESTAURANT_MANAGER','RESTAURANT_RECEIVER')
 const [tab,setTab]=useUrlTab(initialTab);const [params]=useSearchParams();const navigate=useNavigate();const client=useQueryClient()
 const [date,setDate]=useState(tomorrow());const [cart,setCart]=useState<Record<string,number>>({});const [oldPrices,setOldPrices]=useState<Record<string,number>>({})
 const [address,setAddress]=useState<number>();const [startTime,setStart]=useState('07:00');const [endTime,setEnd]=useState('09:00');const [search,setSearch]=useState('');const [category,setCategory]=useState<number>();const [favorites,setFavorites]=useState<number[]>([]);const [onlyFavorites,setOnlyFavorites]=useState(false)
 const [weeklyPlanId,setPlan]=useState<number>();const [editId,setEdit]=useState<number>();const [name,setName]=useState('Đơn thường mua');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [request,setRequest]=useState({hash:'',key:crypto.randomUUID()})
 const [trustModalOpen, setTrustModalOpen] = useState(false); const [selectedSupplierId, setSelectedSupplierId] = useState<number>(); const [selectedSupplierName, setSelectedSupplierName] = useState<string>()
 const [certModalOpen, setCertModalOpen] = useState(false); const [certData, setCertData] = useState<GreenCertificateData | null>(null); const [esgPeriod, setEsgPeriod] = useState<string>('60_DAYS'); const [esgLoading, setEsgLoading] = useState(false); const [esgSummary, setEsgSummary] = useState<EsgSummaryData | null>(null)
 const [ocrModalOpen, setOcrModalOpen] = useState(false); const [gradeFilter, setGradeFilter] = useState<'ALL' | 'GRADE_A' | 'GRADE_B_RESCUE'>('ALL')
 const catalog=useRows('/public/catalog?date='+date,purchaser);const addresses=useRows('/addresses?organizationId='+organizationId);const orders=useRows('/orders?restaurantId='+organizationId)
 const saved=useRows('/restaurants/'+organizationId+'/saved-orders',purchaser);const policy=useQuery({queryKey:['policy',organizationId],queryFn:()=>api<Row>('/restaurants/'+organizationId+'/policy')})
 const windowQuery=useQuery({queryKey:['order-window'],queryFn:()=>api<{earliestDate:string;cutoff:string}>('/public/order-window')})
 const earliest=windowQuery.data?.earliestDate??tomorrow();const actualAddress=address??(Number(addresses.data?.find(a=>a.address_type==='DELIVERY')?.address_id)||undefined)
 const chosen=Object.entries(cart).filter(([,q])=>q>0)
 const invalid=chosen.filter(([id,q])=>{const s=catalog.data?.find(x=>String(x.sku_id)===id);return !s||s.price==null||q<Number(s.minimum_order_quantity)||Math.abs((q-Number(s.minimum_order_quantity))/Number(s.quantity_step)-Math.round((q-Number(s.minimum_order_quantity))/Number(s.quantity_step)))>0.00001})
 const total=chosen.reduce((sum,[id,q])=>sum+q*Number(catalog.data?.find(s=>String(s.sku_id)===id)?.price??0),0)
 const [restored,setRestored]=useState(false)
 useEffect(()=>{if(!saved.data||restored)return;setRestored(true);const draft=saved.data.find(x=>x.kind==='CART');if(draft){const p=draft.payload as Row;setCart(p.cart as Record<string,number>??{});setAddress(p.address as number);setStart(String(p.startTime??'07:00'));setEnd(String(p.endTime??'09:00'))}const fav=saved.data.find(x=>x.kind==='FAVORITES');if(fav)setFavorites((fav.payload as Row).ids as number[]??[])},[saved.data,restored])
 useEffect(()=>{if(initialTab) setTab(initialTab)},[initialTab, setTab])
 useEffect(()=>{
  if(tab!=='greenCert') return
  setEsgLoading(true)
  api<EsgSummaryData>(`/esg/summary?organizationId=${organizationId}&periodType=${esgPeriod}`)
    .then(data=>setEsgSummary(data))
    .catch(e=>setError((e as Error).message))
    .finally(()=>setEsgLoading(false))
 },[tab,organizationId,esgPeriod])
 async function openCertificate(){
  setBusy(true);setError('')
  try{
   const res=await api<GreenCertificateData>('/esg/issue','POST',{organizationId,periodType:esgPeriod})
   setCertData(res);setCertModalOpen(true)
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function save(kind:string){setBusy(true);setError('');try{await api('/restaurants/'+organizationId+'/saved-orders','POST',{name:kind==='CART'?'Giỏ hiện tại':kind==='FAVORITES'?'Yêu thích':name,kind,payload:{cart,address:actualAddress,startTime,endTime,ids:favorites,prices:Object.fromEntries((catalog.data??[]).map(s=>[s.sku_id,s.price]))}});await saved.refetch();window.dispatchEvent(new Event('freshlink:saved'))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function loadOrder(id:number,edit=false){setError('');try{const o=await api<Row>('/orders/'+id);setCart(Object.fromEntries((o.items as Row[]).map(i=>[String(i.sku_id),Number(i.requested_quantity)])));setOldPrices(Object.fromEntries((o.items as Row[]).map(i=>[String(i.sku_id),Number(i.unit_price)])));setAddress(Number(o.delivery_address_id));setStart(String(o.receiving_start_time));setEnd(String(o.receiving_end_time));setDate(edit?String(o.delivery_date):earliest);setEdit(edit?id:undefined);setPlan(undefined);setTab('order')}catch(e){setError((e as Error).message)}}
 async function submit(draft:boolean){setBusy(true);setError('');const body={restaurantId:organizationId,addressId:actualAddress,date,startTime,endTime,weeklyPlanId,items:chosen.map(([id,quantity])=>({skuId:Number(id),quantity})),draft};const hash=JSON.stringify(body);const key=request.hash===hash?request.key:crypto.randomUUID();setRequest({hash,key});try{const id=editId??await api<number>('/orders','POST',body,key);if(editId)await api('/orders/'+id,'PUT',body);await client.invalidateQueries();window.dispatchEvent(new Event('freshlink:saved'));navigate('/portal/orders/'+id)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const handleOcrAddToCart = (items: { skuId: number; quantity: number }[]) => {
   setCart(prev => {
     const next = { ...prev }
     for (const item of items) {
       next[String(item.skuId)] = (next[String(item.skuId)] ?? 0) + item.quantity
     }
     return next
   })
 }
 const allowedTabs=purchaser?['order','orders','weekly','templates','greenCert',...(manager?['profile','policy','billing']:[]),...(receiver?['claims','assets']:[])]:['orders','greenCert','claims','assets']
 return <>{error&&<Alert type="error" message={error} showIcon/>}<Tabs activeKey={allowedTabs.includes(tab)?tab:'orders'} onChange={setTab} items={[
 ...(purchaser?[{key:'order',label:editId?'Sửa đơn':'Đặt hàng',children:<Card title={editId?'Chỉnh sửa đơn trước khi giữ nguồn':'Chọn hàng và ngày nhận'}><Space wrap><Input type="date" min={earliest} value={date} onChange={e=>setDate(e.target.value)}/><Input placeholder="Tìm sản phẩm" value={search} onChange={e=>setSearch(e.target.value)}/><Select allowClear placeholder="Nhóm hàng" value={category} onChange={setCategory} style={{minWidth:150}} options={Array.from(new Map((catalog.data??[]).map(x=>[x.category_id,{value:Number(x.category_id),label:String(x.category_name)}])).values())}/><Select value={gradeFilter} onChange={setGradeFilter} style={{minWidth:210}} options={[{value:'ALL',label:'🥦 Tất cả phân loại'},{value:'GRADE_A',label:'⭐ Chuẩn Loại 1 (Đẹp)'},{value:'GRADE_B_RESCUE',label:'🥕 Xấu mã / Săn giá rẻ (-30% đến -40%)'}]}/><Button type="primary" onClick={()=>setOcrModalOpen(true)} style={{background:'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>📸 AI Nhận diện Ghi chú / Hóa đơn</Button><Switch checked={onlyFavorites} onChange={setOnlyFavorites}/>Chỉ hàng thường mua</Space><p>Chốt lúc {windowQuery.data?.cutoff??'17:00'} ngày trước giao. Giá giữ trên đơn khi xác nhận; nguồn còn cần điều phối.</p>{catalog.error&&<Alert type="error" message={catalog.error.message}/>}
 <Table<Row> rowKey="sku_id" dataSource={catalog.data?.filter(s=>(!category||s.category_id===category)&&(gradeFilter==='ALL'||s.grade_type===gradeFilter)&&String(s.sku_name).toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))&&(!onlyFavorites||favorites.includes(Number(s.sku_id))))} loading={catalog.isPending} pagination={{pageSize:20}} scroll={{x:750}} columns={[
 {title:'Thường mua',width:80,render:(_,s)=><Button onClick={()=>setFavorites(f=>f.includes(Number(s.sku_id))?f.filter(id=>id!==Number(s.sku_id)):[...f,Number(s.sku_id)])}>{favorites.includes(Number(s.sku_id))?'★':'☆'}</Button>},
 {title:'Ảnh',width:70,render:(_,s)=><ProductImage src={s.image_url as string|null} alt={String(s.sku_name)} size={48}/>},
 {title:'Sản phẩm / quy cách',render:(_,s)=><>
   <div style={{fontWeight:600}}>{String(s.sku_name)}</div>
   <small style={{display:'block',color:'#64748b'}}>{String(s.pack_description)} · {String(s.base_unit)} · Tối thiểu {String(s.minimum_order_quantity)} · Bước {String(s.quantity_step)}</small>
   {s.grade_type==='GRADE_B_RESCUE' && (
     <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4,flexWrap:'wrap'}}>
       <Tooltip title={String(s.rescue_reason||'Nông sản ngoại hình bất đối xứng nhưng chất lượng tươi ngon 100%, giảm giá sốc')}>
         <Tag color="orange" style={{fontWeight:700,borderRadius:6,cursor:'pointer',margin:0}}>
           🥕 Xấu mã -{Number(s.discount_percent??30)}%
         </Tag>
       </Tooltip>
       <Tag color="cyan" style={{margin:0,fontSize:11}}>🌱 Tiết kiệm lãng phí</Tag>
     </div>
   )}
   {(s.supplier_name || s.supplier_score) && (
     <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4,flexWrap:'wrap'}}>
       <Tag
         color={s.tier_rank==='DIAMOND_AAA'?'#0284c7':s.tier_rank==='GOLD_AA'?'#d97706':s.tier_rank==='SILVER_A'?'#64748b':'#475569'}
         style={{cursor:'pointer',fontWeight:700,borderRadius:6,margin:0,fontSize:11.5}}
         onClick={()=>{
           setSelectedSupplierId(Number(s.supplier_id)||1);
           setSelectedSupplierName(String(s.supplier_name??'Hợp tác xã đối tác FreshLink'));
           setTrustModalOpen(true);
         }}
       >
         ⭐ {Number(s.supplier_score ?? 92.5).toFixed(1)} {s.tier_rank==='DIAMOND_AAA'?'💎 Kim Cương':s.tier_rank==='GOLD_AA'?'Vàng':s.tier_rank==='SILVER_A'?'Bạc':'Tiêu chuẩn'}
       </Tag>
       {Boolean(s.supplier_name) && <span style={{fontSize:12,color:'#334155',fontWeight:500}}>{String(s.supplier_name)}</span>}
       {Boolean(s.has_vietgap) && <Tag color="green" style={{margin:0,fontSize:11}}>✓ VietGAP</Tag>}
     </div>
   )}
 </>},
 {title:'Giá',render:(_,s)=><>{s.price==null?'Chưa có giá':display(s.price,'price')}{s.grade_type==='GRADE_B_RESCUE'&&<small style={{display:'block',color:'#ea580c',fontWeight:600}}>Đã giảm -{Number(s.discount_percent??30)}%</small>}{oldPrices[String(s.sku_id)]!=null&&oldPrices[String(s.sku_id)]!==Number(s.price)&&<small style={{display:'block',color:'#ad6800'}}>Giá cũ: {display(oldPrices[String(s.sku_id)],'price')}</small>}</>},
 {title:'Số lượng',render:(_,s)=><InputNumber min={0} step={Number(s.quantity_step)} disabled={s.price==null} value={cart[String(s.sku_id)]??0} onChange={v=>setCart({...cart,[String(s.sku_id)]:v??0})}/>}]}/>
 {invalid.length>0&&<Alert type="warning" message="Có hàng ngừng bán, chưa có giá hoặc sai quy cách. Điều chỉnh trước khi lưu." description={invalid.map(([id,q])=><p key={id}>{String(catalog.data?.find(s=>String(s.sku_id)===id)?.sku_name??'Hàng không còn khả dụng')} · {q} <Button onClick={()=>setCart({...cart,[id]:0})}>Bỏ khỏi giỏ</Button></p>)}/>}
 <Space wrap><Select placeholder="Địa chỉ nhận" style={{minWidth:220}} value={actualAddress} options={options(addresses.data?.filter(a=>a.address_type==='DELIVERY'),'address_id','address_name')} onChange={v=>setAddress(Number(v))}/><Input type="time" value={startTime} onChange={e=>setStart(e.target.value)}/><Input type="time" value={endTime} onChange={e=>setEnd(e.target.value)}/></Space>{!actualAddress&&<Alert type="info" message={manager?'Thêm địa chỉ tại mục Địa chỉ để đặt đơn.':'Nhờ quản lý thêm địa chỉ giao hàng trước khi đặt.'}/>}
 <h3>Tổng tiền: {display(total,'amount')}</h3><Space wrap><Button loading={busy} onClick={()=>void save('CART')}>Lưu giỏ nháp</Button><Button onClick={()=>void save('FAVORITES')}>Lưu hàng thường mua</Button><Button disabled={!actualAddress||!chosen.length||!!invalid.length||date<earliest||endTime<=startTime} loading={busy} onClick={()=>void submit(true)}>{editId?'Lưu thay đổi':'Tạo đơn nháp'}</Button>{!editId&&<Button type="primary" loading={busy} disabled={!actualAddress||!chosen.length||!!invalid.length||date<earliest||endTime<=startTime} onClick={()=>void submit(false)}>{!manager&&policy.data?.approval_required?'Gửi quản lý duyệt':'Xác nhận đặt hàng'}</Button>}</Space></Card>},
 {key:'templates',label:'Mẫu đơn',children:<Card><Space><Input value={name} onChange={e=>setName(e.target.value)} maxLength={150}/><Button disabled={!name.trim()||!chosen.length} onClick={()=>void save('TEMPLATE')}>Lưu giỏ thành mẫu</Button></Space>{saved.data?.filter(x=>x.kind==='TEMPLATE').map(x=><p key={String(x.saved_order_id)}>{String(x.name)} <Button onClick={()=>{const p=x.payload as Row;setCart(p.cart as Record<string,number>);setOldPrices(p.prices as Record<string,number>??{});setEdit(undefined);setPlan(undefined);setDate(earliest);setTab('order')}}>Đưa vào giỏ</Button></p>)}</Card>},
 {key:'weekly',label:'Kế hoạch tuần',children:<WeeklyEditor organizationId={organizationId} catalog={catalog.data??[]} onPrepare={(d,p,lines)=>{setDate(d);setPlan(p);setCart(Object.fromEntries(lines.map(i=>[String(i.sku_id),Number(i.planned_quantity)])));setEdit(undefined);setTab('order')}}/>}]:[]),
 {key:'orders',label:'Đơn hàng',children:<><Select allowClear placeholder="Trạng thái" value={params.get('status')??undefined} options={['DRAFT','SUBMITTED','CONFIRMED','SOURCING','OUT_FOR_DELIVERY','DELIVERED'].map(value=>({value,label:display(value)}))} onChange={value=>navigate('/portal/orders'+(value?'?status='+value:''))}/><Table<Row> rowKey="order_id" loading={orders.isPending} dataSource={orders.data?.filter(o=>!params.get('status')||o.order_status===params.get('status'))} scroll={{x:600}} columns={[{title:'Mã đơn',dataIndex:'order_code',render:(v,r)=><Link to={'/portal/orders/'+r.order_id}>{String(v)}</Link>},{title:'Ngày giao',dataIndex:'delivery_date',render:v=>display(v,'date')},{title:'Trạng thái',dataIndex:'order_status',render:v=>display(v)},{title:'Tổng tiền',dataIndex:'total_amount',render:v=>display(v,'amount')},{title:'Thao tác',render:(_,r)=><Space>{purchaser&&<Button onClick={()=>void loadOrder(Number(r.order_id))}>Đặt lại</Button>}{purchaser&&['DRAFT','CONFIRMED'].includes(String(r.order_status))&&<Button onClick={()=>void loadOrder(Number(r.order_id),true)}>Sửa</Button>}</Space>}]}/>{orders.error&&<Alert type="error" message={orders.error.message}/>}</>},
 {key:'greenCert',label:'🌿 Chứng Nhận Xanh & ESG',children:<Card title={
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <span className="material-symbols-outlined" style={{color:'#059669',fontSize:26}}>eco</span>
      <span style={{color:'#065f46',fontWeight:700}}>Chương Trình Đối Tác Bền Vững FreshLink ESG</span>
    </div>
    <Space>
      <Select value={esgPeriod} onChange={setEsgPeriod} options={[
        {value:'60_DAYS',label:'2 tháng qua (60 ngày)'},
        {value:'30_DAYS',label:'30 ngày gần nhất'},
        {value:'ALL_TIME',label:'Lũy kế toàn thời gian'}
      ]} style={{width:200}}/>
      <Button type="primary" loading={busy} onClick={()=>void openCertificate()} style={{background:'#176b45',fontWeight:600}}>
        📜 Xem & In Giấy Chứng Nhận Xanh
      </Button>
    </Space>
  </div>
 }>
  {esgLoading ? <div style={{textAlign:'center',padding:40}}><Spin size="large"/></div> : esgSummary && (
    <>
      <div style={{background:'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',border:'1.5px solid #a7f3d0',borderRadius:14,padding:'20px 24px',marginBottom:20}}>
        <div style={{fontSize:16,color:'#064e3b',lineHeight:1.8,fontWeight:500}}>
          🌱 <strong>Thành Tích Môi Trường Được Xác Thực:</strong>
          <p style={{margin:'6px 0 0',fontSize:15}}>{esgSummary.impactStatement}</p>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:14,marginBottom:20}}>
        <div style={{background:'#ffffff',border:'1px solid #bbf7d0',borderRadius:12,padding:16,textAlign:'center'}}>
          <div style={{fontSize:28}}>🌿</div>
          <div style={{fontSize:24,fontWeight:800,color:'#059669',margin:'4px 0'}}>{esgSummary.plasticSavedKg} kg</div>
          <div style={{fontSize:12.5,color:'#475569',fontWeight:600}}>Rác thải nhựa cắt giảm</div>
          <small style={{color:'#64748b',display:'block',marginTop:4}}>Nhờ dùng sọt luân chuyển SmartCrate</small>
        </div>
        <div style={{background:'#ffffff',border:'1px solid #bbf7d0',borderRadius:12,padding:16,textAlign:'center'}}>
          <div style={{fontSize:28}}>💨</div>
          <div style={{fontSize:24,fontWeight:800,color:'#059669',margin:'4px 0'}}>{esgSummary.co2SavedKg} kg</div>
          <div style={{fontSize:12.5,color:'#475569',fontWeight:600}}>Khí thải CO2e tránh được</div>
          <small style={{color:'#64748b',display:'block',marginTop:4}}>Giảm thiêu hủy nhựa & tối ưu xe</small>
        </div>
        <div style={{background:'#ffffff',border:'1px solid #bbf7d0',borderRadius:12,padding:16,textAlign:'center'}}>
          <div style={{fontSize:28}}>🔄</div>
          <div style={{fontSize:24,fontWeight:800,color:'#059669',margin:'4px 0'}}>{esgSummary.cratesCirculated}</div>
          <div style={{fontSize:12.5,color:'#475569',fontWeight:600}}>Lượt sọt SmartCrate luân chuyển</div>
          <small style={{color:'#64748b',display:'block',marginTop:4}}>Quy trình logistics ngược thu hồi</small>
        </div>
        <div style={{background:'#ffffff',border:'1px solid #bbf7d0',borderRadius:12,padding:16,textAlign:'center'}}>
          <div style={{fontSize:28}}>🚚</div>
          <div style={{fontSize:24,fontWeight:800,color:'#059669',margin:'4px 0'}}>{esgSummary.kmOptimized} km</div>
          <div style={{fontSize:12.5,color:'#475569',fontWeight:600}}>Quãng đường AI ghép chuyến</div>
          <small style={{color:'#64748b',display:'block',marginTop:4}}>Giảm số chuyến xe rỗng chạy đường phố</small>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,padding:'12px 16px',background:'#f8fafc',borderRadius:10}}>
        <div style={{fontSize:13,color:'#475569'}}>
          💡 <em>Giấy Chứng Nhận Xanh có tích hợp mã QR công khai để Nhà hàng in đóng khung trưng bày tại quầy thu ngân hoặc đăng tải lên mạng xã hội.</em>
        </div>
        <Button type="primary" onClick={()=>void openCertificate()} style={{background:'#176b45'}}>
          Xem Giấy Chứng Nhận Chi Tiết
        </Button>
      </div>
    </>
  )}
 </Card>},
 ...(manager?[{key:'profile',label:'Địa chỉ',children:<><DataTable path={'/addresses?organizationId='+organizationId} rowKey="address_id" columns={[[ 'address_name','Tên cơ sở'],['address_line','Địa chỉ cụ thể'],['district','Quận/huyện'],['city','Tỉnh/thành phố']]}/><ActionForm title="Thêm địa chỉ giao hàng cụ thể" path="/addresses" fields={[{name:'name',label:'Tên cơ sở / Chi nhánh (VD: Bếp Cầu Giấy)'},{name:'address',label:'Số nhà, tên đường cụ thể'},{name:'ward',label:'Phường / Xã'},{name:'district',label:'Quận / Huyện'},{name:'city',label:'Tỉnh / Thành phố',initial:'Hà Nội'},{name:'contactName',label:'Người đại diện nhận hàng'},{name:'phone',label:'Số điện thoại người nhận'}]} transform={v=>({...v,organizationId,type:'DELIVERY'})}/></>},
 {key:'policy',label:'Chính sách',children:<ActionForm key={String(policy.data?.approval_required)} title="Chính sách duyệt đơn" method="PUT" path={'/restaurants/'+organizationId+'/policy'} fields={[{name:'approvalRequired',label:'Đơn thu mua cần duyệt',type:'select',initial:policy.data?.approval_required?'yes':'no',options:[{value:'yes',label:'Cần quản lý duyệt'},{value:'no',label:'Thu mua được xác nhận trực tiếp'}]}]} transform={v=>({approvalRequired:v.approvalRequired==='yes'})}/>}]:[]),
 ...(receiver?[{key:'claims',label:'Khiếu nại',children:<><Alert type="info" message="Mở chi tiết đơn để báo thiếu/hỏng theo đúng sản phẩm và lô."/><DataTable path={'/claims?restaurantId='+organizationId} rowKey="complaint_id" columns={[[ 'complaint_code','Mã'],['description','Nội dung'],['status','Trạng thái']]} actions={r=><Link to={'/portal/claims/'+r.complaint_id}>Chi tiết</Link>}/></>},{key:'assets',label:'Thùng đang giữ',children:<DataTable path={'/assets?restaurantId='+organizationId} rowKey="asset_id" columns={[[ 'asset_code','Mã thùng'],['status','Trạng thái'],['condition_status','Tình trạng']]}/>}]:[])
  ]}/>
  <CoopTrustScoreModal supplierId={selectedSupplierId} supplierName={selectedSupplierName} open={trustModalOpen} onClose={()=>setTrustModalOpen(false)} />
  <GreenCertificateModal open={certModalOpen} onClose={()=>setCertModalOpen(false)} data={certData} />
  <SmartOcrModal open={ocrModalOpen} onClose={()=>setOcrModalOpen(false)} onAddToCart={handleOcrAddToCart} currentDate={date} />
  </>
}
