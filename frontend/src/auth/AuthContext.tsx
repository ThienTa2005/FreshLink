import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, api, setToken, setOrganization, warmBackend } from '../api/http'

export type Membership = { organizationId: number; organizationName: string; organizationType: string; roles: string[] }
export type Actor = { userId: number; email: string; fullName: string; memberships: Membership[] }
export type AuthStatus = 'initializing' | 'anonymous' | 'authenticated' | 'unavailable'
type StoredSession = { token: string; expiresAt: string }
type Auth = {
  user: Actor | null
  membership: Membership | null
  selectWorkspace: (id: number) => void
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  retrySession: () => Promise<void>
  discardSession: () => void
}

const SESSION_KEY = 'freshlink:session'
const Context = createContext<Auth | null>(null)

function readSession(): StoredSession | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY)
    if (!value) return null
    const session = JSON.parse(value) as Partial<StoredSession>
    if (!session.token || !session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return session as StoredSession
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Actor | null>(null)
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [workspaceId, setWorkspaceId] = useState<number | null>(null)
  const client = useQueryClient()
  const initialized = useRef(false)

  const discardSession = useCallback(() => {
    setToken(null)
    setOrganization(null)
    setWorkspaceId(null)
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
    setStatus('anonymous')
    client.clear()
  }, [client])

  const restoreSession = useCallback(async () => {
    const session = readSession()
    if (!session) { discardSession(); return }
    setToken(session.token)
    setStatus('initializing')
    try {
      const actor = await api<Actor>('/auth/me')
      const saved = Number(sessionStorage.getItem(`freshlink:workspace:${actor.userId}`))
      const id = actor.memberships.find(m => m.organizationId === saved)?.organizationId ?? actor.memberships[0]?.organizationId ?? null
      setOrganization(id); setWorkspaceId(id)
      setUser(actor)
      setStatus('authenticated')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) discardSession()
      else { setUser(null); setStatus('unavailable') }
    }
  }, [discardSession])

  useEffect(() => {
    const expire = () => discardSession()
    window.addEventListener('freshlink:expired', expire)
    if (!initialized.current) { initialized.current = true; void restoreSession() }
    return () => window.removeEventListener('freshlink:expired', expire)
  }, [discardSession, restoreSession])

  async function login(email: string, password: string) {
    await warmBackend()
    const result = await api<{ token: string; expiresAt: string; user: Actor }>('/public/auth/login', 'POST', { email, password })
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: result.token, expiresAt: result.expiresAt }))
    const id = result.user.memberships[0]?.organizationId ?? null
    if (id != null) sessionStorage.setItem(`freshlink:workspace:${result.user.userId}`, String(id))
    setOrganization(id); setWorkspaceId(id)
    client.clear(); setToken(result.token); setUser(result.user); setStatus('authenticated')
  }

  async function logout() {
    try { await api('/auth/logout', 'POST') }
    finally { discardSession() }
  }

  async function refresh() {
    setUser(await api<Actor>('/auth/me'))
  }

  const membership = user?.memberships.find(m => m.organizationId === workspaceId) ?? null
  function selectWorkspace(id: number) {
    if (!user?.memberships.some(m => m.organizationId === id)) return
    void client.cancelQueries(); client.clear(); setOrganization(id); setWorkspaceId(id)
    sessionStorage.setItem(`freshlink:workspace:${user.userId}`, String(id))
  }
  return <Context.Provider value={{ user, membership, selectWorkspace, status, login, logout, refresh, retrySession: restoreSession, discardSession }}>{children}</Context.Provider>
}

export function useAuth() {
  const context = useContext(Context)
  if (!context) throw new Error('AuthProvider is required')
  return context
}

export function portals(user: Actor) {
  const roles = user.memberships.flatMap(m => m.roles)
  const admin = roles.includes('SYSTEM_ADMIN')
  return [
    ...(admin || roles.some(r => r.startsWith('RESTAURANT_')) ? ['restaurant'] : []),
    ...(admin || roles.some(r => r.startsWith('SUPPLIER_')) ? ['supplier'] : []),
    ...(admin || roles.some(r => ['OPERATIONS_COORDINATOR', 'QUALITY_INSPECTOR', 'ACCOUNTANT', 'CUSTOMER_SUPPORT'].includes(r)) ? ['operations'] : []),
    ...(admin || roles.includes('DRIVER') ? ['driver'] : []),
  ]
}
