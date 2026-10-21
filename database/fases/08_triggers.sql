/* FASE 08. Protecciones set-based y auditoria, no CRUD de inventario oculto.
   SESSION_CONTEXT es una marca interna, NO una credencial: fase 09 niega DML
   transaccional a la app. Un administrador puede alterar sus propias protecciones. */
CREATE OR ALTER TRIGGER dbo.trg_Equipo_Propietario
ON dbo.Equipo AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.IdEquipo=i.IdEquipo
   WHERE i.IdCliente<>d.IdCliente AND EXISTS(SELECT 1 FROM dbo.OrdenServicio o WHERE o.IdEquipo=i.IdEquipo))
  THROW 52050,N'No transferir un equipo con historia. El propietario es estable en este alcance.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_OrdenServicio_Ingreso
ON dbo.OrdenServicio AFTER INSERT AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=i.IdEstadoOrden
  JOIN dbo.Equipo e ON e.IdEquipo=i.IdEquipo JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente
  WHERE eo.Codigo<>'RECIBIDO' OR e.Estado<>'ACTIVO' OR c.Estado<>'ACTIVO'
   OR dbo.fn_UsuarioTienePermiso(i.IdUsuarioRecepcion,'ORDENES_CREAR')=0)
  THROW 52051,N'Ingreso invalido: estado inicial, cliente, equipo o recepcion.',1;
 IF EXISTS(SELECT o.IdEquipo FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK)
  JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden
  WHERE eo.EsFinal=0 AND o.IdEquipo IN(SELECT IdEquipo FROM inserted) GROUP BY o.IdEquipo HAVING COUNT(*)>1)
  THROW 50206,N'El equipo ya tiene una orden abierta.',1;
 INSERT dbo.HistorialEstadoOrden(IdOrden,IdEstadoAnterior,IdEstadoNuevo,FechaCambio,IdUsuario,Observacion)
  SELECT IdOrden,NULL,IdEstadoOrden,FechaIngreso,IdUsuarioRecepcion,'Ingreso del equipo' FROM inserted;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_OrdenServicio_Cambio
ON dbo.OrdenServicio AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF UPDATE(IdEquipo) OR UPDATE(IdUsuarioRecepcion) OR UPDATE(FechaIngreso) OR UPDATE(NumeroOrden)
  THROW 52052,N'No alterar la identidad historica de una orden.',1;
 IF NOT UPDATE(IdEstadoOrden) RETURN;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.IdOrden=i.IdOrden
  WHERE i.IdEstadoOrden<>d.IdEstadoOrden AND NOT EXISTS(
   SELECT 1 FROM dbo.HistorialEstadoOrden h WHERE h.IdHistorial=(SELECT MAX(h2.IdHistorial) FROM dbo.HistorialEstadoOrden h2 WHERE h2.IdOrden=i.IdOrden)
   AND h.IdEstadoAnterior=d.IdEstadoOrden AND h.IdEstadoNuevo=i.IdEstadoOrden))
  THROW 52020,N'El cambio de estado requiere historial previo coincidente.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.IdOrden=i.IdOrden WHERE i.IdEstadoOrden<>d.IdEstadoOrden
  AND NOT EXISTS(SELECT 1 FROM dbo.TransicionEstadoOrden t WHERE t.IdEstadoOrigen=d.IdEstadoOrden AND t.IdEstadoDestino=i.IdEstadoOrden))
  THROW 52021,N'Transicion no permitida.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=i.IdEstadoOrden
  WHERE eo.Codigo IN('ESPERANDO_AUTORIZACION','REPARACION') AND NOT EXISTS(SELECT 1 FROM dbo.Diagnostico d WHERE d.IdOrden=i.IdOrden AND d.Estado='ACTIVO'))
  THROW 50104,N'Se requiere diagnostico activo.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=i.IdEstadoOrden
  WHERE eo.Codigo='REPARACION' AND EXISTS(SELECT 1 FROM dbo.Factura f WHERE f.IdOrden=i.IdOrden))
  THROW 50113,N'No reabrir ordenes facturadas.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=i.IdEstadoOrden WHERE eo.Codigo='LISTO'
  AND (EXISTS(SELECT 1 FROM dbo.Reparacion r JOIN dbo.Diagnostico dg ON dg.IdDiagnostico=r.IdDiagnostico WHERE dg.IdOrden=i.IdOrden AND r.Estado='EN_PROCESO')
    OR NOT EXISTS(SELECT 1 FROM dbo.Reparacion r JOIN dbo.Diagnostico dg ON dg.IdDiagnostico=r.IdDiagnostico WHERE dg.IdOrden=i.IdOrden AND r.Estado='FINALIZADA')))
  THROW 50105,N'El servicio aun no puede marcarse listo.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=i.IdEstadoOrden WHERE eo.Codigo='ENTREGADO'
  AND (NOT EXISTS(SELECT 1 FROM dbo.Entrega en WHERE en.IdOrden=i.IdOrden)
    OR NOT EXISTS(SELECT 1 FROM dbo.Factura f WHERE f.IdOrden=i.IdOrden AND f.Estado<>'ANULADA' AND dbo.fn_SaldoFactura(f.IdFactura)=0)))
  THROW 50109,N'Entrega sin registro o sin factura vigente totalmente pagada.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=i.IdEstadoOrden WHERE eo.Codigo='CANCELADO'
  AND (EXISTS(SELECT 1 FROM dbo.Factura f WHERE f.IdOrden=i.IdOrden AND f.Estado<>'ANULADA')
   OR EXISTS(SELECT 1 FROM dbo.RepuestoReparacion rr JOIN dbo.Reparacion r ON r.IdReparacion=rr.IdReparacion
    JOIN dbo.Diagnostico dg ON dg.IdDiagnostico=r.IdDiagnostico WHERE dg.IdOrden=i.IdOrden AND rr.Estado='ACTIVO')))
  THROW 50110,N'No cancelar una orden con factura vigente o consumo.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Historial_Validar
