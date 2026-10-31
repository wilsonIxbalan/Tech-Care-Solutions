/* FASE 09. Doce consultas de negocio parametrizadas. Limites de fecha UTC
   [Desde,HastaExclusiva); Nest convierte los dias civiles de Guatemala.
   Sin DISTINCT correctivo. Cabeceras/detalles en resultsets separados donde aplica.
   @Page NULL conserva los resultsets originales, sin metadata.
   @MaxRows limita la suma completa filtrada, incluidos hijos, antes de devolver datos.
   Las temporales fijan el conjunto contado y devuelto. Search es substring literal
   CI/AS de strings publicas, decimales con dos lugares y fechas ISO UTC. */
CREATE OR ALTER PROCEDURE dbo.usp_ReporteOrdenesActivas
 @Estado VARCHAR(30)=NULL,@IdPrioridad INT=NULL,@IdTecnico INT=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL,
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT o.IdOrden,o.NumeroOrden,o.FechaIngreso,o.FechaEstimada,eo.Codigo AS Estado,p.Nombre AS Prioridad,
  c.NombreMostrar AS ClienteNombre,e.NumeroSerie,te.Nombre AS TipoEquipo,m.Nombre AS Marca,tec.IdTecnico,tec.TecnicoResponsable,
  p.Nivel AS OrdenNivel
 INTO #Filas
 FROM dbo.OrdenServicio o JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente
 JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden JOIN dbo.Prioridad p ON p.IdPrioridad=o.IdPrioridad
 JOIN dbo.TipoEquipo te ON te.IdTipoEquipo=e.IdTipoEquipo JOIN dbo.Marca m ON m.IdMarca=e.IdMarca
 JOIN dbo.vw_OrdenesActivas tec ON tec.IdOrden=o.IdOrden
 WHERE eo.EsFinal=0 AND (@Estado IS NULL OR eo.Codigo=@Estado) AND (@IdPrioridad IS NULL OR o.IdPrioridad=@IdPrioridad)
  AND (@IdTecnico IS NULL OR tec.IdTecnico=@IdTecnico) AND (@Desde IS NULL OR o.FechaIngreso>=@Desde)
  AND (@HastaExclusiva IS NULL OR o.FechaIngreso<@HastaExclusiva);
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),r.NumeroOrden)),
  (CONVERT(NVARCHAR(MAX),CONVERT(NVARCHAR(19),r.FechaIngreso,126)+N'.000Z')),
  (CONVERT(NVARCHAR(MAX),CONVERT(NVARCHAR(10),r.FechaEstimada,23))),
  (CONVERT(NVARCHAR(MAX),r.Estado)),(CONVERT(NVARCHAR(MAX),r.Prioridad)),(CONVERT(NVARCHAR(MAX),r.ClienteNombre)),
  (CONVERT(NVARCHAR(MAX),r.NumeroSerie)),(CONVERT(NVARCHAR(MAX),r.TipoEquipo)),(CONVERT(NVARCHAR(MAX),r.Marca)),
  (CONVERT(NVARCHAR(MAX),r.TecnicoResponsable))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT IdOrden,NumeroOrden,FechaIngreso,FechaEstimada,Estado,Prioridad,ClienteNombre,NumeroSerie,TipoEquipo,Marca,IdTecnico,TecnicoResponsable
 FROM #Filas ORDER BY OrdenNivel DESC,FechaIngreso,IdOrden OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteHistorialCliente
 @IdCliente INT,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 -- Preserva cliente sin ordenes. Grano de segundo resultset: orden/diagnostico.
 SELECT IdCliente,NombreMostrar,TipoCliente,NIT INTO #Cliente FROM dbo.Cliente WHERE IdCliente=@IdCliente;
 SELECT c.IdCliente,e.IdEquipo,e.NumeroSerie,o.IdOrden,o.NumeroOrden,o.FechaIngreso,eo.Codigo AS Estado,
  p.Nombre AS Prioridad,d.IdDiagnostico,d.Descripcion AS Diagnostico,u.NombreCompleto AS Tecnico,f.NumeroFactura,f.Total AS TotalFactura
 INTO #Historial
 FROM dbo.Cliente c LEFT JOIN dbo.Equipo e ON e.IdCliente=c.IdCliente LEFT JOIN dbo.OrdenServicio o ON o.IdEquipo=e.IdEquipo
  AND (@Desde IS NULL OR o.FechaIngreso>=@Desde) AND (@HastaExclusiva IS NULL OR o.FechaIngreso<@HastaExclusiva)
 LEFT JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden LEFT JOIN dbo.Prioridad p ON p.IdPrioridad=o.IdPrioridad
 LEFT JOIN dbo.Diagnostico d ON d.IdOrden=o.IdOrden LEFT JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico
 LEFT JOIN dbo.Factura f ON f.IdOrden=o.IdOrden WHERE c.IdCliente=@IdCliente;
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Cliente)+(SELECT COUNT_BIG(*) FROM #Historial);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 SELECT IdCliente,NombreMostrar,TipoCliente,NIT FROM #Cliente;
 SELECT IdCliente,IdEquipo,NumeroSerie,IdOrden,NumeroOrden,FechaIngreso,Estado,Prioridad,IdDiagnostico,Diagnostico,Tecnico,NumeroFactura,TotalFactura
 FROM #Historial ORDER BY FechaIngreso DESC,IdOrden DESC,IdDiagnostico,IdEquipo;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteHistorialEquipo @NumeroSerie VARCHAR(60),@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT e.IdEquipo,e.NumeroSerie,e.Modelo,t.Nombre AS TipoEquipo,m.Nombre AS Marca,c.NombreMostrar AS ClienteNombre
 INTO #Equipo
 FROM dbo.Equipo e JOIN dbo.TipoEquipo t ON t.IdTipoEquipo=e.IdTipoEquipo JOIN dbo.Marca m ON m.IdMarca=e.IdMarca
 JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente WHERE e.NumeroSerie=@NumeroSerie;
 SELECT IdEquipo,NumeroSerie,IdOrden,NumeroOrden,FechaIngreso,ProblemaReportado,EstadoOrden,IdDiagnostico,
  Diagnostico,EstadoDiagnostico,TecnicoDiagnostico,TotalManoObra,TotalRepuestos,IdFactura,NumeroFactura,TotalFactura,FechaEntrega
 INTO #Historial FROM dbo.fn_HistorialEquipo(@NumeroSerie);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Equipo)+(SELECT COUNT_BIG(*) FROM #Historial);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 SELECT IdEquipo,NumeroSerie,Modelo,TipoEquipo,Marca,ClienteNombre FROM #Equipo;
 SELECT IdEquipo,NumeroSerie,IdOrden,NumeroOrden,FechaIngreso,ProblemaReportado,EstadoOrden,IdDiagnostico,
  Diagnostico,EstadoDiagnostico,TecnicoDiagnostico,TotalManoObra,TotalRepuestos,IdFactura,NumeroFactura,TotalFactura,FechaEntrega
 FROM #Historial ORDER BY FechaIngreso DESC,IdOrden DESC,IdDiagnostico;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteActividadTecnico
 @IdTecnico INT,@Desde DATETIME2(0),@HastaExclusiva DATETIME2(0),
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Desde IS NULL OR @HastaExclusiva IS NULL OR @Desde>=@HastaExclusiva THROW 51700,N'Intervalo de fechas no valido.',1;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT 'DIAGNOSTICO' AS Tipo,d.IdDiagnostico AS IdRegistro,o.IdOrden,o.NumeroOrden,e.NumeroSerie,
  u.IdUsuario AS IdTecnico,u.NombreCompleto AS TecnicoNombre,d.FechaDiagnostico AS Fecha,d.Descripcion,d.CostoManoObraEstimado AS Costo,d.Estado
 INTO #Filas
 FROM dbo.Diagnostico d JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico JOIN dbo.OrdenServicio o ON o.IdOrden=d.IdOrden
 JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo WHERE d.IdTecnico=@IdTecnico AND d.FechaDiagnostico>=@Desde AND d.FechaDiagnostico<@HastaExclusiva
 UNION ALL
 SELECT 'REPARACION',r.IdReparacion,o.IdOrden,o.NumeroOrden,e.NumeroSerie,u.IdUsuario,u.NombreCompleto,r.FechaInicio,r.Descripcion,r.CostoManoObra,r.Estado
 FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico JOIN dbo.OrdenServicio o ON o.IdOrden=d.IdOrden
 JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo JOIN dbo.Usuario u ON u.IdUsuario=r.IdTecnico
 WHERE r.IdTecnico=@IdTecnico AND r.FechaInicio>=@Desde AND r.FechaInicio<@HastaExclusiva;
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),r.Tipo)),(CONVERT(NVARCHAR(MAX),r.NumeroOrden)),(CONVERT(NVARCHAR(MAX),r.NumeroSerie)),
  (CONVERT(NVARCHAR(MAX),r.TecnicoNombre)),(CONVERT(NVARCHAR(MAX),CONVERT(NVARCHAR(19),r.Fecha,126)+N'.000Z')),
  (CONVERT(NVARCHAR(MAX),r.Descripcion)),(CONVERT(NVARCHAR(MAX),CAST(r.Costo AS DECIMAL(38,2)))),(CONVERT(NVARCHAR(MAX),r.Estado))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT Tipo,IdRegistro,IdOrden,NumeroOrden,NumeroSerie,IdTecnico,TecnicoNombre,Fecha,Descripcion,Costo,Estado
 FROM #Filas ORDER BY Fecha,Tipo,IdRegistro OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteRepuestosUtilizados
 @IdOrden INT=NULL,@IdTecnico INT=NULL,@IdBodega INT=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL,
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT rr.IdRepuestoReparacion,o.IdOrden,o.NumeroOrden,r.IdReparacion,u.IdUsuario AS IdTecnico,u.NombreCompleto AS TecnicoNombre,
  b.IdBodega,b.Nombre AS BodegaNombre,rp.Codigo,rp.Nombre AS RepuestoNombre,rr.Cantidad,rr.PrecioCostoUnitario,rr.PrecioVentaUnitario,rr.Subtotal,rr.Estado
 INTO #Filas
 FROM dbo.RepuestoReparacion rr JOIN dbo.Reparacion r ON r.IdReparacion=rr.IdReparacion
 JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico JOIN dbo.OrdenServicio o ON o.IdOrden=d.IdOrden
 JOIN dbo.Usuario u ON u.IdUsuario=r.IdTecnico JOIN dbo.Bodega b ON b.IdBodega=rr.IdBodega JOIN dbo.Repuesto rp ON rp.IdRepuesto=rr.IdRepuesto
 WHERE (@IdOrden IS NULL OR o.IdOrden=@IdOrden) AND (@IdTecnico IS NULL OR r.IdTecnico=@IdTecnico)
  AND (@IdBodega IS NULL OR b.IdBodega=@IdBodega) AND (@Desde IS NULL OR rr.FechaAsignacion>=@Desde)
  AND (@HastaExclusiva IS NULL OR rr.FechaAsignacion<@HastaExclusiva);
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),r.NumeroOrden)),(CONVERT(NVARCHAR(MAX),r.TecnicoNombre)),(CONVERT(NVARCHAR(MAX),r.BodegaNombre)),
  (CONVERT(NVARCHAR(MAX),r.Codigo)),(CONVERT(NVARCHAR(MAX),r.RepuestoNombre)),
  (CONVERT(NVARCHAR(MAX),CAST(r.PrecioCostoUnitario AS DECIMAL(38,2)))),(CONVERT(NVARCHAR(MAX),CAST(r.PrecioVentaUnitario AS DECIMAL(38,2)))),
  (CONVERT(NVARCHAR(MAX),CAST(r.Subtotal AS DECIMAL(38,2)))),(CONVERT(NVARCHAR(MAX),r.Estado))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT IdRepuestoReparacion,IdOrden,NumeroOrden,IdReparacion,IdTecnico,TecnicoNombre,IdBodega,BodegaNombre,Codigo,RepuestoNombre,Cantidad,PrecioCostoUnitario,PrecioVentaUnitario,Subtotal,Estado
 FROM #Filas ORDER BY IdOrden,IdReparacion,IdRepuestoReparacion OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteInventario @IdBodega INT=NULL,@IdCategoria INT=NULL,@IdRepuesto INT=NULL,
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT ib.IdBodega,b.Nombre AS BodegaNombre,c.IdCategoria,c.Nombre AS CategoriaNombre,r.IdRepuesto,r.Codigo,r.Nombre AS RepuestoNombre,
  ib.Existencia,ib.StockMinimo,ib.FechaUltimoMovimiento
 INTO #Filas
 FROM dbo.InventarioBodega ib JOIN dbo.Bodega b ON b.IdBodega=ib.IdBodega JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto
 JOIN dbo.CategoriaRepuesto c ON c.IdCategoria=r.IdCategoria WHERE (@IdBodega IS NULL OR ib.IdBodega=@IdBodega)
  AND (@IdCategoria IS NULL OR c.IdCategoria=@IdCategoria) AND (@IdRepuesto IS NULL OR r.IdRepuesto=@IdRepuesto);
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),r.BodegaNombre)),(CONVERT(NVARCHAR(MAX),r.CategoriaNombre)),(CONVERT(NVARCHAR(MAX),r.Codigo)),
  (CONVERT(NVARCHAR(MAX),r.RepuestoNombre)),(CONVERT(NVARCHAR(MAX),CONVERT(NVARCHAR(19),r.FechaUltimoMovimiento,126)+N'.000Z'))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT IdBodega,BodegaNombre,IdCategoria,CategoriaNombre,IdRepuesto,Codigo,RepuestoNombre,Existencia,StockMinimo,FechaUltimoMovimiento
 FROM #Filas ORDER BY IdBodega,IdCategoria,Codigo,IdRepuesto OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteBajoMinimo @IdBodega INT=NULL,@IdCategoria INT=NULL,
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT ib.IdBodega,b.Nombre AS BodegaNombre,c.Nombre AS CategoriaNombre,r.IdRepuesto,r.Codigo,r.Nombre AS RepuestoNombre,ib.Existencia,ib.StockMinimo
 INTO #Filas
 FROM dbo.InventarioBodega ib JOIN dbo.Bodega b ON b.IdBodega=ib.IdBodega JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto
 JOIN dbo.CategoriaRepuesto c ON c.IdCategoria=r.IdCategoria
 WHERE ib.Existencia<=ib.StockMinimo AND (@IdBodega IS NULL OR b.IdBodega=@IdBodega) AND (@IdCategoria IS NULL OR c.IdCategoria=@IdCategoria);
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),r.BodegaNombre)),(CONVERT(NVARCHAR(MAX),r.CategoriaNombre)),
  (CONVERT(NVARCHAR(MAX),r.Codigo)),(CONVERT(NVARCHAR(MAX),r.RepuestoNombre))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT IdBodega,BodegaNombre,CategoriaNombre,IdRepuesto,Codigo,RepuestoNombre,Existencia,StockMinimo
 FROM #Filas ORDER BY Existencia,IdBodega,Codigo,IdRepuesto OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteComprasProveedor
 @IdProveedor INT=NULL,@IdBodega INT=NULL,@Estado VARCHAR(10)=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL,
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT co.IdCompra,co.NumeroCompra,co.FechaCompra,co.Estado,p.IdProveedor,p.Nombre AS ProveedorNombre,b.Nombre AS BodegaNombre,
  u.NombreCompleto AS UsuarioRegistro,dc.IdDetalleCompra,r.Codigo,r.Nombre AS RepuestoNombre,dc.Cantidad,dc.CostoUnitario,dc.Subtotal
 INTO #Filas
 FROM dbo.Compra co JOIN dbo.Proveedor p ON p.IdProveedor=co.IdProveedor JOIN dbo.Bodega b ON b.IdBodega=co.IdBodegaDestino
 JOIN dbo.Usuario u ON u.IdUsuario=co.IdUsuarioRegistro JOIN dbo.DetalleCompra dc ON dc.IdCompra=co.IdCompra JOIN dbo.Repuesto r ON r.IdRepuesto=dc.IdRepuesto
 WHERE (@IdProveedor IS NULL OR co.IdProveedor=@IdProveedor) AND (@IdBodega IS NULL OR co.IdBodegaDestino=@IdBodega)
  AND (@Estado IS NULL OR co.Estado=@Estado) AND (@Desde IS NULL OR co.FechaCompra>=@Desde)
  AND (@HastaExclusiva IS NULL OR co.FechaCompra<@HastaExclusiva);
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),r.NumeroCompra)),(CONVERT(NVARCHAR(MAX),CONVERT(NVARCHAR(19),r.FechaCompra,126)+N'.000Z')),
  (CONVERT(NVARCHAR(MAX),r.Estado)),(CONVERT(NVARCHAR(MAX),r.ProveedorNombre)),(CONVERT(NVARCHAR(MAX),r.BodegaNombre)),
  (CONVERT(NVARCHAR(MAX),r.UsuarioRegistro)),(CONVERT(NVARCHAR(MAX),r.Codigo)),(CONVERT(NVARCHAR(MAX),r.RepuestoNombre)),
  (CONVERT(NVARCHAR(MAX),CAST(r.CostoUnitario AS DECIMAL(38,2)))),(CONVERT(NVARCHAR(MAX),CAST(r.Subtotal AS DECIMAL(38,2))))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT IdCompra,NumeroCompra,FechaCompra,Estado,IdProveedor,ProveedorNombre,BodegaNombre,UsuarioRegistro,IdDetalleCompra,Codigo,RepuestoNombre,Cantidad,CostoUnitario,Subtotal
 FROM #Filas ORDER BY FechaCompra DESC,IdCompra,IdDetalleCompra OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteMovimientos
 @IdBodega INT=NULL,@IdRepuesto INT=NULL,@CodigoTipo VARCHAR(30)=NULL,@IdUsuario INT=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL,
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT m.IdMovimiento,m.FechaMovimiento,m.IdBodega,m.BodegaNombre,m.IdRepuesto,m.CodigoRepuesto,m.RepuestoNombre,
  t.Nombre AS TipoMovimiento,m.Naturaleza,m.Cantidad,m.ExistenciaResultante,m.DocumentoOrigen,m.NumeroDocumento,m.UsuarioNombre,m.Observacion
 INTO #Filas
 FROM dbo.vw_MovimientosInventario m JOIN dbo.TipoMovimiento t ON t.Codigo=m.CodigoTipoMovimiento
 WHERE (@IdBodega IS NULL OR m.IdBodega=@IdBodega) AND (@IdRepuesto IS NULL OR m.IdRepuesto=@IdRepuesto)
  AND (@CodigoTipo IS NULL OR m.CodigoTipoMovimiento=@CodigoTipo) AND (@IdUsuario IS NULL OR m.IdUsuario=@IdUsuario)
  AND (@Desde IS NULL OR m.FechaMovimiento>=@Desde) AND (@HastaExclusiva IS NULL OR m.FechaMovimiento<@HastaExclusiva);
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),CONVERT(NVARCHAR(19),r.FechaMovimiento,126)+N'.000Z')),
  (CONVERT(NVARCHAR(MAX),r.BodegaNombre)),(CONVERT(NVARCHAR(MAX),r.CodigoRepuesto)),(CONVERT(NVARCHAR(MAX),r.RepuestoNombre)),
  (CONVERT(NVARCHAR(MAX),r.TipoMovimiento)),(CONVERT(NVARCHAR(MAX),r.Naturaleza)),(CONVERT(NVARCHAR(MAX),r.DocumentoOrigen)),
  (CONVERT(NVARCHAR(MAX),r.NumeroDocumento)),(CONVERT(NVARCHAR(MAX),r.UsuarioNombre)),(CONVERT(NVARCHAR(MAX),r.Observacion))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT IdMovimiento,FechaMovimiento,IdBodega,BodegaNombre,IdRepuesto,CodigoRepuesto,RepuestoNombre,TipoMovimiento,Naturaleza,Cantidad,ExistenciaResultante,DocumentoOrigen,NumeroDocumento,UsuarioNombre,Observacion
 FROM #Filas ORDER BY IdMovimiento DESC OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteFacturasSaldo
 @IdCliente INT=NULL,@ConSaldo BIT=1,@Estado VARCHAR(10)=NULL,@Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL,
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 SELECT f.IdFactura,f.NumeroFactura,f.IdOrden,f.NumeroOrden,f.ClienteNombre,f.FechaFactura,f.Estado,f.Total,f.TotalPagado,f.Saldo
 INTO #Filas
 FROM dbo.vw_FacturaSaldo f JOIN dbo.Cliente c ON c.IdCliente=f.IdCliente
 WHERE (@IdCliente IS NULL OR c.IdCliente=@IdCliente) AND (@ConSaldo=0 OR f.Saldo>0) AND (@Estado IS NULL OR f.Estado=@Estado)
  AND (@Desde IS NULL OR f.FechaFactura>=@Desde) AND (@HastaExclusiva IS NULL OR f.FechaFactura<@HastaExclusiva);
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),r.NumeroFactura)),(CONVERT(NVARCHAR(MAX),r.NumeroOrden)),(CONVERT(NVARCHAR(MAX),r.ClienteNombre)),
  (CONVERT(NVARCHAR(MAX),CONVERT(NVARCHAR(19),r.FechaFactura,126)+N'.000Z')),(CONVERT(NVARCHAR(MAX),r.Estado)),
  (CONVERT(NVARCHAR(MAX),CAST(r.Total AS DECIMAL(38,2)))),(CONVERT(NVARCHAR(MAX),CAST(r.TotalPagado AS DECIMAL(38,2)))),
  (CONVERT(NVARCHAR(MAX),CAST(r.Saldo AS DECIMAL(38,2))))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 SELECT p.IdPago,p.IdFactura,p.FechaPago,p.Monto,mp.Nombre AS MetodoPago,p.Referencia,p.Estado,u.NombreCompleto AS UsuarioNombre
 INTO #Pagos
 FROM dbo.Pago p JOIN dbo.MetodoPago mp ON mp.IdMetodoPago=p.IdMetodoPago JOIN dbo.Usuario u ON u.IdUsuario=p.IdUsuario
 JOIN #Filas f ON f.IdFactura=p.IdFactura;
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 DECLARE @TotalFilas BIGINT=@TotalRows+(SELECT COUNT_BIG(*) FROM #Pagos);
 IF @MaxRows IS NOT NULL AND @TotalFilas>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT IdFactura,NumeroFactura,IdOrden,NumeroOrden,ClienteNombre,FechaFactura,Estado,Total,TotalPagado,Saldo
 INTO #Pagina FROM #Filas ORDER BY FechaFactura DESC,IdFactura OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 SELECT IdFactura,NumeroFactura,IdOrden,NumeroOrden,ClienteNombre,FechaFactura,Estado,Total,TotalPagado,Saldo
 FROM #Pagina ORDER BY FechaFactura DESC,IdFactura;
 SELECT p.IdPago,p.IdFactura,p.FechaPago,p.Monto,p.MetodoPago,p.Referencia,p.Estado,p.UsuarioNombre
 FROM #Pagos p JOIN #Pagina f ON f.IdFactura=p.IdFactura ORDER BY p.IdFactura,p.FechaPago,p.IdPago;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteIngresos
 @Desde DATETIME2(0)=NULL,@HastaExclusiva DATETIME2(0)=NULL,@IdCliente INT=NULL,
 @Page INT=NULL,@PageSize INT=20,@Search NVARCHAR(150)=NULL,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @Page<1 OR @PageSize IS NULL OR @PageSize NOT BETWEEN 1 AND 100 THROW 51700,N'Paginacion no valida.',1;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 -- Grano factura antes de agrupar: no JOIN directo con pagos ni lineas 1:N.
 SELECT YEAR(DATEADD(HOUR,-6,f.FechaFactura)) AS Anio,MONTH(DATEADD(HOUR,-6,f.FechaFactura)) AS Mes,COUNT_BIG(*) AS CantidadFacturas,
  SUM(f.SubtotalManoObra) AS TotalManoObra,SUM(f.SubtotalRepuestos) AS TotalRepuestos,
  SUM(f.Subtotal) AS Subtotal,SUM(f.Impuesto) AS Impuesto,SUM(f.Total) AS Total
 INTO #Filas
 FROM dbo.Factura f JOIN dbo.OrdenServicio o ON o.IdOrden=f.IdOrden JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo
 JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente WHERE f.Estado<>'ANULADA'
  AND (@IdCliente IS NULL OR c.IdCliente=@IdCliente) AND (@Desde IS NULL OR f.FechaFactura>=@Desde)
  AND (@HastaExclusiva IS NULL OR f.FechaFactura<@HastaExclusiva)
 GROUP BY YEAR(DATEADD(HOUR,-6,f.FechaFactura)),MONTH(DATEADD(HOUR,-6,f.FechaFactura));
 DELETE r FROM #Filas r WHERE @Search IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM (VALUES
  (CONVERT(NVARCHAR(MAX),CAST(r.TotalManoObra AS DECIMAL(38,2)))),(CONVERT(NVARCHAR(MAX),CAST(r.TotalRepuestos AS DECIMAL(38,2)))),
  (CONVERT(NVARCHAR(MAX),CAST(r.Subtotal AS DECIMAL(38,2)))),(CONVERT(NVARCHAR(MAX),CAST(r.Impuesto AS DECIMAL(38,2)))),
  (CONVERT(NVARCHAR(MAX),CAST(r.Total AS DECIMAL(38,2))))) v(Texto)
  WHERE CHARINDEX(@Search COLLATE Latin1_General_100_CI_AS_SC,v.Texto COLLATE Latin1_General_100_CI_AS_SC)>0);
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Filas);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 DECLARE @Offset BIGINT=CASE WHEN @Page IS NULL THEN 0 ELSE (CONVERT(BIGINT,@Page)-1)*@PageSize END;
 DECLARE @Fetch BIGINT=CASE WHEN @Page IS NULL THEN 9223372036854775807 ELSE @PageSize END;
 SELECT Anio,Mes,CantidadFacturas,TotalManoObra,TotalRepuestos,Subtotal,Impuesto,Total
 FROM #Filas ORDER BY Anio,Mes OFFSET @Offset ROWS FETCH NEXT @Fetch ROWS ONLY;
 IF @Page IS NOT NULL SELECT @TotalRows AS TotalRows;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ReporteTrazabilidad @IdOrden INT,@MaxRows INT=NULL
