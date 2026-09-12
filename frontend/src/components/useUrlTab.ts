import { useSearchParams } from 'react-router-dom'
export function useUrlTab(fallback:string){const [params,setParams]=useSearchParams();return [params.get('tab')??fallback,(tab:string)=>{setParams(old=>{const next=new URLSearchParams(old);next.set('tab',tab);return next})}] as const}