ON dbo.HistorialEstadoOrden AFTER INSERT AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.OrdenServicio o ON o.IdOrden=i.IdOrden
  JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=i.IdEstadoNuevo
  WHERE (i.IdEstadoAnterior IS NULL AND (e.Codigo<>'RECIBIDO' OR o.IdEstadoOrden<>i.IdEstadoNuevo))
   OR (i.IdEstadoAnterior IS NOT NULL AND (o.IdEstadoOrden<>i.IdEstadoAnterior
     OR NOT EXISTS(SELECT 1 FROM dbo.TransicionEstadoOrden t WHERE t.IdEstadoOrigen=i.IdEstadoAnterior AND t.IdEstadoDestino=i.IdEstadoNuevo)))
   OR NOT EXISTS(SELECT 1 FROM dbo.Usuario u WHERE u.IdUsuario=i.IdUsuario AND u.Activo=1))
  THROW 52053,N'Historial sin estado anterior o usuario valido.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Diagnostico_Validar
ON dbo.Diagnostico AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.IdDiagnostico=i.IdDiagnostico
  WHERE (d.IdDiagnostico IS NULL OR i.IdTecnico<>d.IdTecnico) AND dbo.fn_UsuarioTieneRol(i.IdTecnico,'TECNICO')=0)
  THROW 52030,N'Tecnico no autorizado.',1;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.IdDiagnostico=i.IdDiagnostico
  JOIN dbo.OrdenServicio o ON o.IdOrden=i.IdOrden JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden
  WHERE d.IdDiagnostico IS NULL AND (eo.Codigo<>'DIAGNOSTICO' OR i.Estado<>'ACTIVO' OR i.FechaDiagnostico<o.FechaIngreso))
  THROW 52054,N'El diagnostico requiere orden en diagnostico y fecha coherente.',1;
 IF EXISTS(SELECT 1 FROM deleted) AND (UPDATE(IdOrden) OR UPDATE(IdTecnico) OR UPDATE(FechaDiagnostico) OR UPDATE(Descripcion) OR UPDATE(CostoManoObraEstimado))
  THROW 52055,N'El diagnostico es historico; corregir mediante anulacion controlada.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.IdDiagnostico=i.IdDiagnostico
  WHERE (d.Estado='ANULADO' AND i.Estado<>d.Estado) OR (i.Estado='ANULADO' AND EXISTS(SELECT 1 FROM dbo.Reparacion r WHERE r.IdDiagnostico=i.IdDiagnostico)))
  THROW 52056,N'No reactivar ni anular diagnosticos usados en reparacion.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Reparacion_Validar
