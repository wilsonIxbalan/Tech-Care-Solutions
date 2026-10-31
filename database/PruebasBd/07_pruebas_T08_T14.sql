/* PRUEBAS T08-T14 (QA-01). Ejecutar en la base LOCAL ya sembrada (02 a 05 sin FAIL).
   ANTES: hacer un respaldo. T08 factura una orden que estaba en LISTO y T14 cambia el precio de un repuesto.
   Correr TODO el archivo de una vez (es un solo lote). Puede correrse despues del 06 o sin el.
   Al final muestra la tabla #Ev (Caso, Prueba, Esperado, Obtenido, Estado). El Estado se calcula
   con lo que devuelve la base; no se rellena a mano. */
USE TechCareDB;
GO
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

IF NOT EXISTS(SELECT 1 FROM dbo.OrdenServicio) THROW 59040, N'Ejecutar primero las semillas 02 a 04.', 1;

CREATE TABLE #Ev(Caso VARCHAR(10),Prueba VARCHAR(120),Esperado VARCHAR(400),Obtenido VARCHAR(600),Estado VARCHAR(10),
                 FechaEjecucion DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());

DECLARE @Caja1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='caja1'),
        @Bod1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='bodega1'),
        @Metodo INT=(SELECT IdMetodoPago FROM dbo.MetodoPago WHERE Codigo='EFECTIVO');
DECLARE @IdOrd INT,@IdFac INT,@Sub DECIMAL(12,2),@Tot DECIMAL(12,2),@SumDet DECIMAL(14,2),@EstF VARCHAR(10),@TotSql DECIMAL(12,2);
DECLARE @M1 DECIMAL(12,2),@M2 DECIMAL(12,2),@Esperado DECIMAL(12,2),@Saldo DECIMAL(12,2),@SaldoVw DECIMAL(12,2),@NPagos INT,@IdPago INT;
DECLARE @Excede DECIMAL(12,2),@Err INT,@Pc0 INT,@Pc1 INT,@Saldo0 DECIMAL(12,2),@Saldo1 DECIMAL(12,2);
DECLARE @N INT,@Lst VARCHAR(500);
DECLARE @IdOrdMulti INT,@RowsEsp INT,@RowsAct INT,@FacDist INT,@FacVista DECIMAL(12,2),@FacReal DECIMAL(12,2);
DECLARE @RepVista DECIMAL(12,2),@RepFn DECIMAL(12,2),@IdOrdSin INT,@RowsSin INT,@DiagNulos INT;
DECLARE @Bm1 INT,@Bm2 INT,@BodDist INT;
DECLARE @Rep INT,@Cv0 DECIMAL(12,2),@Vv0 DECIMAL(12,2),@NC DECIMAL(12,2),@NV DECIMAL(12,2),@Aud0 INT,@Aud1 INT,@AudOk INT;
DECLARE @sRR0 DECIMAL(18,2),@sDC0 DECIMAL(18,2),@sDF0 DECIMAL(18,2),@sRR1 DECIMAL(18,2),@sDC1 DECIMAL(18,2),@sDF1 DECIMAL(18,2);
DECLARE @PcN DECIMAL(12,2),@PvN DECIMAL(12,2);

/* ---------- T08: facturar una orden terminada (LISTO sin factura) ---------- */
SELECT TOP 1 @IdOrd=o.IdOrden FROM dbo.OrdenServicio o JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden
 WHERE e.Codigo='LISTO' AND NOT EXISTS(SELECT 1 FROM dbo.Factura f WHERE f.IdOrden=o.IdOrden) ORDER BY o.IdOrden;
IF @IdOrd IS NULL THROW 59041, N'No quedan ordenes en LISTO sin factura; restaurar el respaldo.', 1;
EXEC dbo.sp_GenerarFactura @IdOrden=@IdOrd,@IdUsuario=@Caja1,@IdFactura=@IdFac OUTPUT;
SELECT @Sub=f.Subtotal,@Tot=f.Total,@EstF=f.Estado,
       @SumDet=(SELECT SUM(df.Subtotal) FROM dbo.DetalleFactura df WHERE df.IdFactura=f.IdFactura)
