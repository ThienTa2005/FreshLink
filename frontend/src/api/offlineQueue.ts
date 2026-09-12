import { api, ApiError } from './http'

export interface QueuedAction {
  id: string
  url: string
  method: string
  body?: unknown
  idempotencyKey: string
  createdAt: number
  description: string
  retries: number
}

const STORAGE_KEY = 'freshlink:offline_actions'
const listeners: Array<(count: number) => void> = []

function loadQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedAction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to persist offline queue', e)
  }
  notify(queue.length)
}

function notify(count: number) {
  listeners.forEach(fn => fn(count))
}

export function subscribeOfflineQueue(fn: (count: number) => void): () => void {
  listeners.push(fn)
  fn(loadQueue().length)
  return () => {
    const idx = listeners.indexOf(fn)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

export function getPendingQueueCount(): number {
  return loadQueue().length
}

export function enqueueOfflineAction(url: string, method: string, body?: unknown, description = 'Hành động ngoại tuyến'): string {
  const idempotencyKey = crypto.randomUUID?.() ?? `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const action: QueuedAction = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    url,
    method,
    body,
    idempotencyKey,
    createdAt: Date.now(),
    description,
    retries: 0
  }
  const queue = loadQueue()
  queue.push(action)
  saveQueue(queue)
  return idempotencyKey
}

let isFlushing = false

export async function flushOfflineQueue(): Promise<{ processed: number; failed: number }> {
  if (isFlushing || !navigator.onLine) return { processed: 0, failed: 0 }
  isFlushing = true
  let processed = 0
  let failed = 0

  try {
    const queue = loadQueue()
    const remaining: QueuedAction[] = []

    for (const item of queue) {
      try {
        await api(item.url, item.method, item.body, item.idempotencyKey)
        processed++
      } catch (err: unknown) {
        if (err instanceof ApiError && (err.kind === 'network' || err.kind === 'timeout')) {
          // Keep item in queue and halt flushing until connection improves
          item.retries++
          remaining.push(item)
          remaining.push(...queue.slice(queue.indexOf(item) + 1))
          failed++
          break
        } else if (err instanceof ApiError && err.status === 409) {
          // Idempotency conflict / already executed on server, safe to discard
          processed++
        } else {
          // Business error or bad request, log and discard to avoid blocking queue
          console.warn(`Discarding failed offline item ${item.id}:`, err)
          failed++
        }
      }
    }

    saveQueue(remaining)
  } finally {
    isFlushing = false
  }

  return { processed, failed }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOfflineQueue()
  })
}
