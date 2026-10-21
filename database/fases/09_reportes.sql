/* FASE 09. Doce consultas de negocio parametrizadas. Limites de fecha UTC
   [Desde,HastaExclusiva); Nest convierte los dias civiles de Guatemala.
   Sin DISTINCT correctivo. Cabeceras/detalles en resultsets separados donde aplica. */
CREATE OR ALTER PROCEDURE dbo.usp_ReporteOrdenesActivas
 @Estado VARCHAR(30)=NULL,@IdPrioridad INT=NULL,@IdTecnico INT=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 SELECT o.IdOrden,o.NumeroOrden,o.FechaIngreso,o.FechaEstimada,eo.Codigo AS Estado,p.Nombre AS Prioridad,
  c.NombreMostrar AS ClienteNombre,e.NumeroSerie,te.Nombre AS TipoEquipo,m.Nombre AS Marca,tec.IdTecnico,tec.TecnicoResponsable
 FROM dbo.OrdenServicio o JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente
 JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden JOIN dbo.Prioridad p ON p.IdPrioridad=o.IdPrioridad
 JOIN dbo.TipoEquipo te ON te.IdTipoEquipo=e.IdTipoEquipo JOIN dbo.Marca m ON m.IdMarca=e.IdMarca
 JOIN dbo.vw_OrdenesActivas tec ON tec.IdOrden=o.IdOrden
 WHERE eo.EsFinal=0 AND (@Estado IS NULL OR eo.Codigo=@Estado) AND (@IdPrioridad IS NULL OR o.IdPrioridad=@IdPrioridad)
  AND (@IdTecnico IS NULL OR tec.IdTecnico=@IdTecnico) AND (@Desde IS NULL OR o.FechaIngreso>=@Desde)
  AND (@HastaExclusiva IS NULL OR o.FechaIngreso<@HastaExclusiva)
 ORDER BY p.Nivel DESC,o.FechaIngreso,o.IdOrden;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteHistorialCliente
 @IdCliente INT,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 -- Preserva cliente sin ordenes. Grano de segundo resultset: orden/diagnostico.
 SELECT IdCliente,NombreMostrar,TipoCliente,NIT FROM dbo.Cliente WHERE IdCliente=@IdCliente;
 SELECT c.IdCliente,e.IdEquipo,e.NumeroSerie,o.IdOrden,o.NumeroOrden,o.FechaIngreso,eo.Codigo AS Estado,
  p.Nombre AS Prioridad,d.IdDiagnostico,d.Descripcion AS Diagnostico,u.NombreCompleto AS Tecnico,f.NumeroFactura,f.Total AS TotalFactura
 FROM dbo.Cliente c LEFT JOIN dbo.Equipo e ON e.IdCliente=c.IdCliente LEFT JOIN dbo.OrdenServicio o ON o.IdEquipo=e.IdEquipo
  AND (@Desde IS NULL OR o.FechaIngreso>=@Desde) AND (@HastaExclusiva IS NULL OR o.FechaIngreso<@HastaExclusiva)
 LEFT JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden LEFT JOIN dbo.Prioridad p ON p.IdPrioridad=o.IdPrioridad
 LEFT JOIN dbo.Diagnostico d ON d.IdOrden=o.IdOrden LEFT JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico
 LEFT JOIN dbo.Factura f ON f.IdOrden=o.IdOrden WHERE c.IdCliente=@IdCliente ORDER BY o.FechaIngreso DESC,o.IdOrden DESC,d.IdDiagnostico;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteHistorialEquipo @NumeroSerie VARCHAR(60)
AS
BEGIN
 SET NOCOUNT ON;
 SELECT e.IdEquipo,e.NumeroSerie,e.Modelo,t.Nombre AS TipoEquipo,m.Nombre AS Marca,c.NombreMostrar AS ClienteNombre
 FROM dbo.Equipo e JOIN dbo.TipoEquipo t ON t.IdTipoEquipo=e.IdTipoEquipo JOIN dbo.Marca m ON m.IdMarca=e.IdMarca
 JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente WHERE e.NumeroSerie=@NumeroSerie;
 SELECT IdEquipo,NumeroSerie,IdOrden,NumeroOrden,FechaIngreso,ProblemaReportado,EstadoOrden,IdDiagnostico,
  Diagnostico,EstadoDiagnostico,TecnicoDiagnostico,TotalManoObra,TotalRepuestos,IdFactura,NumeroFactura,TotalFactura,FechaEntrega
 FROM dbo.fn_HistorialEquipo(@NumeroSerie) ORDER BY FechaIngreso DESC,IdOrden DESC,IdDiagnostico;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteActividadTecnico
 @IdTecnico INT,@Desde DATETIME2(0),@HastaExclusiva DATETIME2(0)