ON dbo.Reparacion AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted old ON old.IdReparacion=i.IdReparacion
  WHERE (old.IdReparacion IS NULL OR i.IdTecnico<>old.IdTecnico) AND dbo.fn_UsuarioTieneRol(i.IdTecnico,'TECNICO')=0)
  THROW 52031,N'Tecnico no autorizado.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Diagnostico d ON d.IdDiagnostico=i.IdDiagnostico
  JOIN dbo.OrdenServicio o ON o.IdOrden=d.IdOrden JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden
  LEFT JOIN deleted old ON old.IdReparacion=i.IdReparacion
  WHERE old.IdReparacion IS NULL AND (d.Estado<>'ACTIVO' OR eo.Codigo NOT IN('ESPERANDO_AUTORIZACION','REPARACION')
   OR i.Estado<>'EN_PROCESO' OR i.FechaInicio<d.FechaDiagnostico OR EXISTS(SELECT 1 FROM dbo.Factura f WHERE f.IdOrden=o.IdOrden)))
  THROW 52057,N'Reparacion sin diagnostico previo, estado valido o servicio no facturado.',1;
 IF EXISTS(SELECT 1 FROM deleted) AND (UPDATE(IdDiagnostico) OR UPDATE(IdTecnico) OR UPDATE(FechaInicio))
  THROW 52058,N'No alterar las relaciones historicas de reparacion.',1;
 IF EXISTS(SELECT 1 FROM deleted d JOIN dbo.Diagnostico dg ON dg.IdDiagnostico=d.IdDiagnostico
  WHERE d.Estado<>'EN_PROCESO' OR EXISTS(SELECT 1 FROM dbo.Factura f WHERE f.IdOrden=dg.IdOrden))
  THROW 52059,N'La reparacion cerrada/facturada no se modifica.',1;
 IF EXISTS(SELECT 1 FROM inserted i WHERE i.Estado='CANCELADA' AND EXISTS(SELECT 1 FROM dbo.RepuestoReparacion rr WHERE rr.IdReparacion=i.IdReparacion AND rr.Estado='ACTIVO'))
  THROW 50110,N'No cancelar reparacion con consumo activo.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Actividad_Validar
ON dbo.ActividadReparacion AFTER INSERT AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Reparacion r ON r.IdReparacion=i.IdReparacion
  WHERE r.Estado<>'EN_PROCESO' OR dbo.fn_UsuarioTieneRol(i.IdTecnico,'TECNICO')=0 OR i.FechaActividad<r.FechaInicio)
  THROW 52060,N'Actividad sin reparacion abierta o tecnico autorizado.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Inventario_Existencia
ON dbo.InventarioBodega AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM deleted) AND (UPDATE(IdBodega) OR UPDATE(IdRepuesto)) THROW 52061,N'No cambiar la clave del inventario.',1;
 IF ISNULL(TRY_CONVERT(INT,SESSION_CONTEXT(N'ProcesoInventario')),0)=1 RETURN;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.IdBodega=i.IdBodega AND d.IdRepuesto=i.IdRepuesto WHERE i.Existencia<>ISNULL(d.Existencia,0))
  THROW 52010,N'Existencia solo mediante procesos controlados.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Consumo_Validar
