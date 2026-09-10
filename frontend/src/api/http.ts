const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'
const REQUEST_TIMEOUT_MS = 90_000

export type ApiResponse<T> = { success: boolean; data: T; message: string; timestamp: string }
export type ApiErrorKind = 'http' | 'timeout' | 'network'

export class ApiError extends Error {
  constructor(message: string, public readonly kind: ApiErrorKind, public readonly status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

let token: string | null = null
let warmInFlight: Promise<void> | null = null
let lastWarmAt = 0

export function setToken(value: string | null) { token = value }

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new ApiError('Máy chủ khởi động quá lâu. Vui lòng thử lại.', 'timeout')
    throw new ApiError('Không thể kết nối máy chủ. Hãy kiểm tra mạng và thử lại.', 'network')
  } finally {
    window.clearTimeout(timeout)
  }
}

export function warmBackend(): Promise<void> {
  if (Date.now() - lastWarmAt < 60_000) return Promise.resolve()
  if (warmInFlight) return warmInFlight
  warmInFlight = fetchWithTimeout(`${API_URL}/public/health`, { headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) throw new ApiError(`Máy chủ chưa sẵn sàng (${response.status})`, 'http', response.status)
      lastWarmAt = Date.now()
    })
    .finally(() => { warmInFlight = null })
  return warmInFlight
}

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => null) as ApiResponse<T> | null
  if (response.status === 401 && token) window.dispatchEvent(new Event('freshlink:expired'))
  if (!response.ok || !result?.success)
    throw new ApiError(result?.message ?? `Không thể xử lý yêu cầu (${response.status})`, 'http', response.status)
  return result.data
}

export async function downloadEvidence(id: number) {
  const access = await api<{ url: string; expiresAt: string; name: string; mimeType: string }>(`/media/${id}/access`)
  const anchor = document.createElement('a')
  anchor.href = access.url
  anchor.rel = 'noopener noreferrer'
  anchor.click()
}

export async function uploadEvidence(file: File): Promise<{ id: number; name: string }> {
  const body = new FormData(); body.append('file', file)
  const response = await fetchWithTimeout(`${API_URL}/media`, {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body,
  })
  return readResponse<{ id: number; name: string }>(response)
}

export async function api<T>(path: string, method = 'GET', body?: unknown, key?: string): Promise<T> {
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return readResponse<T>(response)
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  return { success: true, data: await api<T>(path), message: '', timestamp: new Date().toISOString() }
}
