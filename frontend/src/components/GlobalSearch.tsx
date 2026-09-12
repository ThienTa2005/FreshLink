import { useEffect, useState } from 'react'
import { Empty, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/http'
import type { Row } from './Workspace'
const target=(row:Row)=>row.type==='ORDER'?'/portal/orders':row.type==='BATCH'?'/portal/batches':row.type==='TRIP'?'/portal/trips':'/portal/dashboard'
export default function GlobalSearch(){
 const [value,setValue]=useState('');const [rows,setRows]=useState<Row[]>([]);const [busy,setBusy]=useState(false);const [open,setOpen]=useState(false);const navigate=useNavigate()
 useEffect(()=>{if(value.trim().length<2){setRows([]);setOpen(false);return}const timer=window.setTimeout(async()=>{setBusy(true);try{setRows(await api<Row[]>(`/search?q=${encodeURIComponent(value.trim())}`));setOpen(true)}catch{setRows([])}finally{setBusy(false)}},300);return()=>window.clearTimeout(timer)},[value])
 return <div className="global-search-wrap"><div className="global-search">⌕ <input value={value} onFocus={()=>setOpen(value.length>=2)} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}} aria-label="Tìm kiếm" placeholder="Mã đơn, lô, chuyến, nhà cung cấp..." />{busy&&<Spin size="small"/>}</div>{open&&<div className="search-results">{rows.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy kết quả"/>:rows.map(row=><button key={`${row.type}-${row.id}`} onClick={()=>{navigate(target(row));setOpen(false);setValue('')}}><span>{String(row.title)}</span><small>{String(row.status??row.code??'')}</small></button>)}</div>}</div>
}
