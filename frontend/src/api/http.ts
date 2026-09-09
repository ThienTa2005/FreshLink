const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

export type ApiResponse<T> = {
  success: boolean
  data: T
  message: string
  timestamp: string
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`API trả về mã lỗi ${response.status}`)
  return response.json() as Promise<ApiResponse<T>>
}
