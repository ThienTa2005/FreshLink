const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'
export type ApiResponse<T> = { success: boolean; data: T; message: string; timestamp: string }
let token: string | null = null
export function setToken(value: string | null) { token = value }
export async function uploadEvidence(file: File): Promise<{ id: number; name: string }> {
  const body = new FormData(); body.append('file', file)
  const response = await fetch(`${API_URL}/media`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body })
  const result = await response.json() as ApiResponse<{ id: number; name: string }>
  if (!response.ok || !result.success) throw new Error(result.message ?? 'Không thể tải tệp')
  return result.data
}
export async function api<T>(path: string, method = 'GET', body?: unknown, key?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json().catch(() => null) as ApiResponse<T> | null
  if (response.status === 401 && token) window.dispatchEvent(new Event('freshlink:expired'))
  if (!response.ok || !result?.success) throw new Error(result?.message ?? `Không thể xử lý yêu cầu (${response.status})`)
  return result.data
}
export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  return { success: true, data: await api<T>(path), message: '', timestamp: new Date().toISOString() }
}
