/* DATOS SEMILLA 03 · compras, recepciones e inventario.
   Todo pasa por los SP oficiales (sp_RegistrarCompra, sp_RecibirCompra,
   sp_AjustarInventario): la existencia y el kardex NO se insertan a mano.
   Genera: 23 compras (20 recibidas, 3 pendientes). Las compras 1-20 cubren los
   30 repuestos en BOD-01 y BOD-02 (60 combinaciones). BOD-03 se llena con ajustes.
   Escenarios: stock cero, ultima unidad, bajo minimo en 3 bodegas, repuesto en varias bodegas. */
USE TechCareDB;
GO
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

IF (SELECT COUNT(*) FROM dbo.Repuesto) < 30 OR (SELECT COUNT(*) FROM dbo.Bodega) < 3
    THROW 59010, N'Falta ejecutar 02_maestros_semilla.sql.', 1;
IF EXISTS(SELECT 1 FROM dbo.Compra) OR EXISTS(SELECT 1 FROM dbo.InventarioBodega)
    THROW 59011, N'Compras o inventario ya tienen datos; este script no se ejecuta dos veces.', 1;

DECLARE @Bod1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='bodega1'),
        @Bod2 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='bodega2'),
        @B1 INT=(SELECT IdBodega FROM dbo.Bodega WHERE Codigo='BOD-01'),
        @B2 INT=(SELECT IdBodega FROM dbo.Bodega WHERE Codigo='BOD-02'),
        @B3 INT=(SELECT IdBodega FROM dbo.Bodega WHERE Codigo='BOD-03');
DECLARE @k INT=1,@j INT,@r0 INT,@bod INT,@prov INT,@id INT,@doc VARCHAR(40),@obs VARCHAR(500);
DECLARE @rep INT,@e INT,@q INT;
DECLARE @det dbo.tvp_DetalleCompra;

/* ---- Compras 1-20: se registran y se reciben. 21-23: quedan PENDIENTES. ---- */
WHILE @k<=23
BEGIN
  DELETE FROM @det;
  SET @j=(@k+1)/2;
  SET @r0=CASE WHEN @k<=20 THEN (@j-1)*3+1 WHEN @k=21 THEN 1 WHEN @k=22 THEN 7 ELSE 20 END;
  SET @bod=CASE WHEN @k=23 THEN @B3 WHEN @k%2=1 THEN @B1 ELSE @B2 END;
  SELECT @prov=IdProveedor FROM (SELECT IdProveedor,ROW_NUMBER() OVER(ORDER BY IdProveedor) AS rn FROM dbo.Proveedor) p
   WHERE p.rn=((@k-1)%8)+1;
  SET @doc=CONCAT('DOC-PROV-',RIGHT(CONCAT('000',@k),3));
  SET @obs=CASE WHEN @k<=20 THEN CONCAT('Compra de prueba ',@k,' (recibida)') ELSE CONCAT('Compra de prueba ',@k,' (pendiente de recibir)') END;

  INSERT @det(IdRepuesto,Cantidad,CostoUnitario)
  SELECT r.IdRepuesto,CASE WHEN @k<=20 THEN 25+((r.rn*3)%11) ELSE 10 END,r.PrecioCompraReferencia
  FROM (SELECT IdRepuesto,PrecioCompraReferencia,CONVERT(INT,ROW_NUMBER() OVER(ORDER BY Codigo)) AS rn FROM dbo.Repuesto) r
  WHERE r.rn BETWEEN @r0 AND @r0+2;

  EXEC dbo.sp_RegistrarCompra @IdProveedor=@prov,@IdBodegaDestino=@bod,@IdUsuario=@Bod1,
       @NumeroDocumentoProveedor=@doc,@Observaciones=@obs,@Detalle=@det,@IdCompra=@id OUTPUT;
  IF @k<=20 EXEC dbo.sp_RecibirCompra @IdCompra=@id,@IdUsuario=@Bod2;
  SET @k+=1;
END;

/* ---- Stock minimo base (3 a 7). Solo cambia StockMinimo; la existencia no se toca. ---- */
UPDATE dbo.InventarioBodega SET StockMinimo=3+(IdRepuesto%5);