AS
BEGIN
 SET NOCOUNT ON;
 IF @Desde IS NULL OR @HastaExclusiva IS NULL OR @Desde>=@HastaExclusiva THROW 51700,N'Intervalo de fechas no valido.',1;
 SELECT 'DIAGNOSTICO' AS Tipo,d.IdDiagnostico AS IdRegistro,o.IdOrden,o.NumeroOrden,e.NumeroSerie,
  u.IdUsuario AS IdTecnico,u.NombreCompleto AS TecnicoNombre,d.FechaDiagnostico AS Fecha,d.Descripcion,d.CostoManoObraEstimado AS Costo,d.Estado
 FROM dbo.Diagnostico d JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico JOIN dbo.OrdenServicio o ON o.IdOrden=d.IdOrden
 JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo WHERE d.IdTecnico=@IdTecnico AND d.FechaDiagnostico>=@Desde AND d.FechaDiagnostico<@HastaExclusiva
 UNION ALL
 SELECT 'REPARACION',r.IdReparacion,o.IdOrden,o.NumeroOrden,e.NumeroSerie,u.IdUsuario,u.NombreCompleto,r.FechaInicio,r.Descripcion,r.CostoManoObra,r.Estado
 FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico JOIN dbo.OrdenServicio o ON o.IdOrden=d.IdOrden
 JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo JOIN dbo.Usuario u ON u.IdUsuario=r.IdTecnico
 WHERE r.IdTecnico=@IdTecnico AND r.FechaInicio>=@Desde AND r.FechaInicio<@HastaExclusiva ORDER BY Fecha,Tipo,IdRegistro;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteRepuestosUtilizados
 @IdOrden INT=NULL,@IdTecnico INT=NULL,@IdBodega INT=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 SELECT rr.IdRepuestoReparacion,o.IdOrden,o.NumeroOrden,r.IdReparacion,u.IdUsuario AS IdTecnico,u.NombreCompleto AS TecnicoNombre,
  b.IdBodega,b.Nombre AS BodegaNombre,rp.Codigo,rp.Nombre AS RepuestoNombre,rr.Cantidad,rr.PrecioCostoUnitario,rr.PrecioVentaUnitario,rr.Subtotal,rr.Estado
 FROM dbo.RepuestoReparacion rr JOIN dbo.Reparacion r ON r.IdReparacion=rr.IdReparacion
 JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico JOIN dbo.OrdenServicio o ON o.IdOrden=d.IdOrden
 JOIN dbo.Usuario u ON u.IdUsuario=r.IdTecnico JOIN dbo.Bodega b ON b.IdBodega=rr.IdBodega JOIN dbo.Repuesto rp ON rp.IdRepuesto=rr.IdRepuesto
 WHERE (@IdOrden IS NULL OR o.IdOrden=@IdOrden) AND (@IdTecnico IS NULL OR r.IdTecnico=@IdTecnico)
  AND (@IdBodega IS NULL OR b.IdBodega=@IdBodega) AND (@Desde IS NULL OR rr.FechaAsignacion>=@Desde)
  AND (@HastaExclusiva IS NULL OR rr.FechaAsignacion<@HastaExclusiva) ORDER BY o.IdOrden,r.IdReparacion,rr.IdRepuestoReparacion;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteInventario @IdBodega INT=NULL,@IdCategoria INT=NULL,@IdRepuesto INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 SELECT ib.IdBodega,b.Nombre AS BodegaNombre,c.IdCategoria,c.Nombre AS CategoriaNombre,r.IdRepuesto,r.Codigo,r.Nombre AS RepuestoNombre,
  ib.Existencia,ib.StockMinimo,ib.FechaUltimoMovimiento
 FROM dbo.InventarioBodega ib JOIN dbo.Bodega b ON b.IdBodega=ib.IdBodega JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto
 JOIN dbo.CategoriaRepuesto c ON c.IdCategoria=r.IdCategoria WHERE (@IdBodega IS NULL OR ib.IdBodega=@IdBodega)
  AND (@IdCategoria IS NULL OR c.IdCategoria=@IdCategoria) AND (@IdRepuesto IS NULL OR r.IdRepuesto=@IdRepuesto) ORDER BY b.IdBodega,c.IdCategoria,r.Codigo;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteBajoMinimo @IdBodega INT=NULL,@IdCategoria INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 SELECT ib.IdBodega,b.Nombre AS BodegaNombre,c.Nombre AS CategoriaNombre,r.IdRepuesto,r.Codigo,r.Nombre AS RepuestoNombre,ib.Existencia,ib.StockMinimo
 FROM dbo.InventarioBodega ib JOIN dbo.Bodega b ON b.IdBodega=ib.IdBodega JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto
 JOIN dbo.CategoriaRepuesto c ON c.IdCategoria=r.IdCategoria
 WHERE ib.Existencia<=ib.StockMinimo AND (@IdBodega IS NULL OR b.IdBodega=@IdBodega) AND (@IdCategoria IS NULL OR c.IdCategoria=@IdCategoria)
 ORDER BY ib.Existencia,b.IdBodega,r.Codigo;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteComprasProveedor
 @IdProveedor INT=NULL,@IdBodega INT=NULL,@Estado VARCHAR(10)=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 SELECT co.IdCompra,co.NumeroCompra,co.FechaCompra,co.Estado,p.IdProveedor,p.Nombre AS ProveedorNombre,b.Nombre AS BodegaNombre,
  u.NombreCompleto AS UsuarioRegistro,dc.IdDetalleCompra,r.Codigo,r.Nombre AS RepuestoNombre,dc.Cantidad,dc.CostoUnitario,dc.Subtotal
 FROM dbo.Compra co JOIN dbo.Proveedor p ON p.IdProveedor=co.IdProveedor JOIN dbo.Bodega b ON b.IdBodega=co.IdBodegaDestino
 JOIN dbo.Usuario u ON u.IdUsuario=co.IdUsuarioRegistro JOIN dbo.DetalleCompra dc ON dc.IdCompra=co.IdCompra JOIN dbo.Repuesto r ON r.IdRepuesto=dc.IdRepuesto
 WHERE (@IdProveedor IS NULL OR co.IdProveedor=@IdProveedor) AND (@IdBodega IS NULL OR co.IdBodegaDestino=@IdBodega)
  AND (@Estado IS NULL OR co.Estado=@Estado) AND (@Desde IS NULL OR co.FechaCompra>=@Desde)
  AND (@HastaExclusiva IS NULL OR co.FechaCompra<@HastaExclusiva) ORDER BY co.FechaCompra DESC,co.IdCompra,dc.IdDetalleCompra;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteMovimientos
 @IdBodega INT=NULL,@IdRepuesto INT=NULL,@CodigoTipo VARCHAR(30)=NULL,@IdUsuario INT=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 SELECT m.IdMovimiento,m.FechaMovimiento,m.IdBodega,m.BodegaNombre,m.IdRepuesto,m.CodigoRepuesto,m.RepuestoNombre,
  t.Nombre AS TipoMovimiento,m.Naturaleza,m.Cantidad,m.ExistenciaResultante,m.DocumentoOrigen,m.NumeroDocumento,m.UsuarioNombre,m.Observacion
 FROM dbo.vw_MovimientosInventario m JOIN dbo.TipoMovimiento t ON t.Codigo=m.CodigoTipoMovimiento
 WHERE (@IdBodega IS NULL OR m.IdBodega=@IdBodega) AND (@IdRepuesto IS NULL OR m.IdRepuesto=@IdRepuesto)
  AND (@CodigoTipo IS NULL OR m.CodigoTipoMovimiento=@CodigoTipo) AND (@IdUsuario IS NULL OR m.IdUsuario=@IdUsuario)
  AND (@Desde IS NULL OR m.FechaMovimiento>=@Desde) AND (@HastaExclusiva IS NULL OR m.FechaMovimiento<@HastaExclusiva)
 ORDER BY m.IdMovimiento DESC;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteFacturasSaldo
 @IdCliente INT=NULL,@ConSaldo BIT=1,@Estado VARCHAR(10)=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 SELECT f.IdFactura,f.NumeroFactura,f.IdOrden,f.NumeroOrden,f.ClienteNombre,f.FechaFactura,f.Estado,f.Total,f.TotalPagado,f.Saldo
 FROM dbo.vw_FacturaSaldo f JOIN dbo.Cliente c ON c.IdCliente=f.IdCliente
 WHERE (@IdCliente IS NULL OR c.IdCliente=@IdCliente) AND (@ConSaldo=0 OR f.Saldo>0) AND (@Estado IS NULL OR f.Estado=@Estado)
  AND (@Desde IS NULL OR f.FechaFactura>=@Desde) AND (@HastaExclusiva IS NULL OR f.FechaFactura<@HastaExclusiva)
 ORDER BY f.FechaFactura DESC,f.IdFactura;
 SELECT p.IdPago,p.IdFactura,p.FechaPago,p.Monto,mp.Nombre AS MetodoPago,p.Referencia,p.Estado,u.NombreCompleto AS UsuarioNombre
 FROM dbo.Pago p JOIN dbo.MetodoPago mp ON mp.IdMetodoPago=p.IdMetodoPago JOIN dbo.Usuario u ON u.IdUsuario=p.IdUsuario
 JOIN dbo.vw_FacturaSaldo f ON f.IdFactura=p.IdFactura WHERE (@IdCliente IS NULL OR f.IdCliente=@IdCliente)
  AND (@ConSaldo=0 OR f.Saldo>0) AND (@Estado IS NULL OR f.Estado=@Estado)
  AND (@Desde IS NULL OR f.FechaFactura>=@Desde) AND (@HastaExclusiva IS NULL OR f.FechaFactura<@HastaExclusiva)
 ORDER BY p.IdFactura,p.FechaPago,p.IdPago;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteIngresos
 @Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL,@IdCliente INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 -- Grano factura antes de agrupar: no JOIN directo con pagos ni lineas 1:N.
 SELECT YEAR(f.FechaFactura) AS Anio,MONTH(f.FechaFactura) AS Mes,COUNT(*) AS CantidadFacturas,
  SUM(f.SubtotalManoObra) AS TotalManoObra,SUM(f.SubtotalRepuestos) AS TotalRepuestos,
  SUM(f.Subtotal) AS Subtotal,SUM(f.Impuesto) AS Impuesto,SUM(f.Total) AS Total
 FROM dbo.Factura f JOIN dbo.OrdenServicio o ON o.IdOrden=f.IdOrden JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo
 JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente WHERE f.Estado<>'ANULADA'
  AND (@IdCliente IS NULL OR c.IdCliente=@IdCliente) AND (@Desde IS NULL OR f.FechaFactura>=@Desde)
  AND (@HastaExclusiva IS NULL OR f.FechaFactura<@HastaExclusiva)
 GROUP BY YEAR(f.FechaFactura),MONTH(f.FechaFactura) ORDER BY Anio,Mes;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteTrazabilidad @IdOrden INT
