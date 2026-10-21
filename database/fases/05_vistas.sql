/* FASE 05. Lecturas sin SELECT *. Todos los objetos permanecen en dbo.
   Primero proyecciones base normalizadas; despues vistas que las consumen. */
CREATE OR ALTER VIEW dbo.vw_Ordenes
AS
SELECT o.IdOrden,o.NumeroOrden,e.IdCliente,c.NombreMostrar AS ClienteNombre,
  o.IdEquipo,e.NumeroSerie,te.Nombre AS TipoEquipoNombre,m.Nombre AS MarcaNombre,e.Modelo,
  o.IdUsuarioRecepcion,u.NombreCompleto AS Recepcionista,o.FechaIngreso,o.ProblemaReportado,
  o.IdPrioridad,p.Nombre AS Prioridad,p.Nivel AS NivelPrioridad,
  o.IdEstadoOrden,eo.Codigo AS Estado,eo.Nombre AS EstadoNombre,eo.EsFinal,
  o.FechaEstimada,o.Observaciones
FROM dbo.OrdenServicio o JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo
JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente
JOIN dbo.TipoEquipo te ON te.IdTipoEquipo=e.IdTipoEquipo JOIN dbo.Marca m ON m.IdMarca=e.IdMarca
JOIN dbo.Usuario u ON u.IdUsuario=o.IdUsuarioRecepcion
JOIN dbo.Prioridad p ON p.IdPrioridad=o.IdPrioridad JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden;
GO
CREATE OR ALTER VIEW dbo.vw_Diagnosticos
AS
SELECT d.IdDiagnostico,d.IdOrden,d.IdTecnico,u.NombreCompleto AS TecnicoNombre,
  d.FechaDiagnostico,d.Descripcion,d.CostoManoObraEstimado,d.Estado
FROM dbo.Diagnostico d JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico;
GO
CREATE OR ALTER VIEW dbo.vw_Reparaciones
AS
SELECT r.IdReparacion,d.IdOrden,r.IdDiagnostico,r.IdTecnico,u.NombreCompleto AS TecnicoNombre,
  r.FechaInicio,r.FechaFin,r.Descripcion,r.CostoManoObra,r.Estado
FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico
JOIN dbo.Usuario u ON u.IdUsuario=r.IdTecnico;
GO
CREATE OR ALTER VIEW dbo.vw_Actividades
AS
SELECT a.IdActividad,a.IdReparacion,a.IdTecnico,u.NombreCompleto AS TecnicoNombre,
  a.Descripcion,a.FechaActividad,a.HorasInvertidas
FROM dbo.ActividadReparacion a JOIN dbo.Usuario u ON u.IdUsuario=a.IdTecnico;
GO
CREATE OR ALTER VIEW dbo.vw_Consumos
AS
SELECT rr.IdRepuestoReparacion,rr.IdReparacion,d.IdOrden,r.IdTecnico,u.NombreCompleto AS TecnicoNombre,
  rr.IdBodega,b.Nombre AS BodegaNombre,rr.IdRepuesto,rp.Codigo AS CodigoRepuesto,rp.Nombre AS RepuestoNombre,
  rr.Cantidad,rr.PrecioCostoUnitario,rr.PrecioVentaUnitario,rr.Subtotal,rr.FechaAsignacion,rr.IdUsuario,rr.Estado
FROM dbo.RepuestoReparacion rr JOIN dbo.Reparacion r ON r.IdReparacion=rr.IdReparacion
JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico JOIN dbo.Usuario u ON u.IdUsuario=r.IdTecnico
JOIN dbo.Bodega b ON b.IdBodega=rr.IdBodega JOIN dbo.Repuesto rp ON rp.IdRepuesto=rr.IdRepuesto;
GO
CREATE OR ALTER VIEW dbo.vw_HistorialEstadoOrden
AS
SELECT h.IdHistorial,h.IdOrden,ea.Codigo AS EstadoAnterior,en.Codigo AS EstadoNuevo,
  h.FechaCambio,h.IdUsuario,u.NombreCompleto AS UsuarioNombre,h.Observacion
FROM dbo.HistorialEstadoOrden h LEFT JOIN dbo.EstadoOrden ea ON ea.IdEstadoOrden=h.IdEstadoAnterior
JOIN dbo.EstadoOrden en ON en.IdEstadoOrden=h.IdEstadoNuevo JOIN dbo.Usuario u ON u.IdUsuario=h.IdUsuario;
GO
CREATE OR ALTER VIEW dbo.vw_InventarioActual
AS
SELECT ib.IdBodega,b.Nombre AS BodegaNombre,r.IdCategoria,c.Nombre AS CategoriaNombre,
  ib.IdRepuesto,r.Codigo AS CodigoRepuesto,r.Nombre AS RepuestoNombre,
  ib.Existencia,ib.StockMinimo,CONVERT(BIT,CASE WHEN ib.Existencia<=ib.StockMinimo THEN 1 ELSE 0 END) AS BajoMinimo,
  CONVERT(BIT,CASE WHEN ib.Existencia=0 THEN 1 ELSE 0 END) AS SinStock,ib.FechaUltimoMovimiento
