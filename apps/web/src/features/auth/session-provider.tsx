import { useEffect, type PropsWithChildren } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, onSessionInvalid } from '@/lib/api-client'
import { getCurrentUser, login, logout } from './api'
import { SessionContext } from './session-context'
import type { SessionUser } from '@/types/api'

const sessionKey = ['session'] as const

export function SessionProvider({ children }: PropsWithChildren) {
  const client = useQueryClient()
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: async ({ signal }) => {
      try {
        const current = await getCurrentUser(signal)
        const previous = client.getQueryData<SessionUser | null>(sessionKey)
        // A different tab can change the cookie or an administrator can change access.
        // Drop data belonging to the former identity before exposing the new session.
        if (previous && (previous.idUsuario !== current.idUsuario
          || [...previous.roles].sort().join() !== [...current.roles].sort().join()
          || [...previous.permisos].sort().join() !== [...current.permisos].sort().join())) {
          await client.cancelQueries({ predicate: query => query.queryKey[0] !== 'session' })
          client.removeQueries({ predicate: query => query.queryKey[0] !== 'session' })
          client.getMutationCache().clear()
        }
        return current
      }
      catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.code === 'USUARIO_INACTIVO')) return null
        throw error
      }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  // Cancel in-flight reads before removing private data, so late responses cannot restore it.
  async function replaceSession(user: typeof session.data) {
    await client.cancelQueries()
    client.removeQueries({ predicate: query => query.queryKey[0] !== 'session' })
    client.getMutationCache().clear()
    client.setQueryData(sessionKey, user ?? null)
  }

  useEffect(() => onSessionInvalid(() => {
    void client.cancelQueries()
    client.removeQueries({ predicate: query => query.queryKey[0] !== 'session' })
    client.getMutationCache().clear()
    client.setQueryData(sessionKey, null)
  }), [client])

  return <SessionContext.Provider value={{
    user: session.data ?? null,
    pending: session.isPending,
    error: session.error,
    refresh: async () => {
      const result = await session.refetch()
      if (result.data === null) {
        client.removeQueries({ predicate: query => query.queryKey[0] !== 'session' })
        client.getMutationCache().clear()
      }
      return result
    },
    signIn: async input => {
      const result = await login(input)
      await replaceSession(result.usuario)
    },
    signOut: async () => { await logout(); await replaceSession(null) },
  }}>{children}</SessionContext.Provider>
}
