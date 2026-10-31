/** Estado recibido del adaptador futuro. Ausencia de conexión no equivale a consulta vacía. */
export type ReceivedData<T> = { status: 'pending' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: readonly T[] }
