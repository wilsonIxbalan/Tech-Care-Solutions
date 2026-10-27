# 03 · Endpoints y entregables de BD

Base `/api/v1`. [DTO de entrada/salida](02-contratos-dtos.md); [sesión y errores](04-errores-seguridad.md). El contrato se valida con pruebas HTTP aisladas; la integracion real con Azure requiere una comprobacion autorizada independiente.

## Lecturas y mantenimientos

- `POST /auth/login` (LoginInput → LoginResult + cookie), `GET /auth/me` (SessionUser), `POST /auth/logout` (borra cookie; no exige JWT vigente, sí control de origen).
- `GET /health`: {status:"ok"}, sin SQL ni sesión. `GET /ready`: mismo resultado o 503; sesión válida y comprobación SQL bajo demanda.
- `GET /catalogos`: data con tiposEquipo/marcas/prioridades/estadosOrden/categoriasRepuesto/metodosPago/tiposMovimiento/roles/tecnicos; elementos {id,codigo?,nombre}, prioridad añade nivel, estado esFinal; técnico usa id de usuario. Usuario autenticado.
- `GET /dashboard`: DashboardDto, seis contadores SQL y hasta diez eventos de actividad. Requiere REPORTES_VER.
- Para `/clientes`, `/equipos`, `/repuestos`, `/proveedores`, `/bodegas`, `/usuarios`: GET lista, GET /:id, POST (Input → recurso con ID), PATCH /:id (Input parcial → recurso actualizado). Usuarios: solo ADMINISTRADOR.
- Escritura de clientes/equipos: CLIENTES_GESTIONAR/EQUIPOS_GESTIONAR; proveedores: PROVEEDORES_GESTIONAR; repuestos/bodegas: BODEGA o admin. Lectura necesaria para servicio, caja, consumo o reportes se permite a esos perfiles.
- `GET /catalogos/:catalogo`, `POST /catalogos/:catalogo`, `PATCH /catalogos/:catalogo/:id`: escritura admin; lista blanca tipos-equipo/marcas/categorias-repuesto/metodos-pago. CatalogoInput. No nombre de tabla arbitrario.
- `GET /ordenes` → OrdenResumenDto[]; filtros idCliente/idEquipo/estado/idPrioridad/idTecnico/fechaDesde/fechaHasta. `GET /ordenes/:id` → OrdenDetalleDto.
- `GET /compras` y `GET /compras/:id` → CompraResumenDto[]/CompraDetalleDto; filtros idProveedor/idBodegaDestino/estado/fechas. COMPRAS_GESTIONAR.
- `GET /inventario` → InventarioDto[], filtros idBodega/idCategoria/idRepuesto/bajoMinimo; `GET /inventario/movimientos` → MovimientoDto[], filtros bodega/repuesto/tipo/usuario/fechas. Lectura para inventario, consumo o reportes autorizados.
- `GET /facturas` y `GET /facturas/:id` → FacturaResumenDto[]/FacturaDetalleDto; filtros idCliente/estado/conSaldo/fechas. FACTURAR, PAGOS_REGISTRAR, ENTREGAR_ORDEN o REPORTES_VER según lectura necesaria.

Todas las listas anteriores usan paginación del documento 02. No exponer borrados físicos ni PATCH genérico de stock, factura o pago aplicado.

## Acciones de servicio (SP con prefijo dbo.)