FROM dbo.InventarioBodega ib JOIN dbo.Bodega b ON b.IdBodega=ib.IdBodega
JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto JOIN dbo.CategoriaRepuesto c ON c.IdCategoria=r.IdCategoria;
GO
CREATE OR ALTER VIEW dbo.vw_Compras
AS
SELECT co.IdCompra,co.NumeroCompra,co.IdProveedor,p.Nombre AS ProveedorNombre,
  co.IdBodegaDestino,b.Nombre AS BodegaNombre,co.IdUsuarioRegistro,co.FechaCompra,
  co.FechaRecepcion,co.IdUsuarioRecepcion,co.NumeroDocumentoProveedor,co.Estado,co.Observaciones,
  CONVERT(DECIMAL(14,2),ISNULL(s.Total,0)) AS Total
FROM dbo.Compra co JOIN dbo.Proveedor p ON p.IdProveedor=co.IdProveedor
JOIN dbo.Bodega b ON b.IdBodega=co.IdBodegaDestino
OUTER APPLY (SELECT SUM(dc.Subtotal) AS Total FROM dbo.DetalleCompra dc WHERE dc.IdCompra=co.IdCompra) s;
GO
CREATE OR ALTER VIEW dbo.vw_DetalleCompra
AS
SELECT dc.IdDetalleCompra,dc.IdCompra,dc.IdRepuesto,r.Codigo AS CodigoRepuesto,r.Nombre AS RepuestoNombre,
  dc.Cantidad,dc.CostoUnitario,dc.Subtotal
FROM dbo.DetalleCompra dc JOIN dbo.Repuesto r ON r.IdRepuesto=dc.IdRepuesto;
GO
CREATE OR ALTER VIEW dbo.vw_Facturas
AS
SELECT f.IdFactura,f.NumeroFactura,f.IdOrden,o.NumeroOrden,e.IdCliente,c.NombreMostrar AS ClienteNombre,
  f.NITFacturacion,f.NombreFacturacion,f.DireccionFacturacion,f.FechaFactura,
  f.SubtotalManoObra,f.SubtotalRepuestos,f.PorcentajeImpuesto,f.Subtotal,f.Impuesto,f.Total,f.Estado,
  CONVERT(DECIMAL(12,2),ISNULL(p.TotalPagado,0)) AS TotalPagado,ISNULL(p.CantidadPagos,0) AS CantidadPagos,
  CONVERT(DECIMAL(12,2),CASE WHEN f.Estado='ANULADA' THEN 0 ELSE f.Total-ISNULL(p.TotalPagado,0) END) AS Saldo
FROM dbo.Factura f JOIN dbo.OrdenServicio o ON o.IdOrden=f.IdOrden
JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente
LEFT JOIN (SELECT IdFactura,SUM(Monto) AS TotalPagado,COUNT(*) AS CantidadPagos FROM dbo.Pago WHERE Estado='APLICADO' GROUP BY IdFactura) p ON p.IdFactura=f.IdFactura;
GO
CREATE OR ALTER VIEW dbo.vw_FacturaSaldo
AS
SELECT IdFactura,NumeroFactura,IdOrden,NumeroOrden,IdCliente,ClienteNombre,FechaFactura,Estado,
  NITFacturacion,NombreFacturacion,SubtotalManoObra,SubtotalRepuestos,PorcentajeImpuesto,
  Subtotal,Impuesto,Total,TotalPagado,CantidadPagos,Saldo
FROM dbo.vw_Facturas;
GO
CREATE OR ALTER VIEW dbo.vw_DetalleFactura
AS
SELECT df.IdDetalleFactura,df.IdFactura,df.TipoLinea,df.IdReparacion,df.IdRepuestoReparacion,
  df.Descripcion,df.Cantidad,df.PrecioUnitario,df.Subtotal
FROM dbo.DetalleFactura df;
GO
CREATE OR ALTER VIEW dbo.vw_Pagos
AS
SELECT p.IdPago,p.IdFactura,p.IdMetodoPago,m.Nombre AS MetodoPagoNombre,p.Monto,p.FechaPago,p.Referencia,
  p.IdUsuario,u.NombreCompleto AS UsuarioNombre,p.Estado,p.MotivoAnulacion