ON dbo.RepuestoReparacion AFTER INSERT AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF ISNULL(TRY_CONVERT(INT,SESSION_CONTEXT(N'ProcesoInventario')),0)<>1 THROW 52011,N'Consumo fuera de proceso.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Reparacion r ON r.IdReparacion=i.IdReparacion
  JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico JOIN dbo.OrdenServicio o ON o.IdOrden=d.IdOrden
  JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden JOIN dbo.Bodega b ON b.IdBodega=i.IdBodega
  JOIN dbo.Repuesto rp ON rp.IdRepuesto=i.IdRepuesto
  WHERE r.Estado<>'EN_PROCESO' OR eo.Codigo<>'REPARACION' OR b.Estado<>'ACTIVA' OR rp.Estado<>'ACTIVO'
   OR dbo.fn_UsuarioTienePermiso(i.IdUsuario,'REPUESTOS_CONSUMIR')=0 OR i.Estado<>'ACTIVO')
  THROW 52062,N'Consumo incompatible con servicio, usuario o catalogo.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Movimiento_Validar
ON dbo.MovimientoInventario AFTER INSERT AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF ISNULL(TRY_CONVERT(INT,SESSION_CONTEXT(N'ProcesoInventario')),0)<>1 THROW 52011,N'Movimiento fuera de proceso.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.TipoMovimiento t ON t.IdTipoMovimiento=i.IdTipoMovimiento
  JOIN dbo.InventarioBodega ib ON ib.IdBodega=i.IdBodega AND ib.IdRepuesto=i.IdRepuesto
  LEFT JOIN dbo.DetalleCompra dc ON dc.IdDetalleCompra=i.IdDetalleCompra
  LEFT JOIN dbo.Compra co ON co.IdCompra=dc.IdCompra
  LEFT JOIN dbo.RepuestoReparacion rr ON rr.IdRepuestoReparacion=i.IdRepuestoReparacion
  OUTER APPLY(SELECT TOP(1) m.ExistenciaResultante FROM dbo.MovimientoInventario m
    WHERE m.IdBodega=i.IdBodega AND m.IdRepuesto=i.IdRepuesto AND m.IdMovimiento<i.IdMovimiento ORDER BY m.IdMovimiento DESC) previo
  WHERE ib.Existencia<>i.ExistenciaResultante
   OR i.ExistenciaResultante<>ISNULL(previo.ExistenciaResultante,0)+CASE WHEN t.Naturaleza='E' THEN i.Cantidad ELSE -i.Cantidad END
   OR (i.DocumentoOrigen='COMPRA' AND (t.Codigo<>'COMPRA_ENTRADA' OR t.Naturaleza<>'E' OR dc.IdRepuesto<>i.IdRepuesto OR co.IdBodegaDestino<>i.IdBodega OR dc.Cantidad<>i.Cantidad))
   OR (i.DocumentoOrigen='REPARACION' AND (t.Codigo<>'CONSUMO_REPARACION' OR t.Naturaleza<>'S' OR rr.IdRepuesto<>i.IdRepuesto OR rr.IdBodega<>i.IdBodega OR rr.Cantidad<>i.Cantidad))
   OR (i.DocumentoOrigen='AJUSTE' AND (t.Codigo NOT IN('AJUSTE_ENTRADA','AJUSTE_SALIDA') OR i.Observacion IS NULL OR LEN(LTRIM(RTRIM(i.Observacion)))=0))
   OR (t.Codigo IN('COMPRA_ENTRADA','AJUSTE_ENTRADA') AND t.Naturaleza<>'E')
   OR (t.Codigo IN('CONSUMO_REPARACION','AJUSTE_SALIDA') AND t.Naturaleza<>'S'))
  THROW 52063,N'Movimiento no coincide con origen, cantidad o kardex.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Compra_Validar
