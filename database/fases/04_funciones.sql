/* FASE 04. Funciones base antes de vistas y procedimientos. */
CREATE OR ALTER FUNCTION dbo.fn_UsuarioTieneRol (@IdUsuario INT, @CodigoRol VARCHAR(30))
RETURNS BIT
AS
BEGIN
    RETURN CASE WHEN EXISTS (
      SELECT 1 FROM dbo.Usuario u JOIN dbo.UsuarioRol ur ON ur.IdUsuario=u.IdUsuario
      JOIN dbo.Rol r ON r.IdRol=ur.IdRol
      WHERE u.IdUsuario=@IdUsuario AND u.Activo=1 AND r.Activo=1 AND r.Codigo=@CodigoRol
    ) THEN 1 ELSE 0 END;
END;
GO
CREATE OR ALTER FUNCTION dbo.fn_UsuarioTienePermiso (@IdUsuario INT, @CodigoPermiso VARCHAR(40))
RETURNS BIT
AS
BEGIN
    RETURN CASE WHEN EXISTS (
      SELECT 1 FROM dbo.Usuario u JOIN dbo.UsuarioRol ur ON ur.IdUsuario=u.IdUsuario
      JOIN dbo.Rol r ON r.IdRol=ur.IdRol JOIN dbo.RolPermiso rp ON rp.IdRol=r.IdRol
      JOIN dbo.Permiso p ON p.IdPermiso=rp.IdPermiso
      WHERE u.IdUsuario=@IdUsuario AND u.Activo=1 AND r.Activo=1 AND p.Codigo=@CodigoPermiso
    ) THEN 1 ELSE 0 END;
END;
GO
CREATE OR ALTER FUNCTION dbo.fn_SaldoFactura (@IdFactura INT)
RETURNS DECIMAL(12,2)
AS
BEGIN
    DECLARE @Total DECIMAL(12,2), @Estado VARCHAR(10), @Pagado DECIMAL(12,2);
    SELECT @Total=Total,@Estado=Estado FROM dbo.Factura WHERE IdFactura=@IdFactura;
    IF @Total IS NULL RETURN NULL;
    IF @Estado='ANULADA' RETURN 0;
    SELECT @Pagado=ISNULL(SUM(Monto),0) FROM dbo.Pago WHERE IdFactura=@IdFactura AND Estado='APLICADO';
    RETURN @Total-@Pagado;
END;
GO
CREATE OR ALTER FUNCTION dbo.fn_TotalManoObraOrden (@IdOrden INT)
RETURNS DECIMAL(12,2)
AS
BEGIN
    DECLARE @Total DECIMAL(12,2);
    SELECT @Total=ISNULL(SUM(r.CostoManoObra),0)
    FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico
    WHERE d.IdOrden=@IdOrden AND r.Estado='FINALIZADA';
    RETURN @Total;
END;
GO
CREATE OR ALTER FUNCTION dbo.fn_TotalRepuestosOrden (@IdOrden INT)
RETURNS DECIMAL(12,2)
AS
BEGIN
    DECLARE @Total DECIMAL(12,2);
    SELECT @Total=ISNULL(SUM(rr.Subtotal),0)
    FROM dbo.RepuestoReparacion rr JOIN dbo.Reparacion r ON r.IdReparacion=rr.IdReparacion
    JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico
    WHERE d.IdOrden=@IdOrden AND r.Estado<>'CANCELADA' AND rr.Estado='ACTIVO';
    RETURN @Total;
END;
GO
CREATE OR ALTER FUNCTION dbo.fn_TotalOrden (@IdOrden INT, @PorcentajeImpuesto DECIMAL(5,2))
RETURNS DECIMAL(12,2)
AS
BEGIN
    DECLARE @Sub DECIMAL(12,2)=dbo.fn_TotalManoObraOrden(@IdOrden)+dbo.fn_TotalRepuestosOrden(@IdOrden);
    RETURN @Sub+CONVERT(DECIMAL(12,2),ROUND(@Sub*@PorcentajeImpuesto/100.0,2));
END;
GO
-- Grano: orden/diagnostico; incluye diagnosticos anulados, no solo el actual.
CREATE OR ALTER FUNCTION dbo.fn_HistorialEquipo (@NumeroSerie VARCHAR(60))
RETURNS TABLE
AS RETURN (
    SELECT e.IdEquipo,e.NumeroSerie,o.IdOrden,o.NumeroOrden,o.FechaIngreso,o.ProblemaReportado,
      eo.Codigo AS EstadoOrden,d.IdDiagnostico,d.Descripcion AS Diagnostico,d.Estado AS EstadoDiagnostico,
      u.NombreCompleto AS TecnicoDiagnostico,
      dbo.fn_TotalManoObraOrden(o.IdOrden) AS TotalManoObra,
      dbo.fn_TotalRepuestosOrden(o.IdOrden) AS TotalRepuestos,
      f.IdFactura,f.NumeroFactura,f.Total AS TotalFactura,en.FechaEntrega
    FROM dbo.Equipo e LEFT JOIN dbo.OrdenServicio o ON o.IdEquipo=e.IdEquipo
    LEFT JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden
    LEFT JOIN dbo.Diagnostico d ON d.IdOrden=o.IdOrden
    LEFT JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico
    LEFT JOIN dbo.Factura f ON f.IdOrden=o.IdOrden
    LEFT JOIN dbo.Entrega en ON en.IdOrden=o.IdOrden
    WHERE e.NumeroSerie=@NumeroSerie
);
GO
