/* FASE 03. Indices segun filtros reales; no columnas redundantes eliminadas. */
CREATE UNIQUE NONCLUSTERED INDEX UX_Diagnostico_Activo ON dbo.Diagnostico(IdOrden) WHERE Estado = 'ACTIVO';
CREATE UNIQUE NONCLUSTERED INDEX UX_Cliente_NIT ON dbo.Cliente(NIT) WHERE NIT <> 'CF';
CREATE UNIQUE NONCLUSTERED INDEX UX_Movimiento_Compra ON dbo.MovimientoInventario(IdDetalleCompra) WHERE IdDetalleCompra IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX UX_Movimiento_Consumo ON dbo.MovimientoInventario(IdRepuestoReparacion) WHERE IdRepuestoReparacion IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX UX_Factura_ManoObra ON dbo.DetalleFactura(IdFactura,IdReparacion) WHERE IdReparacion IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX UX_Factura_Consumo ON dbo.DetalleFactura(IdFactura,IdRepuestoReparacion) WHERE IdRepuestoReparacion IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX UX_Historial_Inicial ON dbo.HistorialEstadoOrden(IdOrden) WHERE IdEstadoAnterior IS NULL;
CREATE NONCLUSTERED INDEX IX_Equipo_Cliente ON dbo.Equipo(IdCliente) INCLUDE (NumeroSerie,Modelo,Estado);
CREATE NONCLUSTERED INDEX IX_Orden_Estado_Prioridad ON dbo.OrdenServicio(IdEstadoOrden,IdPrioridad) INCLUDE (IdEquipo,FechaIngreso);
CREATE NONCLUSTERED INDEX IX_Orden_Equipo_Fecha ON dbo.OrdenServicio(IdEquipo,FechaIngreso DESC);
CREATE NONCLUSTERED INDEX IX_Historial_Orden ON dbo.HistorialEstadoOrden(IdOrden,IdHistorial DESC);
CREATE NONCLUSTERED INDEX IX_Diagnostico_Orden ON dbo.Diagnostico(IdOrden,Estado) INCLUDE (IdTecnico,FechaDiagnostico);
CREATE NONCLUSTERED INDEX IX_Diagnostico_Tecnico ON dbo.Diagnostico(IdTecnico,FechaDiagnostico) INCLUDE (IdOrden);
CREATE NONCLUSTERED INDEX IX_Reparacion_Diagnostico ON dbo.Reparacion(IdDiagnostico,Estado) INCLUDE (IdTecnico,CostoManoObra);
CREATE NONCLUSTERED INDEX IX_Reparacion_Tecnico ON dbo.Reparacion(IdTecnico,FechaInicio) INCLUDE (IdDiagnostico,Estado);
CREATE NONCLUSTERED INDEX IX_Actividad_Reparacion ON dbo.ActividadReparacion(IdReparacion,FechaActividad);
CREATE NONCLUSTERED INDEX IX_Consumo_Reparacion ON dbo.RepuestoReparacion(IdReparacion) INCLUDE (IdBodega,IdRepuesto,Cantidad,PrecioCostoUnitario,PrecioVentaUnitario,Estado);
CREATE NONCLUSTERED INDEX IX_Consumo_Repuesto ON dbo.RepuestoReparacion(IdRepuesto,IdBodega);
CREATE NONCLUSTERED INDEX IX_Inventario_Repuesto ON dbo.InventarioBodega(IdRepuesto) INCLUDE (IdBodega,Existencia,StockMinimo);
CREATE NONCLUSTERED INDEX IX_Compra_Proveedor ON dbo.Compra(IdProveedor,FechaCompra DESC) INCLUDE (Estado,IdBodegaDestino);
CREATE NONCLUSTERED INDEX IX_DetalleCompra_Repuesto ON dbo.DetalleCompra(IdRepuesto);
CREATE NONCLUSTERED INDEX IX_Movimiento_Kardex ON dbo.MovimientoInventario(IdRepuesto,IdBodega,IdMovimiento) INCLUDE (Cantidad,IdTipoMovimiento,ExistenciaResultante);
CREATE NONCLUSTERED INDEX IX_Movimiento_Fecha ON dbo.MovimientoInventario(FechaMovimiento DESC) INCLUDE (IdUsuario,DocumentoOrigen);
CREATE NONCLUSTERED INDEX IX_Factura_Fecha ON dbo.Factura(FechaFactura,Estado) INCLUDE (SubtotalManoObra,SubtotalRepuestos);
CREATE NONCLUSTERED INDEX IX_Pago_Factura ON dbo.Pago(IdFactura,Estado) INCLUDE (Monto,FechaPago,IdMetodoPago);
CREATE NONCLUSTERED INDEX IX_DetalleFactura_Factura ON dbo.DetalleFactura(IdFactura);
GO
-- BIGINT: el formato conserva seis posiciones minimas, sin truncar al superar un millon.
CREATE SEQUENCE dbo.seq_NumeroOrden AS BIGINT START WITH 1 INCREMENT BY 1 MAXVALUE 9999999999 NO CYCLE;
CREATE SEQUENCE dbo.seq_NumeroFactura AS BIGINT START WITH 1 INCREMENT BY 1 MAXVALUE 9999999999 NO CYCLE;
CREATE SEQUENCE dbo.seq_NumeroCompra AS BIGINT START WITH 1 INCREMENT BY 1 MAXVALUE 9999999999 NO CYCLE;
GO
CREATE TYPE dbo.tvp_DetalleCompra AS TABLE (
    IdRepuesto INT NOT NULL PRIMARY KEY,
    Cantidad INT NOT NULL CHECK (Cantidad > 0),
    CostoUnitario DECIMAL(12,2) NOT NULL CHECK (CostoUnitario >= 0)
);
GO
