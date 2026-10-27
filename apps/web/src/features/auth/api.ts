import { apiFetch } from '@/lib/api-client'
import type { LoginInput, LoginResponse, SessionUser } from '@/types/api'

export async function login(input: LoginInput): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return response.data
}

export async function getCurrentUser(signal?: AbortSignal): Promise<SessionUser> {
  return (await apiFetch<SessionUser>('/auth/me', { signal })).data
}

export async function logout(): Promise<void> {
  await apiFetch<{ message: string }>('/auth/logout', {
    method: 'POST',
    body: '{}',
  })
}