FROM dbo.Factura f WHERE f.IdFactura=@IdFac;
SET @TotSql=dbo.fn_TotalOrden(@IdOrd,12.00);
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T08','Facturar orden terminada','Subtotal de cabecera = suma del detalle y Total = fn_TotalOrden al 12 %; estado EMITIDA',
 CONCAT('Orden ',@IdOrd,', factura ',@IdFac,': subtotal ',@Sub,' / detalle ',@SumDet,'; total ',@Tot,' / SQL ',@TotSql,'; estado ',@EstF),
 CASE WHEN @Sub=@SumDet AND @Tot=@TotSql AND @EstF='EMITIDA' THEN 'PASS' ELSE 'FAIL' END);

/* ---------- T09: dos pagos parciales; saldo restante exacto ---------- */
SET @M1=CONVERT(DECIMAL(12,2),ROUND(@Tot*0.30,2));
SET @M2=CONVERT(DECIMAL(12,2),ROUND(@Tot*0.30,2));
SET @Esperado=@Tot-@M1-@M2;
EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@M1,@IdUsuario=@Caja1,@Referencia=NULL,@IdPago=@IdPago OUTPUT;
EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@M2,@IdUsuario=@Caja1,@Referencia=NULL,@IdPago=@IdPago OUTPUT;
SET @Saldo=dbo.fn_SaldoFactura(@IdFac);
SELECT @SaldoVw=Saldo,@EstF=Estado FROM dbo.vw_Facturas WHERE IdFactura=@IdFac;
SELECT @NPagos=COUNT(*) FROM dbo.Pago WHERE IdFactura=@IdFac AND Estado='APLICADO';
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T09','Dos pagos parciales','2 pagos aplicados; saldo = total - pagos exacto (funcion y vista iguales); factura sigue EMITIDA',
 CONCAT('Total ',@Tot,' - ',@M1,' - ',@M2,' = ',@Esperado,'; fn_SaldoFactura ',@Saldo,'; vista ',@SaldoVw,'; pagos ',@NPagos,'; estado ',@EstF),
 CASE WHEN @NPagos=2 AND @Saldo=@Esperado AND @SaldoVw=@Esperado AND @EstF='EMITIDA' THEN 'PASS' ELSE 'FAIL' END);

/* ---------- T10: pago superior al saldo -> rechazo sin agregar pago ---------- */
SET @Excede=@Saldo+0.01;
SELECT @Pc0=COUNT(*) FROM dbo.Pago WHERE IdFactura=@IdFac;
SET @Saldo0=dbo.fn_SaldoFactura(@IdFac);
SET @Err=NULL;
BEGIN TRY
  EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@Excede,@IdUsuario=@Caja1,@Referencia=NULL,@IdPago=@IdPago OUTPUT;
END TRY
BEGIN CATCH
  SET @Err=ERROR_NUMBER();
END CATCH;
SELECT @Pc1=COUNT(*) FROM dbo.Pago WHERE IdFactura=@IdFac;
SET @Saldo1=dbo.fn_SaldoFactura(@IdFac);
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T10','Pago superior al saldo','Error 51105; no se agrega ningun pago y el saldo no cambia',
 CONCAT('Intento de ',@Excede,' con saldo ',@Saldo0,'; error: ',ISNULL(CONVERT(VARCHAR(10),@Err),'ninguno'),'; pagos ',@Pc0,'->',@Pc1,'; saldo ',@Saldo0,'->',@Saldo1),
 CASE WHEN @Err=51105 AND @Pc0=@Pc1 AND @Saldo0=@Saldo1 THEN 'PASS' ELSE 'FAIL' END);

/* ---------- T11: historial por serie de equipo con varias ordenes ---------- */
SELECT @N=COUNT(DISTINCT IdOrden) FROM dbo.fn_HistorialEquipo('TC-SN-0001');
SELECT @Lst=STRING_AGG(NumeroOrden,', ') WITHIN GROUP (ORDER BY NumeroOrden)
FROM (SELECT DISTINCT NumeroOrden FROM dbo.fn_HistorialEquipo('TC-SN-0001')) x;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T11','Historial por serie de equipo','Serie TC-SN-0001 con 3 ordenes en el historial',
 CONCAT('Ordenes encontradas: ',@N,' (',@Lst,')'),CASE WHEN @N>=3 THEN 'PASS' ELSE 'FAIL' END);
SELECT NumeroSerie,NumeroOrden,FechaIngreso,EstadoOrden,Diagnostico,TotalManoObra,TotalRepuestos,NumeroFactura,TotalFactura,FechaEntrega
FROM dbo.fn_HistorialEquipo('TC-SN-0001') ORDER BY FechaIngreso,IdOrden;

