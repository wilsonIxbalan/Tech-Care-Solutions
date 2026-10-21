export type Money = string

export type RoleCode = 'ADMINISTRADOR' | 'RECEPCION' | 'TECNICO' | 'BODEGA' | 'CAJA'

export type OrderState =
  | 'RECIBIDO'
  | 'DIAGNOSTICO'
  | 'ESPERANDO_AUTORIZACION'
  | 'REPARACION'
  | 'LISTO'
  | 'ENTREGADO'
  | 'CANCELADO'

export interface ApiResponse<T> {
  data: T
  meta?: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface ApiErrorResponse {
  error: { code: string; message: string; details?: Record<string, string[]> }
  requestId: string
}

export interface SessionUser {
  idUsuario: number
  nombreUsuario: string
  nombreCompleto: string
  roles: RoleCode[]
  permisos: string[]
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  usuario: SessionUser
}
