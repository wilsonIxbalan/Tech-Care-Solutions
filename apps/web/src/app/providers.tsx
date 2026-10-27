import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type PropsWithChildren } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/features/auth/session-provider'
import { ApiError } from '@/lib/api-client'

function createQueryClient() { return new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
}) }

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
      <Toaster />
    </QueryClientProvider>
  )
}