AS
BEGIN
 SET NOCOUNT ON;
 -- Resultset plano de trazabilidad + pagos separados: no producto pagos/consumos.
 SELECT t.IdOrden,t.NumeroOrden,t.FechaIngreso,t.EstadoOrden,t.ClienteNombre,t.NumeroSerie,t.Recepcionista,
  t.IdDiagnostico,t.Diagnostico,t.EstadoDiagnostico,t.TecnicoDiagnostico,t.IdReparacion,t.EstadoReparacion,t.TecnicoReparacion,
  t.IdRepuestoReparacion,t.CodigoRepuesto,t.Cantidad,t.PrecioCostoUnitario,t.PrecioVentaUnitario,t.IdMovimiento,t.ExistenciaResultante,
  t.IdFactura,t.NumeroFactura,t.TotalFactura,t.TotalPagado,t.SaldoPendiente,t.FechaEntrega,t.NombreRecibe
 FROM dbo.vw_TrazabilidadOrden t JOIN dbo.OrdenServicio o ON o.IdOrden=t.IdOrden WHERE t.IdOrden=@IdOrden
 ORDER BY t.IdDiagnostico,t.IdReparacion,t.IdRepuestoReparacion,t.IdMovimiento;
 SELECT p.IdPago,p.FechaPago,p.Monto,p.MetodoPagoNombre,p.Estado,p.UsuarioNombre FROM dbo.vw_Pagos p
 JOIN dbo.Factura f ON f.IdFactura=p.IdFactura WHERE f.IdOrden=@IdOrden ORDER BY p.IdPago;
 SELECT h.IdHistorial,h.EstadoAnterior,h.EstadoNuevo,h.FechaCambio,h.UsuarioNombre,h.Observacion
 FROM dbo.vw_HistorialEstadoOrden h JOIN dbo.OrdenServicio o ON o.IdOrden=h.IdOrden WHERE h.IdOrden=@IdOrden ORDER BY h.IdHistorial;
END;
GO