ON dbo.Compra AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.IdCompra=i.IdCompra WHERE d.IdCompra IS NULL
  AND (i.Estado<>'PENDIENTE' OR dbo.fn_UsuarioTienePermiso(i.IdUsuarioRegistro,'COMPRAS_GESTIONAR')=0))
  THROW 52064,N'La compra debe iniciar pendiente con usuario autorizado.',1;
 IF EXISTS(SELECT 1 FROM deleted WHERE Estado<>'PENDIENTE') THROW 52065,N'Compra recibida/anulada es historica.',1;
 IF EXISTS(SELECT 1 FROM deleted) AND (UPDATE(IdProveedor) OR UPDATE(IdBodegaDestino) OR UPDATE(IdUsuarioRegistro) OR UPDATE(FechaCompra) OR UPDATE(NumeroCompra))
  THROW 52066,N'No cambiar identidad u origen de la compra.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.IdCompra=i.IdCompra WHERE i.Estado='RECIBIDA'
  AND (ISNULL(TRY_CONVERT(INT,SESSION_CONTEXT(N'ProcesoInventario')),0)<>1
   OR dbo.fn_UsuarioTienePermiso(i.IdUsuarioRecepcion,'COMPRAS_GESTIONAR')=0
   OR NOT EXISTS(SELECT 1 FROM dbo.DetalleCompra dc WHERE dc.IdCompra=i.IdCompra)
   OR EXISTS(SELECT 1 FROM dbo.DetalleCompra dc WHERE dc.IdCompra=i.IdCompra AND NOT EXISTS(SELECT 1 FROM dbo.MovimientoInventario m WHERE m.IdDetalleCompra=dc.IdDetalleCompra))))
  THROW 52067,N'Recepcion sin detalle/movimientos o usuario autorizado.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_DetalleCompra_Validar
ON dbo.DetalleCompra AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Compra c ON c.IdCompra=i.IdCompra WHERE c.Estado<>'PENDIENTE')
  THROW 52068,N'El detalle recibido/anulado no se altera.',1;
 IF EXISTS(SELECT 1 FROM deleted) AND (UPDATE(IdCompra) OR UPDATE(IdRepuesto)) THROW 52069,N'No cambiar origen de la linea.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Factura_Insertar
ON dbo.Factura AFTER INSERT AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.OrdenServicio o ON o.IdOrden=i.IdOrden JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden
  WHERE e.Codigo<>'LISTO' OR i.Estado<>'EMITIDA' OR i.Total<=0 OR dbo.fn_UsuarioTienePermiso(i.IdUsuario,'FACTURAR')=0
   OR i.SubtotalManoObra<>dbo.fn_TotalManoObraOrden(i.IdOrden) OR i.SubtotalRepuestos<>dbo.fn_TotalRepuestosOrden(i.IdOrden))
  THROW 52070,N'Factura incompatible con servicio o conceptos historicos.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Factura_Proteger
ON dbo.Factura AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF UPDATE(NumeroFactura) OR UPDATE(IdOrden) OR UPDATE(IdUsuario) OR UPDATE(NITFacturacion) OR UPDATE(NombreFacturacion)
  OR UPDATE(DireccionFacturacion) OR UPDATE(FechaFactura) OR UPDATE(SubtotalManoObra) OR UPDATE(SubtotalRepuestos) OR UPDATE(PorcentajeImpuesto)
  THROW 52071,N'No modificar conceptos ni datos de una factura emitida.',1;
 IF EXISTS(SELECT 1 FROM inserted i WHERE (i.Estado='PAGADA' AND dbo.fn_SaldoFactura(i.IdFactura)<>0)
   OR (i.Estado='EMITIDA' AND dbo.fn_SaldoFactura(i.IdFactura)<=0)
   OR (i.Estado='ANULADA' AND (EXISTS(SELECT 1 FROM dbo.Pago p WHERE p.IdFactura=i.IdFactura AND p.Estado='APLICADO')
     OR EXISTS(SELECT 1 FROM dbo.Entrega e WHERE e.IdOrden=i.IdOrden))))
  THROW 52072,N'Estado de factura incompatible con pagos/entrega.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_DetalleFactura_Origen
