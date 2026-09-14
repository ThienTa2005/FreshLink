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
let organizationId: number | null = null
export function setOrganization(id: number | null) { organizationId = id }
let warmInFlight: Promise<void> | null = null
let lastWarmAt = 0
let sessionCheckInFlight: Promise<void> | null = null

export function setToken(value: string | null) { token = value }

function confirmSessionExpired(): Promise<void> {
  if (!token) return Promise.resolve()
  if (sessionCheckInFlight) return sessionCheckInFlight
  const currentToken = token
  sessionCheckInFlight = fetchWithTimeout(`${API_URL}/auth/me`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${currentToken}` },
  })
    .then(response => {
      if (response.status === 401 && token === currentToken)
        window.dispatchEvent(new Event('freshlink:expired'))
    })
    .catch(() => undefined)
    .finally(() => { sessionCheckInFlight = null })
  return sessionCheckInFlight
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const headers = new Headers(init?.headers)
    if (!headers.has('X-Request-Id')) {
      const reqId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      headers.set('X-Request-Id', reqId)
    }
    if (organizationId != null && !String(input).includes('/public/')) headers.set('X-Organization-Id', String(organizationId))
    return await fetch(input, { ...init, headers, signal: controller.signal })
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
  if (response.status === 401 && token) void confirmSessionExpired()
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

export async function uploadEvidence(file: File, isPublic = false): Promise<{ id: number; name: string; url?: string }> {
  const body = new FormData(); body.append('file', file)
  const query = isPublic ? '?isPublic=true' : ''
  const response = await fetchWithTimeout(`${API_URL}/media${query}`, {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body,
  })
  return readResponse<{ id: number; name: string; url?: string }>(response)
}

export async function downloadApiFile(path: string, fallbackName: string) {
  const response = await fetchWithTimeout(`${API_URL}${path}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  if (!response.ok) { await readResponse(response); return }
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
  anchor.href = url; anchor.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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

export interface MatchedItem {
  skuId: number
  skuCode: string
  skuName: string
  baseUnit: string
  packSize: number
  packDescription: string
  quantity: number
  unitPrice: number
  lineTotal: number
  gradeType: string
  rescueReason?: string
  discountPercent?: number
  matchStatus: 'EXACT' | 'HIGH' | 'PARTIAL'
  matchScore: number
  originalText: string
}

export interface DetectedItem {
  detectedName: string
  quantity: number
  unit: string
  notes: string
}

export interface SmartOcrResult {
  matchedItems: MatchedItem[]
  unmatchedItems: DetectedItem[]
  totalDetected: number
  totalMatched: number
  estimatedGrandTotal: number
  scanSource: string
  notes: string
}

export interface SmartOcrSample {
  title: string
  tag: string
  content: string
}

export async function scanSmartOcrFile(file: File, date?: string): Promise<SmartOcrResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (date) formData.append('date', date)
  const response = await fetchWithTimeout(`${API_URL}/ordering/smart-ocr/scan`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  return readResponse<SmartOcrResult>(response)
}

export async function scanSmartOcrText(text: string, date?: string): Promise<SmartOcrResult> {
  return api<SmartOcrResult>('/ordering/smart-ocr/scan-text', 'POST', { text, date })
}

export async function getSmartOcrSamples(): Promise<SmartOcrSample[]> {
  return api<SmartOcrSample[]>('/ordering/smart-ocr/samples')
}