- `POST /ordenes` · ORDENES_CREAR · OrdenInput → {idOrden,numeroOrden,estado} · **sp_RegistrarOrdenServicio**.
- `POST /ordenes/:id/diagnostico` · DIAGNOSTICO_REGISTRAR + TECNICO · DiagnosticoInput → {idDiagnostico,idOrden,estadoOrden} · **sp_RegistrarDiagnostico**.
- `POST /ordenes/:id/reparaciones` · REPARACION_GESTIONAR + TECNICO · ReparacionInput → {idReparacion,idOrden,estado,estadoOrden} · **sp_IniciarReparacion**.
- `POST /reparaciones/:id/finalizar` · técnico responsable o admin con REPARACION_GESTIONAR · FinalizarInput → {idReparacion,estado,estadoOrden} · **sp_FinalizarReparacion**. No asumir LISTO si quedan reparaciones.
- `POST /reparaciones/:id/actividades` · TECNICO + REPARACION_GESTIONAR · ActividadInput → {idActividad} · **usp_RegistrarActividad**.
- `POST /reparaciones/:id/repuestos` · REPUESTOS_CONSUMIR · ConsumoInput → {idRepuestoReparacion,existenciaResultante} · **sp_AsignarRepuestoReparacion**.
- `POST /ordenes/:id/estado` · EstadoInput → {idOrden,estado} · **sp_CambiarEstadoOrden**. DIAGNOSTICO: recepción/técnico/admin; CANCELADO: recepción/admin; REPARACION de retrabajo: técnico/admin, sin factura. SQL valida transición y permiso.
- `POST /ordenes/:id/entrega` · ENTREGAR_ORDEN · EntregaInput → {idEntrega,idOrden,estadoOrden} · **sp_EntregarOrden**. Solo LISTO + factura vigente + saldo cero.

No enviar LISTO/ENTREGADO/ESPERANDO_AUTORIZACION por el endpoint genérico: los producen los procesos. Ruta de la orden: RECIBIDO → DIAGNOSTICO → ESPERANDO_AUTORIZACION → REPARACION → LISTO → ENTREGADO; cancelar no permite ignorar consumo/factura.

## Compras, inventario y caja

- `POST /compras` · COMPRAS_GESTIONAR · CompraInput → {idCompra,numeroCompra,estado} · **sp_RegistrarCompra**, con dbo.tvp_DetalleCompra.
- `POST /compras/:id/recibir` · COMPRAS_GESTIONAR · {} → {idCompra,estado} · **sp_RecibirCompra**; recepción completa, una sola vez.
- `POST /inventario/ajustes` · INVENTARIO_GESTIONAR · AjusteInput → {idBodega,idRepuesto,existenciaResultante} · **sp_AjustarInventario**.
- `PATCH /inventario/:idBodega/:idRepuesto/stock-minimo` · INVENTARIO_GESTIONAR · MinimoInput → {idBodega,idRepuesto,stockMinimo} · **usp_CambiarStockMinimo**; no crea movimiento ficticio.
- `PATCH /repuestos/:id` cuando cambia precio → **usp_ActualizarPreciosRepuesto** con actor; no UPDATE directo del precio ni cambio de históricos.
- `GET /ordenes/:id/resumen-facturacion` · FACTURAR · porcentajeImpuesto opcional default 12.00 → {subtotalManoObra,subtotalRepuestos,porcentajeImpuesto,impuesto,total}, calculado en SQL.
- `POST /ordenes/:id/factura` · FACTURAR · FacturaInput → {idFactura,numeroFactura,estado,subtotalManoObra,subtotalRepuestos,subtotal,impuesto,total,saldo} · **sp_GenerarFactura**.
- `POST /facturas/:id/pagos` · PAGOS_REGISTRAR · PagoInput → {idPago,idFactura,saldo,estadoFactura} · **sp_RegistrarPago**.
- `POST /pagos/:id/anular` · PAGOS_REGISTRAR · AnularPagoInput → {idPago,estado,saldo,estadoFactura} · **sp_AnularPago**; no después de entrega.

No ofrecer anular factura/compra/consumo hasta contar con su proceso compensatorio aprobado y probado; no sustituirlo por DELETE o edición libre.

## Doce reportes

`GET /reportes/<slug>` requiere REPORTES_VER. `facturas-saldo`, `ingresos` y `compras-proveedor` requieren ademas ADMINISTRADOR o CAJA, tanto en consulta como en descarga. La restriccion del reporte de compras no retira las operaciones de compras/inventario de BODEGA. SQL de referencia: [fase 09](../database/fases/09_reportes.sql); todos los procedimientos siguientes usan dbo. fechaDesde/fechaHasta son días de Guatemala: API los convierte a @Desde/@HastaExclusiva UTC.

