import type { Membership } from '../auth/AuthContext'
export const roleNames: Record<string,string> = {SYSTEM_ADMIN:'Quản trị hệ thống',RESTAURANT_MANAGER:'Quản lý nhà hàng',RESTAURANT_PURCHASER:'Thu mua',RESTAURANT_RECEIVER:'Nhận hàng',SUPPLIER_MANAGER:'Quản lý nhà cung cấp',SUPPLIER_STAFF:'Nhân viên nhà cung cấp',OPERATIONS_COORDINATOR:'Điều phối',QUALITY_INSPECTOR:'Kiểm hàng',ACCOUNTANT:'Kế toán',CUSTOMER_SUPPORT:'CSKH',DRIVER:'Tài xế'}
export function can(m: Membership | null,...roles: string[]) { return !!m && (m.roles.includes('SYSTEM_ADMIN') || roles.some(r=>m.roles.includes(r))) }
export const states: Record<string,string> = {DRAFT:'Nháp',SUBMITTED:'Chờ duyệt',CONFIRMED:'Đã xác nhận',SOURCING:'Đang chuẩn bị nguồn',READY_FOR_DELIVERY:'Sẵn sàng giao',OUT_FOR_DELIVERY:'Đang giao',DELIVERED:'Đã giao',PARTIALLY_DELIVERED:'Giao một phần',CANCELLED:'Đã hủy',PENDING:'Chờ xử lý',ACCEPTED:'Đạt / đã nhận',PARTIALLY_ACCEPTED:'Chấp nhận một phần',REJECTED:'Từ chối',QUARANTINED:'Đang cách ly',CREATED:'Chờ kiểm',ACTIVE:'Hoạt động',DISABLED:'Đã khóa',SUSPENDED:'Tạm dừng',INVITED:'Chờ tham gia',PLANNED:'Đã lên kế hoạch',IN_PROGRESS:'Đang thực hiện',COMPLETED:'Hoàn tất',PAID:'Đã thanh toán',UNPAID:'Chưa thanh toán',PARTIALLY_PAID:'Thanh toán một phần',NEW:'Mới',VERIFYING:'Đang xác minh',WAITING_PARTNER:'Chờ đối tác',RESOLVED:'Đã xử lý',CLOSED:'Đã đóng',NOT_REQUIRED:'Không cần duyệt',APPROVED:'Đã duyệt',AVAILABLE:'Khả dụng',PARTIALLY_RESERVED:'Đã giữ một phần',FULLY_RESERVED:'Đã giữ hết'}
export function display(value:unknown,key=''):string {
 if(value==null)return '—'
 if(states[String(value)])return states[String(value)]
 if(/amount|price|payable|paid$|balance/.test(key)&&!Number.isNaN(Number(value)))return Number(value).toLocaleString('vi-VN')+' đ'
 if(/_at$/.test(key)&&typeof value==='string'&&!Number.isNaN(Date.parse(value)))return new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})
 if(/date$/.test(key)&&typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value.split('-').reverse().join('/')
 return String(value)
}
export function entityUrl(type:unknown,id:unknown) { const roots:Record<string,string>={ORDER:'orders',BATCH:'batches',TRIP:'trips',COMPLAINT:'claims',CLAIM:'claims',SETTLEMENT:'settlements',ORGANIZATION:'admin/partners'};return roots[String(type)]?`/portal/${roots[String(type)]}/${id}`:'/portal/dashboard' }
