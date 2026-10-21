/* FASE 10. Roles de motor, distintos a Rol/UsuarioRol de la app.
   No crea usuarios, logins ni secretos. Wilson asigna miembros por separado.
   Un solo dbo: permisos por objeto, no EXECUTE/SELECT sobre el esquema completo. */
IF DATABASE_PRINCIPAL_ID(N'tc_runtime') IS NULL EXEC(N'CREATE ROLE tc_runtime AUTHORIZATION dbo;');
IF DATABASE_PRINCIPAL_ID(N'tc_lectura') IS NULL EXEC(N'CREATE ROLE tc_lectura AUTHORIZATION dbo;');
GO
GRANT EXECUTE ON OBJECT::dbo.sp_CambiarEstadoOrden TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RegistrarOrdenServicio TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RegistrarDiagnostico TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_IniciarReparacion TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_FinalizarReparacion TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_AsignarRepuestoReparacion TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RegistrarCompra TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RecibirCompra TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_AjustarInventario TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_GenerarFactura TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RegistrarPago TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_AnularPago TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_EntregarOrden TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.usp_RegistrarActividad TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.usp_CambiarStockMinimo TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.usp_ActualizarPreciosRepuesto TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_UsuarioTieneRol TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_UsuarioTienePermiso TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_SaldoFactura TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_TotalManoObraOrden TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_TotalRepuestosOrden TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_TotalOrden TO tc_runtime;
GRANT EXECUTE ON TYPE::dbo.tvp_DetalleCompra TO tc_runtime;
GRANT REFERENCES ON TYPE::dbo.tvp_DetalleCompra TO tc_runtime;

GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Usuario TO tc_runtime;
GRANT SELECT,INSERT,DELETE ON OBJECT::dbo.UsuarioRol TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.Rol TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.Permiso TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.RolPermiso TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Cliente TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Equipo TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.TipoEquipo TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Marca TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.CategoriaRepuesto TO tc_runtime;
GRANT SELECT,INSERT ON OBJECT::dbo.Repuesto TO tc_runtime;
GRANT UPDATE(Nombre,Descripcion,IdCategoria,Estado) ON OBJECT::dbo.Repuesto TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Bodega TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Proveedor TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.MetodoPago TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.Prioridad TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.EstadoOrden TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.TipoMovimiento TO tc_runtime;

-- Lecturas seguras. Las vistas normalizadas exponen IDs derivados para la API.
GRANT SELECT ON OBJECT::dbo.vw_Ordenes TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Diagnosticos TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Reparaciones TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Actividades TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Consumos TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_HistorialEstadoOrden TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_InventarioActual TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Compras TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_DetalleCompra TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Facturas TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_FacturaSaldo TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_DetalleFactura TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Pagos TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Entregas TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_OrdenesActivas TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_MovimientosInventario TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_TrazabilidadOrden TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_IngresosFacturadosMensual TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_DashboardResumen TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_ActividadReciente TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.fn_HistorialEquipo TO tc_runtime;

-- Un rol comun de reportes puede asignarse tambien al runtime.
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteOrdenesActivas TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteHistorialCliente TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteHistorialEquipo TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteActividadTecnico TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteRepuestosUtilizados TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteInventario TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteBajoMinimo TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteComprasProveedor TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteMovimientos TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteFacturasSaldo TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteIngresos TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteTrazabilidad TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_OrdenesActivas TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_InventarioActual TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_FacturaSaldo TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_MovimientosInventario TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_TrazabilidadOrden TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_IngresosFacturadosMensual TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_DashboardResumen TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_ActividadReciente TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.fn_HistorialEquipo TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.TipoEquipo TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.Marca TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.Prioridad TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.EstadoOrden TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.CategoriaRepuesto TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.Bodega TO tc_lectura;
ALTER ROLE tc_lectura ADD MEMBER tc_runtime;

DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.OrdenServicio TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.HistorialEstadoOrden TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Diagnostico TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Reparacion TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.ActividadReparacion TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.InventarioBodega TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.RepuestoReparacion TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.MovimientoInventario TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Compra TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.DetalleCompra TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Factura TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.DetalleFactura TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Pago TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Entrega TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.AuditoriaPrecioRepuesto TO tc_runtime;
GO