FROM dbo.Pago p JOIN dbo.MetodoPago m ON m.IdMetodoPago=p.IdMetodoPago JOIN dbo.Usuario u ON u.IdUsuario=p.IdUsuario;
GO
CREATE OR ALTER VIEW dbo.vw_Entregas
AS
SELECT en.IdEntrega,en.IdOrden,en.IdUsuarioEntrega,u.NombreCompleto AS UsuarioEntregaNombre,
  en.NombreRecibe,en.DocumentoRecibe,en.FechaEntrega,en.Observaciones
FROM dbo.Entrega en JOIN dbo.Usuario u ON u.IdUsuario=en.IdUsuarioEntrega;
GO
CREATE OR ALTER VIEW dbo.vw_OrdenesActivas
AS
SELECT o.IdOrden,o.NumeroOrden,o.IdCliente,o.ClienteNombre,o.IdEquipo,o.NumeroSerie,o.TipoEquipoNombre,
  o.MarcaNombre,o.Modelo,o.FechaIngreso,o.FechaEstimada,o.Estado,o.IdPrioridad,o.Prioridad,o.NivelPrioridad,
  t.IdTecnico,t.TecnicoNombre AS TecnicoResponsable
FROM dbo.vw_Ordenes o OUTER APPLY (
  SELECT TOP (1) x.IdTecnico,x.TecnicoNombre FROM (
    SELECT r.IdTecnico,r.TecnicoNombre,r.FechaInicio AS Fecha,r.IdReparacion AS Registro,1 AS Prioridad
    FROM dbo.vw_Reparaciones r WHERE r.IdOrden=o.IdOrden AND r.Estado<>'CANCELADA'
    UNION ALL
    SELECT d.IdTecnico,u.NombreCompleto,d.FechaDiagnostico,d.IdDiagnostico,2
    FROM dbo.Diagnostico d JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico WHERE d.IdOrden=o.IdOrden AND d.Estado='ACTIVO'
  ) x ORDER BY x.Prioridad,x.Fecha DESC,x.Registro DESC
) t WHERE o.EsFinal=0;
GO
CREATE OR ALTER VIEW dbo.vw_MovimientosInventario
AS
SELECT mi.IdMovimiento,mi.IdBodega,b.Nombre AS BodegaNombre,mi.IdRepuesto,rp.Codigo AS CodigoRepuesto,
  rp.Nombre AS RepuestoNombre,tm.Codigo AS CodigoTipoMovimiento,tm.Naturaleza,mi.Cantidad,
  mi.FechaMovimiento,mi.IdUsuario,u.NombreCompleto AS UsuarioNombre,mi.DocumentoOrigen,
  COALESCE(co.NumeroCompra,os.NumeroOrden,'AJUSTE') AS NumeroDocumento,
  mi.IdDetalleCompra,mi.IdRepuestoReparacion,mi.ExistenciaResultante,mi.Observacion
FROM dbo.MovimientoInventario mi JOIN dbo.Bodega b ON b.IdBodega=mi.IdBodega
JOIN dbo.Repuesto rp ON rp.IdRepuesto=mi.IdRepuesto JOIN dbo.TipoMovimiento tm ON tm.IdTipoMovimiento=mi.IdTipoMovimiento
JOIN dbo.Usuario u ON u.IdUsuario=mi.IdUsuario
LEFT JOIN dbo.DetalleCompra dc ON dc.IdDetalleCompra=mi.IdDetalleCompra LEFT JOIN dbo.Compra co ON co.IdCompra=dc.IdCompra
LEFT JOIN dbo.RepuestoReparacion rr ON rr.IdRepuestoReparacion=mi.IdRepuestoReparacion
LEFT JOIN dbo.Reparacion re ON re.IdReparacion=rr.IdReparacion
LEFT JOIN dbo.Diagnostico dg ON dg.IdDiagnostico=re.IdDiagnostico LEFT JOIN dbo.OrdenServicio os ON os.IdOrden=dg.IdOrden;
GO
/* Grano: orden/diagnostico/reparacion/consumo/movimiento. Cabeceras financieras
   pueden repetirse: NO sumar TotalFactura/TotalPagado sobre estas filas. */