/* ---------- T12: trazabilidad completa, conserva relaciones opcionales y no multiplica totales ---------- */
SELECT TOP 1 @IdOrdMulti=d.IdOrden FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico
 JOIN dbo.Factura f ON f.IdOrden=d.IdOrden
 GROUP BY d.IdOrden HAVING COUNT(*)>=2 ORDER BY d.IdOrden;
SELECT @RowsEsp=SUM(CASE WHEN c.n=0 THEN 1 ELSE c.n END)
FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico
CROSS APPLY (SELECT COUNT(*) AS n FROM dbo.RepuestoReparacion rr WHERE rr.IdReparacion=r.IdReparacion) c
WHERE d.IdOrden=@IdOrdMulti;
SELECT @RowsAct=COUNT(*),@FacDist=COUNT(DISTINCT TotalFactura),@FacVista=MAX(TotalFactura)
FROM dbo.vw_TrazabilidadOrden WHERE IdOrden=@IdOrdMulti;
SELECT @FacReal=Total FROM dbo.Factura WHERE IdOrden=@IdOrdMulti;
SELECT @RepVista=ISNULL(SUM(SubtotalRepuesto),0)
FROM (SELECT DISTINCT IdRepuestoReparacion,SubtotalRepuesto FROM dbo.vw_TrazabilidadOrden
      WHERE IdOrden=@IdOrdMulti AND IdRepuestoReparacion IS NOT NULL) x;
SET @RepFn=dbo.fn_TotalRepuestosOrden(@IdOrdMulti);
-- relacion opcional: una orden sin diagnostico debe seguir apareciendo (1 fila, con diagnostico NULL)
SELECT TOP 1 @IdOrdSin=o.IdOrden FROM dbo.OrdenServicio o
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Diagnostico d WHERE d.IdOrden=o.IdOrden) ORDER BY o.IdOrden;
SELECT @RowsSin=COUNT(*),@DiagNulos=SUM(CASE WHEN IdDiagnostico IS NULL THEN 1 ELSE 0 END)
FROM dbo.vw_TrazabilidadOrden WHERE IdOrden=@IdOrdSin;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T12','Trazabilidad completa sin multiplicar totales','Filas = grano esperado; un solo TotalFactura igual al real; repuestos = fn_TotalRepuestosOrden; la orden sin diagnostico sigue apareciendo',
 CONCAT('Orden ',@IdOrdMulti,': filas ',@RowsAct,' (esperadas ',@RowsEsp,'); TotalFactura distintos ',@FacDist,' (',@FacVista,' vs ',@FacReal,'); repuestos ',@RepVista,' vs ',@RepFn,
        '. Orden sin diagnostico ',ISNULL(CONVERT(VARCHAR(10),@IdOrdSin),'ninguna'),': ',ISNULL(@RowsSin,0),' fila(s), ',ISNULL(@DiagNulos,0),' con diagnostico NULL'),
 CASE WHEN @RowsAct=@RowsEsp AND @FacDist=1 AND @FacVista=@FacReal AND @RepVista=@RepFn AND @RowsSin=1 AND @DiagNulos=1 THEN 'PASS' ELSE 'FAIL' END);
EXEC dbo.usp_ReporteTrazabilidad @IdOrden=@IdOrdMulti;   -- evidencia visual del reporte

/* ---------- T13: bajo minimo en bodegas distintas ---------- */
CREATE TABLE #bm(IdBodega INT,BodegaNombre VARCHAR(80),CategoriaNombre VARCHAR(80),IdRepuesto INT,Codigo VARCHAR(30),
                 RepuestoNombre VARCHAR(120),Existencia INT,StockMinimo INT);
INSERT #bm EXEC dbo.usp_ReporteBajoMinimo;
SELECT @Bm1=COUNT(*),@BodDist=COUNT(DISTINCT IdBodega) FROM #bm;
SELECT @Bm2=COUNT(*) FROM dbo.vw_InventarioActual WHERE BajoMinimo=1;
SELECT @Lst=STRING_AGG(CONCAT(BodegaNombre,':',Codigo),', ') WITHIN GROUP (ORDER BY BodegaNombre,Codigo) FROM #bm;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T13','Bajo minimo en bodegas distintas','Repuestos bajo minimo en al menos 2 bodegas y el reporte coincide con la vista de inventario',
 CONCAT('Reporte: ',@Bm1,' filas en ',@BodDist,' bodegas; vista: ',@Bm2,'. Detalle: ',@Lst),
 CASE WHEN @BodDist>=2 AND @Bm1=@Bm2 THEN 'PASS' ELSE 'FAIL' END);
