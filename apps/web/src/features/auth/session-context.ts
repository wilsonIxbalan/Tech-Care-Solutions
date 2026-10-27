import { createContext, useContext } from 'react'
import type { LoginInput, SessionUser } from '@/types/api'

export interface SessionContextValue {
  user: SessionUser | null
  pending: boolean
  error: Error | null
  refresh: () => Promise<unknown>
  signIn: (input: LoginInput) => Promise<void>
  signOut: () => Promise<void>
}
export const SessionContext = createContext<SessionContextValue | null>(null)
export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('SessionProvider es obligatorio.')
  return context
}
