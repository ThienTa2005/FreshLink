import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setToken } from '../api/http'
export type Membership = { organizationId: number; organizationName: string; organizationType: string; roles: string[] }
export type Actor = { userId: number; email: string; fullName: string; memberships: Membership[] }
type Auth = { user: Actor | null; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> }
const Context = createContext<Auth | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Actor | null>(null)
  const client = useQueryClient()
  useEffect(() => {
    const expire = () => { setToken(null); setUser(null); client.clear() }
    window.addEventListener('freshlink:expired', expire)
    return () => window.removeEventListener('freshlink:expired', expire)
  }, [client])
  async function login(email: string, password: string) {
    const result = await api<{ token: string; user: Actor }>('/public/auth/login', 'POST', { email, password })
    client.clear(); setToken(result.token); setUser(result.user)
  }
  async function logout() {
    try { await api('/auth/logout', 'POST') }
    finally { setToken(null); setUser(null); client.clear() }
  }
  return <Context.Provider value={{ user, login, logout }}>{children}</Context.Provider>
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