1. `ordenes-activas` → usp_ReporteOrdenesActivas; estado/idPrioridad/idTecnico/fechas.
2. `historial-cliente` → usp_ReporteHistorialCliente; idCliente obligatorio, fechas opcionales.
3. `historial-equipo` → usp_ReporteHistorialEquipo; numeroSerie obligatorio.
4. `actividad-tecnico` → usp_ReporteActividadTecnico; idTecnico y ambas fechas obligatorios; registros con tipo DIAGNOSTICO/REPARACION.
5. `repuestos-utilizados` → usp_ReporteRepuestosUtilizados; idOrden/idTecnico/idBodega/fechas.
6. `inventario` → usp_ReporteInventario; idBodega/idCategoria/idRepuesto.
7. `bajo-minimo` → usp_ReporteBajoMinimo; idBodega/idCategoria.
8. `compras-proveedor` → usp_ReporteComprasProveedor; idProveedor/idBodega/estado/fechas.
9. `movimientos` → usp_ReporteMovimientos; idBodega/idRepuesto/codigoTipo/idUsuario/fechas.
10. `facturas-saldo` → usp_ReporteFacturasSaldo; idCliente/conSaldo/estado/fechas; cabeceras y pagos separados.
11. `ingresos` → usp_ReporteIngresos; fechas/idCliente; filas {anio,mes,cantidadFacturas,totalManoObra,totalRepuestos,subtotal,impuesto,total}.
12. `trazabilidad` → usp_ReporteTrazabilidad; idOrden; {orden,historial:[],diagnosticos:[],reparaciones:[],movimientos:[],factura,pagos:[],entrega}.

Historial cliente/equipo: {cliente|equipo,ordenes:[]}; preservar cabecera sin órdenes. El repository agrupa resultsets sin duplicar cabeceras; no sumar totales repetidos ni paginar filas hijas como si fueran órdenes. El backend completa el detalle desde las vistas cuando el SP entrega una proyección parcial.

Historiales y trazabilidad se consultan por sus identificadores/fechas especificos, sin `search` textual. Ese parametro se rechaza en lugar de ignorarse o recortar por separado padres e hijos. La misma validacion aplica al JSON y a las exportaciones.

## Descargas aprobadas

- `GET /reportes/<slug>/exportar?formato=csv&conjunto=1` o `?formato=xlsx` (sin conjunto), con los mismos filtros de negocio HTTP. CSV exige un conjunto valido; XLSX incluye todos los conjuntos.
- `GET /facturas/:id/pdf` requiere ADMINISTRADOR o CAJA y uno de FACTURAR/PAGOS_REGISTRAR/REPORTES_VER.
- Exportar todos los resultados filtrados, no solamente la pagina visible, hasta un maximo de 10 000 filas por descarga. Superar el limite produce un aviso; nunca se truncan los resultados silenciosamente.
- XLSX genuino con varias hojas cuando hay conjuntos relacionados; CSV UTF-8 con seleccion del conjunto. Preservar IDs, ceros, acentos, fechas e importes oficiales. Neutralizar formulas procedentes de campos de texto.
- Factura PDF simulada en papel Carta, con datos fiscales y lineas historicas de una factura persistida. Sin integracion SAT ni validez de factura electronica certificada. No reconstruir importes a partir de precios actuales ni crear otra factura al descargar.
- Todas las descargas requieren sesion y autorizacion en backend; respuesta binaria con MIME correcto, nombre seguro y `Cache-Control: private, no-store`. No se incluyen en el envelope JSON.
- Logo aprobado: propuesta A «Continuidad», monograma T/C. No inventar NIT, direccion ni datos legales del emisor.

## Qué entrega BD al backend

[Fase 05](../database/fases/05_vistas.sql): vw_Ordenes/Diagnosticos/Reparaciones/Actividades/Consumos/HistorialEstadoOrden, vw_Compras/DetalleCompra, vw_Facturas/DetalleFactura/Pagos/Entregas, vw_InventarioActual/MovimientosInventario y dashboard/actividad. Leer por vistas; la cuenta de API no tiene DML transaccional directo. [Fase 07](../database/fases/07_procedimientos.sql): SP de proceso con IDs OUTPUT; el repository consulta después para completar el DTO, no inventa retornos del driver.

Existencia resultante de una acción se obtiene de **su movimiento**, no de un stock actual que pudo cambiar. Ningún proceso permite stock negativo, sobrepago, factura duplicada, borrado transaccional o pérdida de historial.
