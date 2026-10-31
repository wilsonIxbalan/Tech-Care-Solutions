/* PRUEBAS T01-T07 (QA-01). Ejecutar en la base LOCAL ya sembrada (02 a 05 sin FAIL).
   ANTES: hacer un respaldo, porque estas pruebas CONSUMEN datos (crean cliente, orden, consumo, compra).
   Correr TODO el archivo de una vez (es un solo lote). Al final muestra la tabla #Ev:
   Caso, Prueba, Esperado, Obtenido, Estado y fecha. El Estado sale de comparar con lo que
   devolvio la base al ejecutar; no se rellena a mano. Copiar el resultado a la plantilla de evidencias. */
USE TechCareDB;
GO
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

IF NOT EXISTS(SELECT 1 FROM dbo.OrdenServicio) THROW 59030, N'Ejecutar primero las semillas 02 a 04.', 1;
IF EXISTS(SELECT 1 FROM dbo.Cliente WHERE NIT='9000001-1')
    THROW 59031, N'T01-T07 ya se ejecutaron en esta base; restaurar el respaldo antes de repetir.', 1;

CREATE TABLE #Ev(Caso VARCHAR(10),Prueba VARCHAR(120),Esperado VARCHAR(400),Obtenido VARCHAR(600),Estado VARCHAR(10),
                 FechaEjecucion DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());

DECLARE @Recep1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='recep1'),
        @Tec1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='tecnico1'),
        @Bod1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='bodega1'),
        @Bod2 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='bodega2'),
        @B1 INT=(SELECT IdBodega FROM dbo.Bodega WHERE Codigo='BOD-01'),
        @B2 INT=(SELECT IdBodega FROM dbo.Bodega WHERE Codigo='BOD-02');
DECLARE @IdCli INT,@IdEqA INT,@IdEqB INT,@n INT;
DECLARE @IdOrd INT,@IdPrio INT,@Est VARCHAR(30),@Hist INT,@HistOk INT;
DECLARE @IdDiag INT,@Diags INT,@Err INT,@IdOrdNeg INT,@EstNeg VARCHAR(30),@DiagNeg INT;
DECLARE @IdRep INT,@IdCons INT,@Repu INT,@e0 INT,@e1 INT,@c0 INT,@c1 INT,@m0 INT,@m1 INT,@ok INT;
DECLARE @det dbo.tvp_DetalleCompra,@IdComp INT,@Prov INT,@s0 INT,@s1 INT,@s2 INT,@EstComp VARCHAR(10),@Ent INT,@Nd INT;
DECLARE @Durante INT;

/* ---------- T01: cliente + dos equipos ---------- */
INSERT dbo.Cliente(TipoCliente,NIT,Nombres,Apellidos,Telefono,Email,Direccion)
VALUES('INDIVIDUAL','9000001-1','Cliente','PruebaT01','55550001','t01@correo.test','Zona 1, Guatemala');
SET @IdCli=CONVERT(INT,SCOPE_IDENTITY());
INSERT dbo.Equipo(IdCliente,IdTipoEquipo,IdMarca,Modelo,NumeroSerie,Descripcion)
SELECT @IdCli,te.IdTipoEquipo,ma.IdMarca,'T01-A','T01-SN-A','Laptop de prueba T01'
FROM dbo.TipoEquipo te CROSS JOIN dbo.Marca ma WHERE te.Nombre='Laptop' AND ma.Nombre='HP';
SET @IdEqA=CONVERT(INT,SCOPE_IDENTITY());
INSERT dbo.Equipo(IdCliente,IdTipoEquipo,IdMarca,Modelo,NumeroSerie,Descripcion)
SELECT @IdCli,te.IdTipoEquipo,ma.IdMarca,'T01-B','T01-SN-B','Impresora de prueba T01'
FROM dbo.TipoEquipo te CROSS JOIN dbo.Marca ma WHERE te.Nombre='Impresora' AND ma.Nombre='Epson';
SET @IdEqB=CONVERT(INT,SCOPE_IDENTITY());
SELECT @n=COUNT(*) FROM dbo.Equipo WHERE IdCliente=@IdCli AND NumeroSerie IN('T01-SN-A','T01-SN-B');
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T01','Cliente con dos equipos','1 cliente y 2 equipos asociados a el',
 CONCAT('Cliente ',@IdCli,' con ',@n,' equipos (ids ',@IdEqA,' y ',@IdEqB,')'),CASE WHEN @n=2 THEN 'PASS' ELSE 'FAIL' END);

