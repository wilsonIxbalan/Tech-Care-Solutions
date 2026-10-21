import type { Money, OrderState } from '@/types/api'

/** Public read contracts. They do not assert that these endpoints already exist. */
export interface ClienteDto {
  idCliente: number; tipoCliente: 'INDIVIDUAL' | 'EMPRESARIAL'; nit: string
  nombres: string | null; apellidos: string | null; razonSocial: string | null
  nombreContacto: string | null; nombreMostrar: string; telefono: string
  email: string | null; direccion: string | null; estado: 'ACTIVO' | 'INACTIVO'; fechaRegistro: string
}

export interface EquipoDto {
  idEquipo: number; idCliente: number; clienteNombre: string
  idTipoEquipo: number; tipoEquipoNombre: string; idMarca: number; marcaNombre: string
  modelo: string; numeroSerie: string; descripcion: string | null
  estado: 'ACTIVO' | 'INACTIVO' | 'BAJA'; fechaRegistro: string
}

export interface OrdenResumenDto {
  idOrden: number; numeroOrden: string; idCliente: number; clienteNombre: string
  idEquipo: number; numeroSerie: string; idUsuarioRecepcion: number
  fechaIngreso: string; problemaReportado: string; idPrioridad: number; prioridad: string
  estado: OrderState; fechaEstimada: string | null; observaciones: string | null
}

export interface HistorialEstadoDto {
  idHistorial: number; estadoAnterior: OrderState | null; estadoNuevo: OrderState
  fechaCambio: string; idUsuario: number; usuarioNombre: string; observacion: string | null
}

export interface DiagnosticoDto {
  idDiagnostico: number; idOrden: number; idTecnico: number; tecnicoNombre: string
  fechaDiagnostico: string; descripcion: string; costoManoObraEstimado: Money
  estado: 'ACTIVO' | 'ANULADO'
}

export interface ActividadDto {
  idActividad: number; idReparacion: number; idTecnico: number; tecnicoNombre: string
  descripcion: string; fechaActividad: string; horasInvertidas: string
}

export interface ConsumoDto {
  idRepuestoReparacion: number; idReparacion: number; idBodega: number; bodegaNombre: string
  idRepuesto: number; codigoRepuesto: string; repuestoNombre: string; cantidad: number
  precioCostoUnitario: Money; precioVentaUnitario: Money; subtotal: Money
  fechaAsignacion: string; idUsuario: number; estado: 'ACTIVO' | 'ANULADO'
}

export interface ReparacionDto {
  idReparacion: number; idOrden: number; idDiagnostico: number; idTecnico: number; tecnicoNombre: string
  fechaInicio: string; fechaFin: string | null; descripcion: string; costoManoObra: Money
  estado: 'EN_PROCESO' | 'FINALIZADA' | 'CANCELADA'; actividades: ActividadDto[]; repuestos: ConsumoDto[]
}

export interface DetalleFacturaDto {
  idDetalleFactura: number; tipoLinea: 'MANO_OBRA' | 'REPUESTO'
  idReparacion: number | null; idRepuestoReparacion: number | null
  descripcion: string; cantidad: string; precioUnitario: Money; subtotal: Money
}

export interface PagoDto {
  idPago: number; idFactura: number; idMetodoPago: number; metodoPagoNombre: string
  monto: Money; fechaPago: string; referencia: string | null; idUsuario: number
  usuarioNombre: string; estado: 'APLICADO' | 'ANULADO'; motivoAnulacion: string | null
}

export interface FacturaResumenDto {
  idFactura: number; numeroFactura: string; idOrden: number; numeroOrden: string
  idCliente: number; clienteNombre: string; nitFacturacion: string; nombreFacturacion: string
  direccionFacturacion: string | null; fechaFactura: string; subtotalManoObra: Money
  subtotalRepuestos: Money; porcentajeImpuesto: string; subtotal: Money; impuesto: Money
  total: Money; totalPagado: Money; saldo: Money; estado: 'EMITIDA' | 'PAGADA' | 'ANULADA'
}

export interface FacturaDetalleDto extends FacturaResumenDto {
  detalles: DetalleFacturaDto[]; pagos: PagoDto[]
}

export interface EntregaDto {
  idEntrega: number; idOrden: number; idUsuarioEntrega: number; usuarioEntregaNombre: string
  nombreRecibe: string; documentoRecibe: string | null; fechaEntrega: string; observaciones: string | null
}

export interface OrdenDetalleDto extends OrdenResumenDto {
  historial: HistorialEstadoDto[]; diagnosticos: DiagnosticoDto[]; reparaciones: ReparacionDto[]
  factura: FacturaDetalleDto | null; entrega: EntregaDto | null
}

export interface CompraItemDto {
  idDetalleCompra: number; idRepuesto: number; codigoRepuesto: string; repuestoNombre: string
  cantidad: number; costoUnitario: Money; subtotal: Money
}

export interface CompraResumenDto {
  idCompra: number; numeroCompra: string; idProveedor: number; proveedorNombre: string
  idBodegaDestino: number; bodegaNombre: string; idUsuarioRegistro: number; fechaCompra: string
  fechaRecepcion: string | null; idUsuarioRecepcion: number | null
  numeroDocumentoProveedor: string | null; estado: 'PENDIENTE' | 'RECIBIDA' | 'ANULADA'
  observaciones: string | null; total: Money
}

export interface CompraDetalleDto extends CompraResumenDto { items: CompraItemDto[] }

export interface InventarioDto {
  idBodega: number; bodegaNombre: string; idCategoria: number; categoriaNombre: string
  idRepuesto: number; codigoRepuesto: string; repuestoNombre: string; existencia: number
  stockMinimo: number; bajoMinimo: boolean; sinStock: boolean; fechaUltimoMovimiento: string | null
}

export interface MovimientoDto {
  idMovimiento: number; idBodega: number; bodegaNombre: string; idRepuesto: number
  codigoRepuesto: string; repuestoNombre: string; codigoTipoMovimiento: string
  naturaleza: 'E' | 'S'; cantidad: number; fechaMovimiento: string; idUsuario: number
  usuarioNombre: string; documentoOrigen: 'COMPRA' | 'REPARACION' | 'AJUSTE'
  numeroDocumento: string; existenciaResultante: number; observacion: string | null
}

export interface ActividadRecienteDto { tipo: 'ESTADO_ORDEN' | 'MOVIMIENTO_INVENTARIO'; descripcion: string; fecha: string }

export interface DashboardDto {
  ordenesAbiertas: number; ordenesEnDiagnostico: number; ordenesEnReparacion: number
  ordenesListas: number; facturasConSaldo: number; repuestosBajoMinimo: number
  actividadReciente: ActividadRecienteDto[]
}