ON dbo.DetalleFactura AFTER INSERT AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Factura f ON f.IdFactura=i.IdFactura
  LEFT JOIN dbo.Reparacion r ON r.IdReparacion=i.IdReparacion LEFT JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico
  LEFT JOIN dbo.RepuestoReparacion rr ON rr.IdRepuestoReparacion=i.IdRepuestoReparacion
  LEFT JOIN dbo.Reparacion rp ON rp.IdReparacion=rr.IdReparacion LEFT JOIN dbo.Diagnostico dp ON dp.IdDiagnostico=rp.IdDiagnostico
  WHERE f.Estado<>'EMITIDA' OR EXISTS(SELECT 1 FROM dbo.Pago p WHERE p.IdFactura=f.IdFactura)
   OR (i.TipoLinea='MANO_OBRA' AND (d.IdOrden<>f.IdOrden OR r.Estado<>'FINALIZADA' OR i.Cantidad<>1 OR i.PrecioUnitario<>r.CostoManoObra))
   OR (i.TipoLinea='REPUESTO' AND (dp.IdOrden<>f.IdOrden OR rr.Estado<>'ACTIVO' OR rp.Estado='CANCELADA' OR i.Cantidad<>rr.Cantidad OR i.PrecioUnitario<>rr.PrecioVentaUnitario)))
  THROW 52073,N'Linea de factura ajena o con precio/cantidad incorrectos.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Pago_ValidarSaldo
ON dbo.Pago AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM deleted) AND (UPDATE(IdFactura) OR UPDATE(IdMetodoPago) OR UPDATE(Monto) OR UPDATE(FechaPago) OR UPDATE(Referencia) OR UPDATE(IdUsuario))
  THROW 52074,N'El pago no se edita; usar anulacion con motivo.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.IdPago=i.IdPago WHERE d.Estado<>'APLICADO' OR i.Estado<>'ANULADO')
  THROW 52075,N'Solo se admite anular una vez un pago aplicado.',1;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.IdPago=i.IdPago JOIN dbo.MetodoPago mp ON mp.IdMetodoPago=i.IdMetodoPago
  WHERE d.IdPago IS NULL AND (i.Estado<>'APLICADO' OR mp.Activo=0 OR dbo.fn_UsuarioTienePermiso(i.IdUsuario,'PAGOS_REGISTRAR')=0))
  THROW 52076,N'Pago sin metodo o usuario autorizado.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Factura f WITH(UPDLOCK,HOLDLOCK) ON f.IdFactura=i.IdFactura WHERE f.Estado='ANULADA')
  THROW 52001,N'No modificar pagos de factura anulada.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.IdPago=i.IdPago JOIN dbo.Factura f ON f.IdFactura=i.IdFactura
  JOIN dbo.OrdenServicio o ON o.IdOrden=f.IdOrden JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden WHERE eo.Codigo='ENTREGADO')
  THROW 51205,N'No anular pagos despues de entregar.',1;
 IF EXISTS(SELECT 1 FROM dbo.Factura f WITH(UPDLOCK,HOLDLOCK)
  CROSS APPLY(SELECT ISNULL(SUM(p.Monto),0) AS Pagado FROM dbo.Pago p WITH(UPDLOCK,HOLDLOCK) WHERE p.IdFactura=f.IdFactura AND p.Estado='APLICADO') s
  WHERE f.IdFactura IN(SELECT IdFactura FROM inserted) AND s.Pagado>f.Total)
  THROW 52002,N'La suma de pagos excede el total.',1;
 UPDATE f SET Estado=CASE WHEN dbo.fn_SaldoFactura(f.IdFactura)=0 THEN 'PAGADA' ELSE 'EMITIDA' END
  FROM dbo.Factura f WHERE f.IdFactura IN(SELECT IdFactura FROM inserted) AND f.Estado<>'ANULADA';
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Entrega_Validar
ON dbo.Entrega AFTER INSERT AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.OrdenServicio o ON o.IdOrden=i.IdOrden JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden
  WHERE eo.Codigo<>'LISTO' OR dbo.fn_UsuarioTienePermiso(i.IdUsuarioEntrega,'ENTREGAR_ORDEN')=0
   OR NOT EXISTS(SELECT 1 FROM dbo.Factura f WITH(UPDLOCK,HOLDLOCK) WHERE f.IdOrden=i.IdOrden AND f.Estado<>'ANULADA' AND dbo.fn_SaldoFactura(f.IdFactura)=0))
  THROW 50109,N'Entrega sin servicio listo, permiso o factura pagada.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Repuesto_AuditoriaPrecio