/* ---------- T02: crear orden ---------- */
SELECT @IdPrio=IdPrioridad FROM dbo.Prioridad WHERE Codigo='NORMAL';
EXEC dbo.sp_RegistrarOrdenServicio @IdCliente=@IdCli,@IdEquipo=@IdEqA,@IdUsuarioRecepcion=@Recep1,
     @IdPrioridad=@IdPrio,@ProblemaReportado='T02: el equipo no enciende',@IdOrden=@IdOrd OUTPUT;
SELECT @Est=eo.Codigo FROM dbo.OrdenServicio o JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@IdOrd;
SELECT @Hist=COUNT(*),@HistOk=ISNULL(SUM(CASE WHEN h.IdEstadoAnterior IS NULL AND e.Codigo='RECIBIDO' THEN 1 ELSE 0 END),0)
FROM dbo.HistorialEstadoOrden h JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=h.IdEstadoNuevo WHERE h.IdOrden=@IdOrd;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T02','Crear orden: estado e historial inicial','Estado RECIBIDO y 1 fila de historial (anterior NULL, nuevo RECIBIDO)',
 CONCAT('Orden ',@IdOrd,' en ',@Est,'; historial: ',@Hist,' fila(s), ',@HistOk,' inicial(es) correcta(s)'),
 CASE WHEN @Est='RECIBIDO' AND @Hist=1 AND @HistOk=1 THEN 'PASS' ELSE 'FAIL' END);

/* ---------- T03: diagnostico con tecnico autorizado + cambio de estado ---------- */
EXEC dbo.sp_RegistrarDiagnostico @IdOrden=@IdOrd,@IdTecnico=@Tec1,@Descripcion='T03: falla en fuente de poder',
     @CostoManoObraEstimado=150.00,@IdDiagnostico=@IdDiag OUTPUT;
SELECT @Est=eo.Codigo FROM dbo.OrdenServicio o JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@IdOrd;
SELECT @Diags=COUNT(*) FROM dbo.Diagnostico WHERE IdOrden=@IdOrd AND Estado='ACTIVO';
SELECT @Hist=COUNT(*) FROM dbo.HistorialEstadoOrden WHERE IdOrden=@IdOrd;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T03','Diagnostico con tecnico autorizado','Diagnostico ACTIVO, orden en ESPERANDO_AUTORIZACION y 3 filas de historial',
 CONCAT('Orden en ',@Est,'; diagnosticos activos: ',@Diags,'; historial: ',@Hist,' fila(s)'),
 CASE WHEN @Est='ESPERANDO_AUTORIZACION' AND @Diags=1 AND @Hist=3 THEN 'PASS' ELSE 'FAIL' END);

-- T03 (parte negativa): quien no es tecnico no puede diagnosticar
SELECT TOP 1 @IdOrdNeg=o.IdOrden FROM dbo.OrdenServicio o JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden
 WHERE e.Codigo='RECIBIDO' AND o.IdOrden<>@IdOrd ORDER BY o.IdOrden;
SET @Err=NULL;
BEGIN TRY
  EXEC dbo.sp_RegistrarDiagnostico @IdOrden=@IdOrdNeg,@IdTecnico=@Recep1,@Descripcion='T03 negativa',
       @CostoManoObraEstimado=10.00,@IdDiagnostico=@IdDiag OUTPUT;
END TRY
BEGIN CATCH
  SET @Err=ERROR_NUMBER();
END CATCH;
SELECT @EstNeg=eo.Codigo FROM dbo.OrdenServicio o JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@IdOrdNeg;
SELECT @DiagNeg=COUNT(*) FROM dbo.Diagnostico WHERE IdOrden=@IdOrdNeg;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T03b','Diagnostico rechazado para usuario sin rol TECNICO','Error 50302; la orden sigue RECIBIDO y sin diagnostico',
 CONCAT('Error: ',ISNULL(CONVERT(VARCHAR(10),@Err),'ninguno'),'; orden ',@IdOrdNeg,' en ',@EstNeg,'; diagnosticos: ',@DiagNeg),
 CASE WHEN @Err=50302 AND @EstNeg='RECIBIDO' AND @DiagNeg=0 THEN 'PASS' ELSE 'FAIL' END);

/* ---------- Preparacion para T04/T05: reparacion en proceso ---------- */
EXEC dbo.sp_IniciarReparacion @IdOrden=@IdOrd,@IdTecnico=@Tec1,@Descripcion='T04/T05: reparacion de prueba',
     @CostoManoObra=200.00,@IdReparacion=@IdRep OUTPUT;

