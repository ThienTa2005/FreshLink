import { useState } from 'react'
import { Alert, Button, Card, Space, Tabs } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { can } from '../components/permissions'
import { useUrlTab } from '../components/useUrlTab'
import { ActionForm, DataTable, EvidenceLink, tomorrow, useRows, type Row } from '../components/Workspace'
import { OffersEditor } from './OffersEditor'
import { SupplierProductsEditor } from './SupplierProductsEditor'
import { FreshLinkMap } from '../components/FreshLinkMap'

export default function SupplierPage({organizationId,initialTab='products'}:{organizationId:number;initialTab?:string}){
 const {membership}=useAuth();const manager=can(membership,'SUPPLIER_MANAGER');const [tab,setTab]=useUrlTab(initialTab);const [selected,setSelected]=useState<Row>();const navigate=useNavigate()
 const catalog=useRows('/public/catalog?date='+tomorrow());const requests=useRows('/supplier/requests?supplierId='+organizationId)
 return <Tabs activeKey={tab==='billing'&&!manager?'products':tab} onChange={setTab} items={[
 {key:'products',label:'Sản phẩm HTX',children:<SupplierProductsEditor organizationId={organizationId}/>},
 {key:'requests',label:'Yêu cầu cung ứng',children:<><DataTable path={'/supplier/requests?supplierId='+organizationId} rowKey="supply_request_item_id" columns={[[ 'request_code','Mã yêu cầu'],['sku_name','Sản phẩm'],['requested_quantity','Yêu cầu'],['accepted_quantity','Đã nhận'],['required_date','Ngày'],['required_arrival_time','Giờ đến Gate'],['address_name','Điểm Gate'],['supplier_unit_price','Đơn giá'],['status','Trạng thái']]} actions={r=><Button onClick={()=>setSelected(r)}>{r.status==='PENDING'?'Phản hồi':'Chuẩn bị lô'}</Button>}/>{selected&&<Card title={String(selected.request_code)+' · '+String(selected.sku_name)}>{selected.status==='PENDING'?<ActionForm key={String(selected.supply_request_item_id)} title="Phản hồi cung ứng" path={'/supplier/requests/'+selected.supply_request_item_id+'/respond'} fields={[{name:'quantity',label:'Lượng nhận (0 = từ chối)',type:'number',max:Number(selected.requested_quantity),initial:selected.requested_quantity}]} onDone={()=>{setSelected(undefined);void requests.refetch()}}/>:['ACCEPTED','PARTIALLY_ACCEPTED'].includes(String(selected.status))?<><Alert type="info" message={'Còn được khai báo: '+String(selected.remaining_quantity)}/><ActionForm key={String(selected.supply_request_item_id)} title="Tạo lô từ yêu cầu" path="/batches" fields={[{name:'quantity',label:'Số lượng',type:'number',min:0.001,max:Number(selected.remaining_quantity),initial:selected.remaining_quantity},{name:'origin',label:'Nguồn gốc / thu hoạch / đóng gói',type:'textarea'}]} transform={v=>({...v,requestItemId:selected.supply_request_item_id})} onDone={id=>navigate('/portal/batches/'+id)}/></>:<Alert type="info" message="Yêu cầu này không còn ở trạng thái chuẩn bị lô"/>}</Card>}</>},
 {key:'offers',label:'Năng lực cung ứng',children:<OffersEditor organizationId={organizationId} catalog={catalog.data??[]}/>},
 {key:'batches',label:'Lô & QR',children:<><Alert type="info" message="Tạo lô từ yêu cầu đã nhận; mở lô để sửa, in QR, xem QC và bổ sung hồ sơ."/><DataTable path={'/batches?supplierId='+organizationId} rowKey="batch_id" columns={[[ 'batch_code','Mã lô'],['sku_name','Sản phẩm'],['declared_quantity','Khai báo'],['accepted_quantity','Đạt'],['review_quantity','Giữ'],['rejected_quantity','Từ chối'],['batch_status','Trạng thái']]} actions={r=><Link to={'/portal/batches/'+r.batch_id}>Mở lô / hồ sơ</Link>}/></>},
 {key:'passport',label:'Hồ sơ nhà cung cấp',children:<><DataTable path={'/supplier/passport?supplierId='+organizationId} rowKey="supplier_document_id" columns={[[ 'document_type','Loại hồ sơ'],['document_number','Số'],['expiry_date','Hết hạn'],['verification_status','Xác minh'],['rejection_reason','Phản hồi']]} actions={r=><Space>{r.file_id!=null&&<EvidenceLink id={Number(r.file_id)}/>}</Space>}/><ActionForm title="Hồ sơ nguồn cung" path="/supplier/passport" fields={[{name:'type',label:'Loại hồ sơ',type:'select',options:[{value:'BUSINESS_LICENSE',label:'Đăng ký kinh doanh'},{value:'FOOD_SAFETY',label:'An toàn thực phẩm'},{value:'VIETGAP',label:'VietGAP'},{value:'ORIGIN_PROOF',label:'Nguồn gốc'},{value:'OTHER',label:'Khác'}]},{name:'number',label:'Số giấy tờ',required:false},{name:'issuedDate',label:'Ngày cấp',type:'date',required:false},{name:'expiryDate',label:'Hết hạn',type:'date',required:false},{name:'fileId',label:'Ảnh / PDF',type:'file'}]} transform={v=>({...v,supplierId:organizationId,issuedDate:v.issuedDate||null,expiryDate:v.expiryDate||null})}/><a href={'/trace/supplier-'+organizationId}>Tra cứu bằng QR trên từng lô</a></>},
 {key:'hubs',label:'Bản đồ Gate & Hub',children:<FreshLinkMap
   title="Hệ thống Cổng Kiểm Nhận Gate & Hub Chuỗi Lạnh"
   subtitle="Vị trí các điểm tiếp nhận nông sản đạt chuẩn VietGAP của FreshLink trên toàn quốc"
   hubs={[
     {hubId:1,code:'GATE-HN-01',name:'Gate KCS #01 - Hub Bắc Thăng Long (Đông Anh)',type:'CENTRAL_CROSS_DOCK',address:'KCN Bắc Thăng Long, Huyện Đông Anh, Hà Nội',district:'Đông Anh',city:'Hà Nội',latitude:21.1458,longitude:105.8452,temperatureC:3.4,humidityPercent:88,capacityCrates:3500,activeTrucks:18,phone:'0123456789'},
     {hubId:2,code:'GATE-HN-02',name:'Gate KCS #02 - Hub Hoàng Mai (Ngọc Hồi)',type:'URBAN_CROSS_DOCK',address:'Km 12 Đường Ngọc Hồi, Quận Hoàng Mai, Hà Nội',district:'Hoàng Mai',city:'Hà Nội',latitude:20.9572,longitude:105.8488,temperatureC:3.8,humidityPercent:86,capacityCrates:2200,activeTrucks:12,phone:'0123456789'},
     {hubId:3,code:'HUB-MC-01',name:'Hub Thu Gom Nông Sản Mộc Châu (Sơn La)',type:'REGIONAL_COLLECTION_HUB',address:'Tiểu khu Vườn Đào, TT. Nông Trường Mộc Châu, Sơn La',district:'Mộc Châu',city:'Sơn La',latitude:20.8436,longitude:104.6642,temperatureC:4.1,humidityPercent:91,capacityCrates:2800,activeTrucks:8,phone:'0123456789'},
     {hubId:4,code:'HUB-DL-01',name:'Hub Công Nghệ Cao Đà Lạt (Lâm Đồng)',type:'REGIONAL_COLLECTION_HUB',address:'Đường Vạn Thành, Phường 5, TP. Đà Lạt, Lâm Đồng',district:'Đà Lạt',city:'Lâm Đồng',latitude:11.9404,longitude:108.4182,temperatureC:3.8,humidityPercent:89,capacityCrates:4000,activeTrucks:15,phone:'0123456789'},
     {hubId:5,code:'GATE-HCM-01',name:'Gate KCS #03 - Hub Tây Bắc TP.HCM (Củ Chi)',type:'CENTRAL_CROSS_DOCK',address:'KCN Tân Phú Trung, Quốc lộ 22, Củ Chi, TP. Hồ Chí Minh',district:'Củ Chi',city:'TP. Hồ Chí Minh',latitude:10.9632,longitude:106.5298,temperatureC:3.6,humidityPercent:87,capacityCrates:4200,activeTrucks:22,phone:'0123456789'}
   ]}
   height="480px"
   zoom={6}
   center={[16.0, 107.5]}
 />},
 ...(manager?[{key:'billing',label:'Đối soát',children:<><DataTable path={'/billing/suppliers?supplierId='+organizationId} rowKey="batch_id" columns={[[ 'batch_code','Lô'],['accepted_quantity','Lượng đạt'],['supplier_unit_price','Đơn giá'],['payable','Giá trị đối soát']]}/><DataTable path={'/billing/settlements?supplierId='+organizationId} rowKey="settlement_id" columns={[[ 'settlement_code','Phiếu đối soát'],['payable_amount','Phải trả'],['status','Trạng thái'],['paid_at','Ngày trả']]} actions={r=><Link to={'/portal/settlements/'+r.settlement_id}>Chi tiết</Link>}/></>}]:[])
 ]}/>
}
