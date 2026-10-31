import { useState } from 'react'

/** Una validación local sólo describe los datos recibidos que se usaron al validar. */
export function useDraftMessage(context: unknown) {
  const snapshot = JSON.stringify(context)
  const [result, setResult] = useState<{ message: string; snapshot: string | undefined }>()
  const message = result?.snapshot === snapshot ? result?.message ?? '' : ''
  return [message, (next: string) => setResult({ message: next, snapshot })] as const
}