/* ---------- T04: consumir mas que el stock -> rechazo sin escrituras parciales ---------- */
SELECT @Repu=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-009';    -- BOD-02 tiene 1 unidad
SELECT @e0=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B2 AND IdRepuesto=@Repu;
SELECT @c0=COUNT(*) FROM dbo.RepuestoReparacion;
SELECT @m0=COUNT(*) FROM dbo.MovimientoInventario;
SET @Err=NULL;
BEGIN TRY
  EXEC dbo.sp_AsignarRepuestoReparacion @IdReparacion=@IdRep,@IdBodega=@B2,@IdRepuesto=@Repu,@Cantidad=5,
       @IdUsuario=@Tec1,@IdRepuestoReparacion=@IdCons OUTPUT;
END TRY
BEGIN CATCH
  SET @Err=ERROR_NUMBER();
END CATCH;
SELECT @e1=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B2 AND IdRepuesto=@Repu;
SELECT @c1=COUNT(*) FROM dbo.RepuestoReparacion;
SELECT @m1=COUNT(*) FROM dbo.MovimientoInventario;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T04','Consumo mayor al stock','Error 50607; existencia, consumos y movimientos sin cambios',
 CONCAT('Error: ',ISNULL(CONVERT(VARCHAR(10),@Err),'ninguno'),'; existencia ',@e0,'->',@e1,'; consumos ',@c0,'->',@c1,'; movimientos ',@m0,'->',@m1),
 CASE WHEN @Err=50607 AND @e0=@e1 AND @c0=@c1 AND @m0=@m1 THEN 'PASS' ELSE 'FAIL' END);

/* ---------- T05: consumo valido -> detalle + decremento + movimiento coherentes ---------- */
SELECT @Repu=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-001';
SELECT @e0=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B1 AND IdRepuesto=@Repu;
SELECT @m0=COUNT(*) FROM dbo.MovimientoInventario;
EXEC dbo.sp_AsignarRepuestoReparacion @IdReparacion=@IdRep,@IdBodega=@B1,@IdRepuesto=@Repu,@Cantidad=2,
     @IdUsuario=@Tec1,@IdRepuestoReparacion=@IdCons OUTPUT;
SELECT @m1=COUNT(*) FROM dbo.MovimientoInventario;
SET @ok=NULL;
SELECT @ok=CASE WHEN ib.Existencia=@e0-2 AND rr.Cantidad=2 AND rr.PrecioVentaUnitario=rp.PrecioVenta
                 AND rr.PrecioCostoUnitario=rp.PrecioCompraReferencia AND mi.Cantidad=2
                 AND mi.ExistenciaResultante=ib.Existencia AND tm.Codigo='CONSUMO_REPARACION' THEN 1 ELSE 0 END,
       @e1=ib.Existencia
FROM dbo.RepuestoReparacion rr
JOIN dbo.InventarioBodega ib ON ib.IdBodega=rr.IdBodega AND ib.IdRepuesto=rr.IdRepuesto
JOIN dbo.Repuesto rp ON rp.IdRepuesto=rr.IdRepuesto
JOIN dbo.MovimientoInventario mi ON mi.IdRepuestoReparacion=rr.IdRepuestoReparacion
JOIN dbo.TipoMovimiento tm ON tm.IdTipoMovimiento=mi.IdTipoMovimiento
WHERE rr.IdRepuestoReparacion=@IdCons;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T05','Consumo valido de repuesto','Existencia -2, 1 detalle con precios vigentes y 1 movimiento CONSUMO_REPARACION con existencia resultante igual',
 CONCAT('Existencia ',@e0,'->',@e1,'; movimientos nuevos: ',@m1-@m0,'; coherencia detalle/movimiento: ',ISNULL(@ok,0)),
 CASE WHEN ISNULL(@ok,0)=1 AND @m1=@m0+1 THEN 'PASS' ELSE 'FAIL' END);

/* ---------- T06: compra con varios items y recepcion ---------- */
SELECT TOP 1 @Prov=IdProveedor FROM dbo.Proveedor ORDER BY IdProveedor;
SELECT @s0=SUM(ib.Existencia) FROM dbo.InventarioBodega ib JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto
 WHERE ib.IdBodega=@B1 AND r.Codigo IN('REP-013','REP-014','REP-015');