AS
BEGIN
 SET NOCOUNT ON;
 IF @MaxRows IS NOT NULL AND @MaxRows NOT BETWEEN 1 AND 10000 THROW 51700,N'Limite de filas no valido.',1;
 -- Resultset plano de trazabilidad + pagos separados: no producto pagos/consumos.
 SELECT t.IdOrden,t.NumeroOrden,t.FechaIngreso,t.EstadoOrden,t.ClienteNombre,t.NumeroSerie,t.Recepcionista,
  t.IdDiagnostico,t.Diagnostico,t.EstadoDiagnostico,t.TecnicoDiagnostico,t.IdReparacion,t.EstadoReparacion,t.TecnicoReparacion,
  t.IdRepuestoReparacion,t.CodigoRepuesto,t.Cantidad,t.PrecioCostoUnitario,t.PrecioVentaUnitario,t.IdMovimiento,t.ExistenciaResultante,
  t.IdFactura,t.NumeroFactura,t.TotalFactura,t.TotalPagado,t.SaldoPendiente,t.FechaEntrega,t.NombreRecibe
 INTO #Trazabilidad
 FROM dbo.vw_TrazabilidadOrden t JOIN dbo.OrdenServicio o ON o.IdOrden=t.IdOrden WHERE t.IdOrden=@IdOrden;
 SELECT p.IdPago,p.FechaPago,p.Monto,p.MetodoPagoNombre,p.Estado,p.UsuarioNombre INTO #Pagos FROM dbo.vw_Pagos p
 JOIN dbo.Factura f ON f.IdFactura=p.IdFactura WHERE f.IdOrden=@IdOrden;
 SELECT h.IdHistorial,h.EstadoAnterior,h.EstadoNuevo,h.FechaCambio,h.UsuarioNombre,h.Observacion
 INTO #Estados
 FROM dbo.vw_HistorialEstadoOrden h JOIN dbo.OrdenServicio o ON o.IdOrden=h.IdOrden WHERE h.IdOrden=@IdOrden;
 DECLARE @TotalRows BIGINT=(SELECT COUNT_BIG(*) FROM #Trazabilidad)+(SELECT COUNT_BIG(*) FROM #Pagos)+(SELECT COUNT_BIG(*) FROM #Estados);
 IF @MaxRows IS NOT NULL AND @TotalRows>@MaxRows THROW 51710,N'El reporte excede el limite de filas.',1;
 SELECT IdOrden,NumeroOrden,FechaIngreso,EstadoOrden,ClienteNombre,NumeroSerie,Recepcionista,
  IdDiagnostico,Diagnostico,EstadoDiagnostico,TecnicoDiagnostico,IdReparacion,EstadoReparacion,TecnicoReparacion,
  IdRepuestoReparacion,CodigoRepuesto,Cantidad,PrecioCostoUnitario,PrecioVentaUnitario,IdMovimiento,ExistenciaResultante,
  IdFactura,NumeroFactura,TotalFactura,TotalPagado,SaldoPendiente,FechaEntrega,NombreRecibe
 FROM #Trazabilidad ORDER BY IdDiagnostico,IdReparacion,IdRepuestoReparacion,IdMovimiento;
 SELECT IdPago,FechaPago,Monto,MetodoPagoNombre,Estado,UsuarioNombre FROM #Pagos ORDER BY IdPago;
 SELECT IdHistorial,EstadoAnterior,EstadoNuevo,FechaCambio,UsuarioNombre,Observacion FROM #Estados ORDER BY IdHistorial;
END;
GO