DROP TABLE #bm;

/* ---------- T14: cambiar precio actual; compras/consumos/facturas anteriores sin cambios ---------- */
SELECT TOP 1 @Rep=rr.IdRepuesto FROM dbo.DetalleFactura df JOIN dbo.RepuestoReparacion rr ON rr.IdRepuestoReparacion=df.IdRepuestoReparacion
 GROUP BY rr.IdRepuesto ORDER BY COUNT(*) DESC,rr.IdRepuesto;
SELECT @Cv0=PrecioCompraReferencia,@Vv0=PrecioVenta FROM dbo.Repuesto WHERE IdRepuesto=@Rep;
SELECT @sRR0=ISNULL(SUM(PrecioVentaUnitario+PrecioCostoUnitario),0) FROM dbo.RepuestoReparacion WHERE IdRepuesto=@Rep;
SELECT @sDC0=ISNULL(SUM(CostoUnitario),0) FROM dbo.DetalleCompra WHERE IdRepuesto=@Rep;
SELECT @sDF0=ISNULL(SUM(df.PrecioUnitario),0) FROM dbo.DetalleFactura df
 JOIN dbo.RepuestoReparacion rr ON rr.IdRepuestoReparacion=df.IdRepuestoReparacion WHERE rr.IdRepuesto=@Rep;
SELECT @Aud0=COUNT(*) FROM dbo.AuditoriaPrecioRepuesto WHERE IdRepuesto=@Rep;
SET @NC=CONVERT(DECIMAL(12,2),ROUND(@Cv0*1.10,2));
SET @NV=CONVERT(DECIMAL(12,2),ROUND(@Vv0*1.10,2));
EXEC dbo.usp_ActualizarPreciosRepuesto @IdRepuesto=@Rep,@PrecioCompraReferencia=@NC,@PrecioVenta=@NV,@IdUsuario=@Bod1;
SELECT @PcN=PrecioCompraReferencia,@PvN=PrecioVenta FROM dbo.Repuesto WHERE IdRepuesto=@Rep;
SELECT @sRR1=ISNULL(SUM(PrecioVentaUnitario+PrecioCostoUnitario),0) FROM dbo.RepuestoReparacion WHERE IdRepuesto=@Rep;
SELECT @sDC1=ISNULL(SUM(CostoUnitario),0) FROM dbo.DetalleCompra WHERE IdRepuesto=@Rep;
SELECT @sDF1=ISNULL(SUM(df.PrecioUnitario),0) FROM dbo.DetalleFactura df
 JOIN dbo.RepuestoReparacion rr ON rr.IdRepuestoReparacion=df.IdRepuestoReparacion WHERE rr.IdRepuesto=@Rep;
SELECT @Aud1=COUNT(*) FROM dbo.AuditoriaPrecioRepuesto WHERE IdRepuesto=@Rep;
SELECT @AudOk=COUNT(*) FROM dbo.AuditoriaPrecioRepuesto
 WHERE IdRepuesto=@Rep AND PrecioCompraAnterior=@Cv0 AND PrecioCompraNuevo=@NC AND PrecioVentaAnterior=@Vv0 AND PrecioVentaNuevo=@NV AND IdUsuarioApp=@Bod1;
INSERT #Ev(Caso,Prueba,Esperado,Obtenido,Estado)
VALUES('T14','Cambio de precio no altera historico','Precio actual nuevo y 1 fila de auditoria; sumas de consumos, compras y facturas anteriores iguales',
 CONCAT('Repuesto ',@Rep,': venta ',@Vv0,'->',@PvN,', compra ',@Cv0,'->',@PcN,'; auditoria ',@Aud0,'->',@Aud1,' (',@AudOk,' correcta); consumos ',@sRR0,'->',@sRR1,'; compras ',@sDC0,'->',@sDC1,'; facturas ',@sDF0,'->',@sDF1),
 CASE WHEN @PvN=@NV AND @PcN=@NC AND @Aud1=@Aud0+1 AND @AudOk=1 AND @sRR0=@sRR1 AND @sDC0=@sDC1 AND @sDF0=@sDF1 THEN 'PASS' ELSE 'FAIL' END);

SELECT Caso,Prueba,Esperado,Obtenido,Estado,FechaEjecucion FROM #Ev ORDER BY Caso;
DROP TABLE #Ev;
GO