SELECT @m0=COUNT(*) FROM dbo.MovimientoInventario;
INSERT @det(IdRepuesto,Cantidad,CostoUnitario)
SELECT IdRepuesto,CASE Codigo WHEN 'REP-013' THEN 5 WHEN 'REP-014' THEN 3 ELSE 2 END,PrecioCompraReferencia
FROM dbo.Repuesto WHERE Codigo IN('REP-013','REP-014','REP-015');
EXEC dbo.sp_RegistrarCompra @IdProveedor=@Prov,@IdBodegaDestino=@B1,@IdUsuario=@Bod1,
     @NumeroDocumentoProveedor='T06-DOC',@Observaciones='Compra de prueba T06',@Detalle=@det,@IdCompra=@IdComp OUTPUT;
SELECT @Nd=COUNT(*) FROM dbo.DetalleCompra WHERE IdCompra=@IdComp;
SELECT @s1=SUM(ib.Existencia) FROM dbo.InventarioBodega ib JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto
 WHERE ib.IdBodega=@B1 AND r.Codigo IN('REP-013','REP-014','REP-015');
EXEC dbo.sp_RecibirCompra @IdCompra=@IdComp,@IdUsuario=@Bod2;
SELECT @EstComp=Estado FROM dbo.Compra WHERE IdCompra=@IdComp;
SELECT @s2=SUM(ib.Existencia) FROM dbo.InventarioBodega ib JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto
 WHERE ib.IdBodega=@B1 AND r.Codigo IN('REP-013','REP-014','REP-015');
SELECT @Ent=COUNT(*) FROM dbo.MovimientoInventario mi JOIN dbo.DetalleCompra dc ON dc.IdDetalleCompra=mi.IdDetalleCompra
 WHERE dc.IdCompra=@IdComp;
SELECT @m1=COUNT(*) FROM dbo.MovimientoInventario;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T06','Compra con 3 items y recepcion','3 lineas; antes de recibir no cambia el stock; al recibir estado RECIBIDA, 3 entradas y +10 unidades',
 CONCAT('Lineas: ',@Nd,'; existencia antes ',@s0,', tras registrar ',@s1,', tras recibir ',@s2,'; estado ',@EstComp,'; entradas: ',@Ent,'; movimientos nuevos: ',@m1-@m0),
 CASE WHEN @Nd=3 AND @s1=@s0 AND @EstComp='RECIBIDA' AND @s2=@s0+10 AND @Ent=3 AND @m1=@m0+3 THEN 'PASS' ELSE 'FAIL' END);

/* ---------- T07: fallo DESPUES de una escritura dentro de una transaccion -> rollback total ---------- */
SELECT @Repu=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-002';
SELECT @e0=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B1 AND IdRepuesto=@Repu;
SELECT @m0=COUNT(*) FROM dbo.MovimientoInventario;
SET @Err=NULL; SET @Durante=NULL;
BEGIN TRY
  BEGIN TRANSACTION;
  EXEC dbo.sp_AjustarInventario @IdBodega=@B1,@IdRepuesto=@Repu,@CodigoTipoMovimiento='AJUSTE_ENTRADA',@Cantidad=5,
       @IdUsuario=@Bod1,@Observacion='T07: escritura que debe revertirse';
  SELECT @Durante=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B1 AND IdRepuesto=@Repu;   -- la escritura existe dentro de la transaccion
  THROW 59999, N'T07: fallo forzado despues de escribir', 1;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  SET @Err=ERROR_NUMBER();
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
END CATCH;
SELECT @e1=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B1 AND IdRepuesto=@Repu;
SELECT @m1=COUNT(*) FROM dbo.MovimientoInventario;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T07','Rollback tras fallo posterior a una escritura','La escritura se ve dentro de la transaccion (+5) y tras el fallo todo vuelve al valor inicial',
 CONCAT('Error: ',ISNULL(CONVERT(VARCHAR(10),@Err),'ninguno'),'; existencia inicial ',@e0,', dentro de la transaccion ',ISNULL(CONVERT(VARCHAR(10),@Durante),'?'),', final ',@e1,'; movimientos ',@m0,'->',@m1,'; transacciones abiertas: ',@@TRANCOUNT),
 CASE WHEN @Err=59999 AND @Durante=@e0+5 AND @e1=@e0 AND @m1=@m0 AND @@TRANCOUNT=0 THEN 'PASS' ELSE 'FAIL' END);

SELECT Caso,Prueba,Esperado,Obtenido,Estado,FechaEjecucion FROM #Ev ORDER BY Caso;
DROP TABLE #Ev;
GO
