/* VERIFICACION de los datos semilla. Solo lectura.*/
USE TechCareDB;
GO
SET NOCOUNT ON;

/* 1. Volumenes minimos */
SELECT Control,Valor,Minimo,CASE WHEN Valor>=Minimo THEN 'PASS' ELSE 'FAIL' END AS Resultado FROM (
 SELECT N'Usuarios' AS Control,(SELECT COUNT(*) FROM dbo.Usuario) AS Valor,10 AS Minimo
 UNION ALL SELECT N'Clientes',(SELECT COUNT(*) FROM dbo.Cliente),30
 UNION ALL SELECT N'Equipos',(SELECT COUNT(*) FROM dbo.Equipo),45
 UNION ALL SELECT N'Ordenes',(SELECT COUNT(*) FROM dbo.OrdenServicio),60
 UNION ALL SELECT N'Diagnosticos',(SELECT COUNT(*) FROM dbo.Diagnostico),45
 UNION ALL SELECT N'Reparaciones',(SELECT COUNT(*) FROM dbo.Reparacion),35
 UNION ALL SELECT N'Repuestos',(SELECT COUNT(*) FROM dbo.Repuesto),30
 UNION ALL SELECT N'Bodegas',(SELECT COUNT(*) FROM dbo.Bodega),3
 UNION ALL SELECT N'Combinaciones de inventario',(SELECT COUNT(*) FROM dbo.InventarioBodega),60
 UNION ALL SELECT N'Proveedores',(SELECT COUNT(*) FROM dbo.Proveedor),8
 UNION ALL SELECT N'Compras',(SELECT COUNT(*) FROM dbo.Compra),20
 UNION ALL SELECT N'Movimientos con origen',(SELECT COUNT(*) FROM dbo.MovimientoInventario),100
 UNION ALL SELECT N'Facturas',(SELECT COUNT(*) FROM dbo.Factura),30
 UNION ALL SELECT N'Pagos',(SELECT COUNT(*) FROM dbo.Pago),40
 UNION ALL SELECT N'Roles distintos con usuario',(SELECT COUNT(DISTINCT IdRol) FROM dbo.UsuarioRol),5
) x;

/* 2. Escenarios (cada uno debe ser >= 1) */
SELECT Escenario,Valor,CASE WHEN Valor>=1 THEN 'PASS' ELSE 'FAIL' END AS Resultado FROM (
 SELECT N'Cliente sin ordenes' AS Escenario,
  (SELECT COUNT(*) FROM dbo.Cliente c WHERE NOT EXISTS(SELECT 1 FROM dbo.Equipo e JOIN dbo.OrdenServicio o ON o.IdEquipo=e.IdEquipo WHERE e.IdCliente=c.IdCliente)) AS Valor
 UNION ALL SELECT N'Equipo con 3+ ordenes',(SELECT COUNT(*) FROM (SELECT IdEquipo FROM dbo.OrdenServicio GROUP BY IdEquipo HAVING COUNT(*)>=3) t)
 UNION ALL SELECT N'Orden sin diagnostico',(SELECT COUNT(*) FROM dbo.OrdenServicio o WHERE NOT EXISTS(SELECT 1 FROM dbo.Diagnostico d WHERE d.IdOrden=o.IdOrden))
 UNION ALL SELECT N'Diagnosticada sin reparacion',(SELECT COUNT(*) FROM dbo.Diagnostico d WHERE d.Estado='ACTIVO' AND NOT EXISTS(SELECT 1 FROM dbo.Reparacion r WHERE r.IdDiagnostico=d.IdDiagnostico))
 UNION ALL SELECT N'Reparacion sin repuestos',(SELECT COUNT(*) FROM dbo.Reparacion r WHERE NOT EXISTS(SELECT 1 FROM dbo.RepuestoReparacion rr WHERE rr.IdReparacion=r.IdReparacion))
 UNION ALL SELECT N'Reparacion con varios repuestos',(SELECT COUNT(*) FROM (SELECT IdReparacion FROM dbo.RepuestoReparacion GROUP BY IdReparacion HAVING COUNT(*)>=2) t)
 UNION ALL SELECT N'Reparacion con repuestos',(SELECT COUNT(DISTINCT IdReparacion) FROM dbo.RepuestoReparacion)
 UNION ALL SELECT N'Orden con 2 reparaciones',(SELECT COUNT(*) FROM (SELECT d.IdOrden FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico GROUP BY d.IdOrden HAVING COUNT(*)>=2) t)
 UNION ALL SELECT N'Repuesto en varias bodegas',(SELECT COUNT(*) FROM (SELECT IdRepuesto FROM dbo.InventarioBodega GROUP BY IdRepuesto HAVING COUNT(*)>=2) t)
 UNION ALL SELECT N'Stock cero',(SELECT COUNT(*) FROM dbo.InventarioBodega WHERE Existencia=0)
 UNION ALL SELECT N'Bajo minimo en 3 bodegas distintas',(SELECT CASE WHEN COUNT(DISTINCT IdBodega)>=3 THEN 1 ELSE 0 END FROM dbo.InventarioBodega WHERE Existencia<=StockMinimo)
 UNION ALL SELECT N'Factura con varios pagos',(SELECT COUNT(*) FROM (SELECT IdFactura FROM dbo.Pago WHERE Estado='APLICADO' GROUP BY IdFactura HAVING COUNT(*)>=2) t)
 UNION ALL SELECT N'Factura con saldo pendiente',(SELECT COUNT(*) FROM dbo.vw_FacturaSaldo WHERE Saldo>0)
 UNION ALL SELECT N'Pago anulado',(SELECT COUNT(*) FROM dbo.Pago WHERE Estado='ANULADO')
 UNION ALL SELECT N'Compra pendiente',(SELECT COUNT(*) FROM dbo.Compra WHERE Estado='PENDIENTE')
 UNION ALL SELECT N'Movimientos de entrada',(SELECT COUNT(*) FROM dbo.vw_MovimientosInventario WHERE Naturaleza='E')
 UNION ALL SELECT N'Movimientos de salida',(SELECT COUNT(*) FROM dbo.vw_MovimientosInventario WHERE Naturaleza='S')
 UNION ALL SELECT N'Usuario sin rol',(SELECT COUNT(*) FROM dbo.Usuario u WHERE NOT EXISTS(SELECT 1 FROM dbo.UsuarioRol ur WHERE ur.IdUsuario=u.IdUsuario))
 UNION ALL SELECT N'Usuario inactivo',(SELECT COUNT(*) FROM dbo.Usuario WHERE Activo=0)
) x;