/* ---- Escenarios de inventario (via sp_AjustarInventario, con motivo) ---- */
-- Stock CERO: BOD-01 / REP-005
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-005';
SELECT @e=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B1 AND IdRepuesto=@rep;
EXEC dbo.sp_AjustarInventario @IdBodega=@B1,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_SALIDA',@Cantidad=@e,
     @IdUsuario=@Bod1,@Observacion='Ajuste de prueba: merma total, stock en cero';

-- ULTIMA UNIDAD (para CON-01): BOD-02 / REP-009 queda con 1 (y bajo minimo)
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-009';
SELECT @e=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B2 AND IdRepuesto=@rep;
SET @q=@e-1;
EXEC dbo.sp_AjustarInventario @IdBodega=@B2,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_SALIDA',@Cantidad=@q,
     @IdUsuario=@Bod2,@Observacion='Ajuste de prueba: dejar una sola unidad';

-- BAJO MINIMO: BOD-02 / REP-012 (2 de minimo 5)
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-012';
SELECT @e=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B2 AND IdRepuesto=@rep;
SET @q=@e-2;
EXEC dbo.sp_AjustarInventario @IdBodega=@B2,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_SALIDA',@Cantidad=@q,
     @IdUsuario=@Bod1,@Observacion='Ajuste de prueba: stock bajo minimo',@StockMinimo=5;

-- BAJO MINIMO: BOD-01 / REP-020 (3 de minimo 8)
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-020';
SELECT @e=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@B1 AND IdRepuesto=@rep;
SET @q=@e-3;
EXEC dbo.sp_AjustarInventario @IdBodega=@B1,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_SALIDA',@Cantidad=@q,
     @IdUsuario=@Bod1,@Observacion='Ajuste de prueba: stock bajo minimo',@StockMinimo=8;

-- BOD-03 (reserva): entradas por ajuste; REP-020 queda bajo minimo tambien aqui
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-020';
EXEC dbo.sp_AjustarInventario @IdBodega=@B3,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_ENTRADA',@Cantidad=2,
     @IdUsuario=@Bod2,@Observacion='Existencia inicial de reserva (prueba)',@StockMinimo=6;
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-004';
EXEC dbo.sp_AjustarInventario @IdBodega=@B3,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_ENTRADA',@Cantidad=15,
     @IdUsuario=@Bod2,@Observacion='Existencia inicial de reserva (prueba)',@StockMinimo=5;
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-011';
EXEC dbo.sp_AjustarInventario @IdBodega=@B3,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_ENTRADA',@Cantidad=12,
     @IdUsuario=@Bod2,@Observacion='Existencia inicial de reserva (prueba)',@StockMinimo=4;
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-027';
EXEC dbo.sp_AjustarInventario @IdBodega=@B3,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_ENTRADA',@Cantidad=30,
     @IdUsuario=@Bod2,@Observacion='Existencia inicial de reserva (prueba)',@StockMinimo=10;
SELECT @rep=IdRepuesto FROM dbo.Repuesto WHERE Codigo='REP-028';
EXEC dbo.sp_AjustarInventario @IdBodega=@B3,@IdRepuesto=@rep,@CodigoTipoMovimiento='AJUSTE_ENTRADA',@Cantidad=20,
     @IdUsuario=@Bod2,@Observacion='Existencia inicial de reserva (prueba)',@StockMinimo=5;

SELECT N'Compras' AS Concepto,COUNT(*) AS Filas FROM dbo.Compra
UNION ALL SELECT N'Compras recibidas',COUNT(*) FROM dbo.Compra WHERE Estado='RECIBIDA'
UNION ALL SELECT N'Compras pendientes',COUNT(*) FROM dbo.Compra WHERE Estado='PENDIENTE'
UNION ALL SELECT N'Combinaciones de inventario',COUNT(*) FROM dbo.InventarioBodega
UNION ALL SELECT N'Movimientos',COUNT(*) FROM dbo.MovimientoInventario;
GO