ON dbo.Repuesto AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF NOT(UPDATE(PrecioCompraReferencia) OR UPDATE(PrecioVenta)) RETURN;
 INSERT dbo.AuditoriaPrecioRepuesto(IdRepuesto,PrecioCompraAnterior,PrecioCompraNuevo,PrecioVentaAnterior,PrecioVentaNuevo,IdUsuarioApp)
 SELECT i.IdRepuesto,d.PrecioCompraReferencia,i.PrecioCompraReferencia,d.PrecioVenta,i.PrecioVenta,
  TRY_CONVERT(INT,SESSION_CONTEXT(N'IdUsuarioApp'))
 FROM inserted i JOIN deleted d ON d.IdRepuesto=i.IdRepuesto
 WHERE i.PrecioCompraReferencia<>d.PrecioCompraReferencia OR i.PrecioVenta<>d.PrecioVenta;
END;
GO
/* R14: NO ACTION no protege filas hoja. Triggers explicitos, sin SQL dinamico. */
CREATE OR ALTER TRIGGER dbo.trg_Orden_NoEliminar ON dbo.OrdenServicio INSTEAD OF DELETE AS
BEGIN SET NOCOUNT ON; THROW 52040,N'Las ordenes se cancelan, no se eliminan.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Diagnostico_NoEliminar ON dbo.Diagnostico INSTEAD OF DELETE AS
BEGIN SET NOCOUNT ON; THROW 52040,N'Los diagnosticos se anulan, no se eliminan.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Reparacion_NoEliminar ON dbo.Reparacion INSTEAD OF DELETE AS
BEGIN SET NOCOUNT ON; THROW 52040,N'Las reparaciones se cancelan, no se eliminan.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Actividad_Inmutable ON dbo.ActividadReparacion INSTEAD OF UPDATE,DELETE AS
BEGIN SET NOCOUNT ON; THROW 52041,N'No editar ni eliminar actividades historicas.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Historial_Inmutable ON dbo.HistorialEstadoOrden INSTEAD OF UPDATE,DELETE AS
BEGIN SET NOCOUNT ON; THROW 52041,N'No editar ni eliminar historial.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Compra_NoEliminar ON dbo.Compra INSTEAD OF DELETE AS
BEGIN SET NOCOUNT ON; THROW 52040,N'Las compras se anulan, no se eliminan.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_DetalleCompra_NoEliminar ON dbo.DetalleCompra INSTEAD OF DELETE AS
BEGIN SET NOCOUNT ON; THROW 52040,N'No eliminar detalles de compras.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Consumo_Inmutable ON dbo.RepuestoReparacion INSTEAD OF UPDATE,DELETE AS
BEGIN SET NOCOUNT ON; THROW 52041,N'No editar/eliminar un consumo aplicado; requiere proceso compensatorio.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Movimiento_Inmutable ON dbo.MovimientoInventario INSTEAD OF UPDATE,DELETE AS
BEGIN SET NOCOUNT ON; THROW 52012,N'El kardex es inmutable.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Inventario_NoEliminar ON dbo.InventarioBodega INSTEAD OF DELETE AS
BEGIN SET NOCOUNT ON; THROW 52040,N'No eliminar existencias ni su historia.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Factura_NoEliminar ON dbo.Factura INSTEAD OF DELETE AS
BEGIN SET NOCOUNT ON; THROW 52042,N'Las facturas se anulan, no se eliminan.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_DetalleFactura_Inmutable ON dbo.DetalleFactura INSTEAD OF UPDATE,DELETE AS
BEGIN SET NOCOUNT ON; THROW 52041,N'El detalle de factura es historico.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Pago_NoEliminar ON dbo.Pago INSTEAD OF DELETE AS
BEGIN SET NOCOUNT ON; THROW 52043,N'Los pagos se anulan, no se eliminan.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Entrega_Inmutable ON dbo.Entrega INSTEAD OF UPDATE,DELETE AS
BEGIN SET NOCOUNT ON; THROW 52041,N'La entrega es historica.',1; END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Auditoria_Inmutable ON dbo.AuditoriaPrecioRepuesto INSTEAD OF UPDATE,DELETE AS
BEGIN SET NOCOUNT ON; THROW 52041,N'La auditoria es historica.',1; END;
GO