/* 3. Integridad: todos los valores deben ser 0 */
SELECT Control,Valor,CASE WHEN Valor=0 THEN 'PASS' ELSE 'FAIL' END AS Resultado FROM (
 SELECT N'Existencia distinta del ultimo kardex' AS Control,
  (SELECT COUNT(*) FROM dbo.InventarioBodega ib
   WHERE ib.Existencia<>ISNULL((SELECT TOP 1 m.ExistenciaResultante FROM dbo.MovimientoInventario m
                                WHERE m.IdBodega=ib.IdBodega AND m.IdRepuesto=ib.IdRepuesto ORDER BY m.IdMovimiento DESC),0)) AS Valor
 UNION ALL SELECT N'Factura: cabecera distinta del detalle',
  (SELECT COUNT(*) FROM dbo.Factura f WHERE f.Subtotal<>(SELECT ISNULL(SUM(df.Subtotal),0) FROM dbo.DetalleFactura df WHERE df.IdFactura=f.IdFactura))
 UNION ALL SELECT N'Factura PAGADA con saldo',(SELECT COUNT(*) FROM dbo.Factura WHERE Estado='PAGADA' AND dbo.fn_SaldoFactura(IdFactura)<>0)
 UNION ALL SELECT N'Factura EMITIDA sin saldo',(SELECT COUNT(*) FROM dbo.Factura WHERE Estado='EMITIDA' AND dbo.fn_SaldoFactura(IdFactura)<=0)
 UNION ALL SELECT N'Orden ENTREGADO sin entrega o factura pagada',
  (SELECT COUNT(*) FROM dbo.OrdenServicio o JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden
   WHERE e.Codigo='ENTREGADO' AND (NOT EXISTS(SELECT 1 FROM dbo.Entrega en WHERE en.IdOrden=o.IdOrden)
     OR NOT EXISTS(SELECT 1 FROM dbo.Factura f WHERE f.IdOrden=o.IdOrden AND f.Estado='PAGADA')))
 UNION ALL SELECT N'Equipo con mas de una orden abierta',
  (SELECT COUNT(*) FROM (SELECT o.IdEquipo FROM dbo.OrdenServicio o JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE e.EsFinal=0 GROUP BY o.IdEquipo HAVING COUNT(*)>1) t)
 UNION ALL SELECT N'Orden sin historial inicial',(SELECT COUNT(*) FROM dbo.OrdenServicio o WHERE NOT EXISTS(SELECT 1 FROM dbo.HistorialEstadoOrden h WHERE h.IdOrden=o.IdOrden AND h.IdEstadoAnterior IS NULL))
 UNION ALL SELECT N'FK deshabilitadas o no confiables',(SELECT COUNT(*) FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
 UNION ALL SELECT N'CHECK deshabilitados o no confiables',(SELECT COUNT(*) FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1)
) x;
GO