CREATE OR ALTER VIEW dbo.vw_TrazabilidadOrden
AS
SELECT o.IdOrden,o.NumeroOrden,o.FechaIngreso,o.ProblemaReportado,o.Estado AS EstadoOrden,
  o.Prioridad,o.IdCliente,o.ClienteNombre,o.IdEquipo,o.NumeroSerie,o.TipoEquipoNombre,o.MarcaNombre,o.Modelo,o.Recepcionista,
  d.IdDiagnostico,d.FechaDiagnostico,d.Descripcion AS Diagnostico,d.Estado AS EstadoDiagnostico,
  td.NombreCompleto AS TecnicoDiagnostico,r.IdReparacion,r.FechaInicio,r.FechaFin,r.Estado AS EstadoReparacion,r.CostoManoObra,
  tr.NombreCompleto AS TecnicoReparacion,rr.IdRepuestoReparacion,rr.IdBodega,rr.IdRepuesto,
  rp.Codigo AS CodigoRepuesto,rp.Nombre AS RepuestoNombre,rr.Cantidad,rr.PrecioCostoUnitario,rr.PrecioVentaUnitario,rr.Subtotal AS SubtotalRepuesto,
  mi.IdMovimiento,mi.FechaMovimiento,mi.ExistenciaResultante,
  f.IdFactura,f.NumeroFactura,f.Estado AS EstadoFactura,f.Total AS TotalFactura,f.TotalPagado,f.Saldo AS SaldoPendiente,
  en.FechaEntrega,en.NombreRecibe
FROM dbo.vw_Ordenes o LEFT JOIN dbo.Diagnostico d ON d.IdOrden=o.IdOrden
LEFT JOIN dbo.Usuario td ON td.IdUsuario=d.IdTecnico LEFT JOIN dbo.Reparacion r ON r.IdDiagnostico=d.IdDiagnostico
LEFT JOIN dbo.Usuario tr ON tr.IdUsuario=r.IdTecnico LEFT JOIN dbo.RepuestoReparacion rr ON rr.IdReparacion=r.IdReparacion
LEFT JOIN dbo.Repuesto rp ON rp.IdRepuesto=rr.IdRepuesto
LEFT JOIN dbo.MovimientoInventario mi ON mi.IdRepuestoReparacion=rr.IdRepuestoReparacion
LEFT JOIN dbo.vw_Facturas f ON f.IdOrden=o.IdOrden LEFT JOIN dbo.Entrega en ON en.IdOrden=o.IdOrden;
GO
CREATE OR ALTER VIEW dbo.vw_IngresosFacturadosMensual
AS
SELECT YEAR(f.FechaFactura) AS Anio,MONTH(f.FechaFactura) AS Mes,COUNT(*) AS CantidadFacturas,
  SUM(f.SubtotalManoObra) AS TotalManoObra,SUM(f.SubtotalRepuestos) AS TotalRepuestos,
  SUM(f.Subtotal) AS Subtotal,SUM(f.Impuesto) AS Impuesto,SUM(f.Total) AS Total
FROM dbo.Factura f WHERE f.Estado<>'ANULADA' GROUP BY YEAR(f.FechaFactura),MONTH(f.FechaFactura);
GO
CREATE OR ALTER VIEW dbo.vw_DashboardResumen
AS
SELECT
 (SELECT COUNT(*) FROM dbo.vw_Ordenes WHERE EsFinal=0) AS OrdenesAbiertas,
 (SELECT COUNT(*) FROM dbo.vw_Ordenes WHERE Estado='DIAGNOSTICO') AS OrdenesEnDiagnostico,
 (SELECT COUNT(*) FROM dbo.vw_Ordenes WHERE Estado='REPARACION') AS OrdenesEnReparacion,
 (SELECT COUNT(*) FROM dbo.vw_Ordenes WHERE Estado='LISTO') AS OrdenesListas,
 (SELECT COUNT(*) FROM dbo.vw_FacturaSaldo WHERE Estado='EMITIDA' AND Saldo>0) AS FacturasConSaldo,
 (SELECT COUNT(*) FROM dbo.vw_InventarioActual WHERE BajoMinimo=1) AS RepuestosBajoMinimo;
GO
CREATE OR ALTER VIEW dbo.vw_ActividadReciente
AS
SELECT 'ESTADO_ORDEN' AS Tipo,'Orden '+o.NumeroOrden+': '+e.Nombre AS Descripcion,h.FechaCambio AS Fecha
FROM dbo.HistorialEstadoOrden h JOIN dbo.OrdenServicio o ON o.IdOrden=h.IdOrden
JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=h.IdEstadoNuevo
UNION ALL
SELECT 'MOVIMIENTO_INVENTARIO','Inventario '+r.Codigo+': '+t.Nombre,m.FechaMovimiento
FROM dbo.MovimientoInventario m JOIN dbo.Repuesto r ON r.IdRepuesto=m.IdRepuesto
JOIN dbo.TipoMovimiento t ON t.IdTipoMovimiento=m.IdTipoMovimiento;
GO
