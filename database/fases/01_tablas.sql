/* FASE 01. SQL Server 2022 / Azure SQL. Base VACIA, esquema unico dbo.
   No elimina bases ni objetos. Orden: seguridad -> clientes/equipos -> servicio
   -> inventario -> compras -> consumos/movimientos -> facturacion -> entrega.
   3FN: cliente de orden se deriva de Equipo; orden de reparacion de Diagnostico.
   Las columnas AS son proyecciones generadas, no datos editables duplicados. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 50090, N'Conectar a una base de proyecto vacia.', 1;
IF EXISTS (SELECT 1 FROM sys.tables WHERE is_ms_shipped = 0)
    THROW 50091, N'La instalacion inicial requiere una base vacia. No es una migracion.', 1;

BEGIN TRANSACTION;
CREATE TABLE dbo.Rol (
    IdRol INT IDENTITY NOT NULL CONSTRAINT PK_Rol PRIMARY KEY,
    Codigo VARCHAR(30) NOT NULL CONSTRAINT UQ_Rol_Codigo UNIQUE,
    Nombre VARCHAR(60) NOT NULL, Descripcion VARCHAR(200) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_Rol_Activo DEFAULT (1)
);
CREATE TABLE dbo.Permiso (
    IdPermiso INT IDENTITY NOT NULL CONSTRAINT PK_Permiso PRIMARY KEY,
    Codigo VARCHAR(40) NOT NULL CONSTRAINT UQ_Permiso_Codigo UNIQUE,
    Descripcion VARCHAR(200) NOT NULL
);
CREATE TABLE dbo.RolPermiso (
    IdRol INT NOT NULL, IdPermiso INT NOT NULL,
    CONSTRAINT PK_RolPermiso PRIMARY KEY (IdRol, IdPermiso)
);
CREATE TABLE dbo.Usuario (
    IdUsuario INT IDENTITY NOT NULL CONSTRAINT PK_Usuario PRIMARY KEY,
    NombreUsuario VARCHAR(50) NOT NULL CONSTRAINT UQ_Usuario_Nombre UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    NombreCompleto VARCHAR(150) NOT NULL, Email VARCHAR(120) NOT NULL CONSTRAINT UQ_Usuario_Email UNIQUE,
    Telefono VARCHAR(20) NULL, Activo BIT NOT NULL CONSTRAINT DF_Usuario_Activo DEFAULT (1),
    IntentosFallidos TINYINT NOT NULL CONSTRAINT DF_Usuario_Intentos DEFAULT (0),
    FechaCreacion DATETIME2(0) NOT NULL CONSTRAINT DF_Usuario_Fecha DEFAULT (SYSUTCDATETIME()),
    UltimoAcceso DATETIME2(0) NULL,
    CONSTRAINT CK_Usuario_Hash CHECK (LEN(PasswordHash) >= 40),
    CONSTRAINT CK_Usuario_Nombre CHECK (LEN(LTRIM(RTRIM(NombreUsuario))) > 0)
);
CREATE TABLE dbo.UsuarioRol (
    IdUsuario INT NOT NULL, IdRol INT NOT NULL,
    FechaAsignacion DATETIME2(0) NOT NULL CONSTRAINT DF_UsuarioRol_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_UsuarioRol PRIMARY KEY (IdUsuario, IdRol)
);
CREATE TABLE dbo.Cliente (
    IdCliente INT IDENTITY NOT NULL CONSTRAINT PK_Cliente PRIMARY KEY,
    TipoCliente VARCHAR(12) NOT NULL,
    NIT VARCHAR(20) NOT NULL CONSTRAINT DF_Cliente_NIT DEFAULT ('CF'),
    Nombres VARCHAR(100) NULL, Apellidos VARCHAR(100) NULL, RazonSocial VARCHAR(150) NULL,
    NombreContacto VARCHAR(120) NULL, Telefono VARCHAR(20) NOT NULL,
    Email VARCHAR(120) NULL, Direccion VARCHAR(250) NULL,
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Cliente_Estado DEFAULT ('ACTIVO'),
    FechaRegistro DATETIME2(0) NOT NULL CONSTRAINT DF_Cliente_Fecha DEFAULT (SYSUTCDATETIME()),
    NombreMostrar AS (CASE WHEN TipoCliente = 'EMPRESARIAL' THEN RazonSocial ELSE Nombres + ' ' + Apellidos END),
    CONSTRAINT CK_Cliente_Tipo CHECK (TipoCliente IN ('INDIVIDUAL','EMPRESARIAL')),
    CONSTRAINT CK_Cliente_Estado CHECK (Estado IN ('ACTIVO','INACTIVO')),
    CONSTRAINT CK_Cliente_Identidad CHECK (
       (TipoCliente = 'INDIVIDUAL' AND Nombres IS NOT NULL AND Apellidos IS NOT NULL
        AND LEN(LTRIM(RTRIM(Nombres))) > 0 AND LEN(LTRIM(RTRIM(Apellidos))) > 0)
       OR (TipoCliente = 'EMPRESARIAL' AND RazonSocial IS NOT NULL AND LEN(LTRIM(RTRIM(RazonSocial))) > 0)),
    CONSTRAINT CK_Cliente_Contacto CHECK (LEN(LTRIM(RTRIM(NIT))) > 0 AND LEN(LTRIM(RTRIM(Telefono))) > 0)
);
CREATE TABLE dbo.TipoEquipo (
    IdTipoEquipo INT IDENTITY NOT NULL CONSTRAINT PK_TipoEquipo PRIMARY KEY,
    Nombre VARCHAR(60) NOT NULL CONSTRAINT UQ_TipoEquipo_Nombre UNIQUE
);
CREATE TABLE dbo.Marca (
    IdMarca INT IDENTITY NOT NULL CONSTRAINT PK_Marca PRIMARY KEY,
    Nombre VARCHAR(60) NOT NULL CONSTRAINT UQ_Marca_Nombre UNIQUE
);
CREATE TABLE dbo.Equipo (
    IdEquipo INT IDENTITY NOT NULL CONSTRAINT PK_Equipo PRIMARY KEY,
    IdCliente INT NOT NULL, IdTipoEquipo INT NOT NULL, IdMarca INT NOT NULL,
    Modelo VARCHAR(80) NOT NULL, NumeroSerie VARCHAR(60) NOT NULL CONSTRAINT UQ_Equipo_Serie UNIQUE,
    Descripcion VARCHAR(300) NOT NULL,
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Equipo_Estado DEFAULT ('ACTIVO'),
    FechaRegistro DATETIME2(0) NOT NULL CONSTRAINT DF_Equipo_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Equipo_Estado CHECK (Estado IN ('ACTIVO','INACTIVO','BAJA')),
    CONSTRAINT CK_Equipo_Textos CHECK (LEN(LTRIM(RTRIM(NumeroSerie))) > 0 AND LEN(LTRIM(RTRIM(Modelo))) > 0)
);
CREATE TABLE dbo.EstadoOrden (
    IdEstadoOrden INT IDENTITY NOT NULL CONSTRAINT PK_EstadoOrden PRIMARY KEY,
    Codigo VARCHAR(30) NOT NULL CONSTRAINT UQ_EstadoOrden_Codigo UNIQUE,
    Nombre VARCHAR(60) NOT NULL, Orden TINYINT NOT NULL,
    EsFinal BIT NOT NULL CONSTRAINT DF_EstadoOrden_Final DEFAULT (0)
);
CREATE TABLE dbo.TransicionEstadoOrden (
    IdEstadoOrigen INT NOT NULL, IdEstadoDestino INT NOT NULL,
    CONSTRAINT PK_TransicionEstadoOrden PRIMARY KEY (IdEstadoOrigen, IdEstadoDestino),
    CONSTRAINT CK_Transicion_Distinto CHECK (IdEstadoOrigen <> IdEstadoDestino)
);
CREATE TABLE dbo.Prioridad (
    IdPrioridad INT IDENTITY NOT NULL CONSTRAINT PK_Prioridad PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL CONSTRAINT UQ_Prioridad_Codigo UNIQUE,
    Nombre VARCHAR(40) NOT NULL, Nivel TINYINT NOT NULL
);
CREATE TABLE dbo.OrdenServicio (
    IdOrden INT IDENTITY NOT NULL CONSTRAINT PK_OrdenServicio PRIMARY KEY,
    NumeroOrden VARCHAR(20) NOT NULL CONSTRAINT UQ_OrdenServicio_Numero UNIQUE,
    IdEquipo INT NOT NULL, IdUsuarioRecepcion INT NOT NULL,
    FechaIngreso DATETIME2(0) NOT NULL CONSTRAINT DF_Orden_Fecha DEFAULT (SYSUTCDATETIME()),
    ProblemaReportado VARCHAR(1000) NOT NULL, IdPrioridad INT NOT NULL, IdEstadoOrden INT NOT NULL,
    FechaEstimada DATE NULL, Observaciones VARCHAR(500) NULL,
    CONSTRAINT CK_Orden_Problema CHECK (LEN(LTRIM(RTRIM(ProblemaReportado))) > 0),
    -- Guatemala UTC-6: FechaEstimada es una fecha civil, no un instante UTC.
    CONSTRAINT CK_Orden_Estimada CHECK (FechaEstimada IS NULL OR FechaEstimada >= CONVERT(DATE, DATEADD(HOUR,-6,FechaIngreso)))
);
CREATE TABLE dbo.HistorialEstadoOrden (
    IdHistorial INT IDENTITY NOT NULL CONSTRAINT PK_HistorialEstadoOrden PRIMARY KEY,
    IdOrden INT NOT NULL, IdEstadoAnterior INT NULL, IdEstadoNuevo INT NOT NULL,
    FechaCambio DATETIME2(0) NOT NULL CONSTRAINT DF_Historial_Fecha DEFAULT (SYSUTCDATETIME()),
    IdUsuario INT NOT NULL, Observacion VARCHAR(500) NULL,
    CONSTRAINT CK_Historial_Cambio CHECK (IdEstadoAnterior IS NULL OR IdEstadoAnterior <> IdEstadoNuevo)
);
CREATE TABLE dbo.Diagnostico (
    IdDiagnostico INT IDENTITY NOT NULL CONSTRAINT PK_Diagnostico PRIMARY KEY,
    IdOrden INT NOT NULL, IdTecnico INT NOT NULL,
    FechaDiagnostico DATETIME2(0) NOT NULL CONSTRAINT DF_Diagnostico_Fecha DEFAULT (SYSUTCDATETIME()),
    Descripcion VARCHAR(1000) NOT NULL,
    CostoManoObraEstimado DECIMAL(12,2) NOT NULL CONSTRAINT DF_Diagnostico_Costo DEFAULT (0),
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Diagnostico_Estado DEFAULT ('ACTIVO'),
    CONSTRAINT CK_Diagnostico_Costo CHECK (CostoManoObraEstimado >= 0),
    CONSTRAINT CK_Diagnostico_Estado CHECK (Estado IN ('ACTIVO','ANULADO')),
    CONSTRAINT CK_Diagnostico_Descripcion CHECK (LEN(LTRIM(RTRIM(Descripcion))) > 0)
);
CREATE TABLE dbo.Reparacion (
    IdReparacion INT IDENTITY NOT NULL CONSTRAINT PK_Reparacion PRIMARY KEY,
    IdDiagnostico INT NOT NULL, IdTecnico INT NOT NULL,
    FechaInicio DATETIME2(0) NOT NULL CONSTRAINT DF_Reparacion_Inicio DEFAULT (SYSUTCDATETIME()),
    FechaFin DATETIME2(0) NULL, Descripcion VARCHAR(1000) NOT NULL,
    CostoManoObra DECIMAL(12,2) NOT NULL CONSTRAINT DF_Reparacion_Costo DEFAULT (0),
    Estado VARCHAR(12) NOT NULL CONSTRAINT DF_Reparacion_Estado DEFAULT ('EN_PROCESO'),
    CONSTRAINT CK_Reparacion_Costo CHECK (CostoManoObra >= 0),
    CONSTRAINT CK_Reparacion_Estado CHECK (Estado IN ('EN_PROCESO','FINALIZADA','CANCELADA')),
    CONSTRAINT CK_Reparacion_Fechas CHECK (FechaFin IS NULL OR FechaFin >= FechaInicio),
    CONSTRAINT CK_Reparacion_Final CHECK (Estado <> 'FINALIZADA' OR FechaFin IS NOT NULL),
    CONSTRAINT CK_Reparacion_Descripcion CHECK (LEN(LTRIM(RTRIM(Descripcion))) > 0)
);
CREATE TABLE dbo.ActividadReparacion (
    IdActividad INT IDENTITY NOT NULL CONSTRAINT PK_ActividadReparacion PRIMARY KEY,
    IdReparacion INT NOT NULL, IdTecnico INT NOT NULL, Descripcion VARCHAR(500) NOT NULL,
    FechaActividad DATETIME2(0) NOT NULL CONSTRAINT DF_Actividad_Fecha DEFAULT (SYSUTCDATETIME()),
    HorasInvertidas DECIMAL(5,2) NOT NULL,
    CONSTRAINT CK_Actividad_Horas CHECK (HorasInvertidas > 0),
    CONSTRAINT CK_Actividad_Descripcion CHECK (LEN(LTRIM(RTRIM(Descripcion))) > 0)
);
CREATE TABLE dbo.CategoriaRepuesto (
    IdCategoria INT IDENTITY NOT NULL CONSTRAINT PK_CategoriaRepuesto PRIMARY KEY,
    Nombre VARCHAR(80) NOT NULL CONSTRAINT UQ_CategoriaRepuesto_Nombre UNIQUE, Descripcion VARCHAR(200) NULL
);
CREATE TABLE dbo.Repuesto (
    IdRepuesto INT IDENTITY NOT NULL CONSTRAINT PK_Repuesto PRIMARY KEY,
    IdCategoria INT NOT NULL, Codigo VARCHAR(30) NOT NULL CONSTRAINT UQ_Repuesto_Codigo UNIQUE,
    Nombre VARCHAR(120) NOT NULL, Descripcion VARCHAR(300) NULL,
    PrecioCompraReferencia DECIMAL(12,2) NOT NULL CONSTRAINT DF_Repuesto_Compra DEFAULT (0),
    PrecioVenta DECIMAL(12,2) NOT NULL CONSTRAINT DF_Repuesto_Venta DEFAULT (0),
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Repuesto_Estado DEFAULT ('ACTIVO'),
    CONSTRAINT CK_Repuesto_Precios CHECK (PrecioCompraReferencia >= 0 AND PrecioVenta >= 0),
    CONSTRAINT CK_Repuesto_Estado CHECK (Estado IN ('ACTIVO','INACTIVO'))
);
CREATE TABLE dbo.Bodega (
    IdBodega INT IDENTITY NOT NULL CONSTRAINT PK_Bodega PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL CONSTRAINT UQ_Bodega_Codigo UNIQUE,
    Nombre VARCHAR(80) NOT NULL, Ubicacion VARCHAR(200) NULL,
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Bodega_Estado DEFAULT ('ACTIVA'),
    CONSTRAINT CK_Bodega_Estado CHECK (Estado IN ('ACTIVA','INACTIVA'))
);
CREATE TABLE dbo.InventarioBodega (
    IdBodega INT NOT NULL, IdRepuesto INT NOT NULL,
    Existencia INT NOT NULL CONSTRAINT DF_Inventario_Existencia DEFAULT (0),
    StockMinimo INT NOT NULL CONSTRAINT DF_Inventario_Minimo DEFAULT (0),
    FechaUltimoMovimiento DATETIME2(0) NULL,
    CONSTRAINT PK_InventarioBodega PRIMARY KEY (IdBodega,IdRepuesto),
    CONSTRAINT CK_Inventario_Existencia CHECK (Existencia >= 0),
    CONSTRAINT CK_Inventario_Minimo CHECK (StockMinimo >= 0)
);
CREATE TABLE dbo.TipoMovimiento (
    IdTipoMovimiento INT IDENTITY NOT NULL CONSTRAINT PK_TipoMovimiento PRIMARY KEY,
    Codigo VARCHAR(30) NOT NULL CONSTRAINT UQ_TipoMovimiento_Codigo UNIQUE,
    Nombre VARCHAR(80) NOT NULL, Naturaleza CHAR(1) NOT NULL,
    CONSTRAINT CK_TipoMovimiento_Naturaleza CHECK (Naturaleza IN ('E','S'))
);
CREATE TABLE dbo.Proveedor (
    IdProveedor INT IDENTITY NOT NULL CONSTRAINT PK_Proveedor PRIMARY KEY,
    NIT VARCHAR(20) NOT NULL CONSTRAINT UQ_Proveedor_NIT UNIQUE, Nombre VARCHAR(150) NOT NULL,
    NombreContacto VARCHAR(120) NULL, Telefono VARCHAR(20) NOT NULL,
    Email VARCHAR(120) NULL, Direccion VARCHAR(250) NULL,
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Proveedor_Estado DEFAULT ('ACTIVO'),
    CONSTRAINT CK_Proveedor_Estado CHECK (Estado IN ('ACTIVO','INACTIVO'))
);
CREATE TABLE dbo.Compra (
    IdCompra INT IDENTITY NOT NULL CONSTRAINT PK_Compra PRIMARY KEY,
    NumeroCompra VARCHAR(20) NOT NULL CONSTRAINT UQ_Compra_Numero UNIQUE,
    IdProveedor INT NOT NULL, IdBodegaDestino INT NOT NULL, IdUsuarioRegistro INT NOT NULL,
    FechaCompra DATETIME2(0) NOT NULL CONSTRAINT DF_Compra_Fecha DEFAULT (SYSUTCDATETIME()),
    FechaRecepcion DATETIME2(0) NULL, IdUsuarioRecepcion INT NULL,
    NumeroDocumentoProveedor VARCHAR(40) NULL,
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Compra_Estado DEFAULT ('PENDIENTE'), Observaciones VARCHAR(500) NULL,
    CONSTRAINT CK_Compra_Estado CHECK (Estado IN ('PENDIENTE','RECIBIDA','ANULADA')),
    CONSTRAINT CK_Compra_Recepcion CHECK (
      (Estado = 'RECIBIDA' AND FechaRecepcion IS NOT NULL AND IdUsuarioRecepcion IS NOT NULL)
      OR (Estado <> 'RECIBIDA' AND FechaRecepcion IS NULL AND IdUsuarioRecepcion IS NULL)),
    CONSTRAINT CK_Compra_Fechas CHECK (FechaRecepcion IS NULL OR FechaRecepcion >= FechaCompra)
);
CREATE TABLE dbo.DetalleCompra (
    IdDetalleCompra INT IDENTITY NOT NULL CONSTRAINT PK_DetalleCompra PRIMARY KEY,
    IdCompra INT NOT NULL, IdRepuesto INT NOT NULL, Cantidad INT NOT NULL, CostoUnitario DECIMAL(12,2) NOT NULL,
    Subtotal AS (CONVERT(DECIMAL(14,2), Cantidad * CostoUnitario)),
    CONSTRAINT UQ_DetalleCompra_Linea UNIQUE (IdCompra,IdRepuesto),
    CONSTRAINT CK_DetalleCompra_Cantidad CHECK (Cantidad > 0), CONSTRAINT CK_DetalleCompra_Costo CHECK (CostoUnitario >= 0),
    CONSTRAINT CK_DetalleCompra_Importe CHECK (Cantidad * CONVERT(DECIMAL(26,2),CostoUnitario) <= 999999999999.99)
);
CREATE TABLE dbo.RepuestoReparacion (
    IdRepuestoReparacion INT IDENTITY NOT NULL CONSTRAINT PK_RepuestoReparacion PRIMARY KEY,
    IdReparacion INT NOT NULL, IdBodega INT NOT NULL, IdRepuesto INT NOT NULL, Cantidad INT NOT NULL,
    PrecioCostoUnitario DECIMAL(12,2) NOT NULL, PrecioVentaUnitario DECIMAL(12,2) NOT NULL,
    Subtotal AS (CONVERT(DECIMAL(14,2), Cantidad * PrecioVentaUnitario)),
    FechaAsignacion DATETIME2(0) NOT NULL CONSTRAINT DF_Consumo_Fecha DEFAULT (SYSUTCDATETIME()),
    IdUsuario INT NOT NULL, Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Consumo_Estado DEFAULT ('ACTIVO'),
    CONSTRAINT CK_Consumo_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_Consumo_Precios CHECK (PrecioCostoUnitario >= 0 AND PrecioVentaUnitario >= 0),
    CONSTRAINT CK_Consumo_Estado CHECK (Estado IN ('ACTIVO','ANULADO')),
    CONSTRAINT CK_Consumo_Importe CHECK (Cantidad * CONVERT(DECIMAL(26,2),PrecioVentaUnitario) <= 999999999999.99)
);
CREATE TABLE dbo.MovimientoInventario (
    IdMovimiento INT IDENTITY NOT NULL CONSTRAINT PK_MovimientoInventario PRIMARY KEY,
    IdBodega INT NOT NULL, IdRepuesto INT NOT NULL, IdTipoMovimiento INT NOT NULL, Cantidad INT NOT NULL,
    FechaMovimiento DATETIME2(0) NOT NULL CONSTRAINT DF_Movimiento_Fecha DEFAULT (SYSUTCDATETIME()),
    IdUsuario INT NOT NULL, DocumentoOrigen VARCHAR(12) NOT NULL,
    IdDetalleCompra INT NULL, IdRepuestoReparacion INT NULL, Observacion VARCHAR(300) NULL, ExistenciaResultante INT NOT NULL,
    CONSTRAINT CK_Movimiento_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_Movimiento_Existencia CHECK (ExistenciaResultante >= 0),
    CONSTRAINT CK_Movimiento_Documento CHECK (DocumentoOrigen IN ('COMPRA','REPARACION','AJUSTE')),
    CONSTRAINT CK_Movimiento_Origen CHECK (
      (DocumentoOrigen = 'COMPRA' AND IdDetalleCompra IS NOT NULL AND IdRepuestoReparacion IS NULL)
      OR (DocumentoOrigen = 'REPARACION' AND IdRepuestoReparacion IS NOT NULL AND IdDetalleCompra IS NULL)
      OR (DocumentoOrigen = 'AJUSTE' AND IdDetalleCompra IS NULL AND IdRepuestoReparacion IS NULL))
);
CREATE TABLE dbo.MetodoPago (
    IdMetodoPago INT IDENTITY NOT NULL CONSTRAINT PK_MetodoPago PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL CONSTRAINT UQ_MetodoPago_Codigo UNIQUE,
    Nombre VARCHAR(60) NOT NULL, Activo BIT NOT NULL CONSTRAINT DF_MetodoPago_Activo DEFAULT (1)
);
CREATE TABLE dbo.Factura (
    IdFactura INT IDENTITY NOT NULL CONSTRAINT PK_Factura PRIMARY KEY,
    NumeroFactura VARCHAR(20) NOT NULL CONSTRAINT UQ_Factura_Numero UNIQUE,
    IdOrden INT NOT NULL CONSTRAINT UQ_Factura_Orden UNIQUE, IdUsuario INT NOT NULL,
    NITFacturacion VARCHAR(20) NOT NULL, NombreFacturacion VARCHAR(150) NOT NULL, DireccionFacturacion VARCHAR(250) NULL,
    FechaFactura DATETIME2(0) NOT NULL CONSTRAINT DF_Factura_Fecha DEFAULT (SYSUTCDATETIME()),
    -- Hechos del documento fiscal al emitir. No son referencias vivas al catalogo.
    SubtotalManoObra DECIMAL(12,2) NOT NULL, SubtotalRepuestos DECIMAL(12,2) NOT NULL,
    PorcentajeImpuesto DECIMAL(5,2) NOT NULL CONSTRAINT DF_Factura_Tasa DEFAULT (12.00),
    Subtotal AS (SubtotalManoObra + SubtotalRepuestos),
    Impuesto AS (CONVERT(DECIMAL(12,2),ROUND((SubtotalManoObra + SubtotalRepuestos)*PorcentajeImpuesto/100.0,2))),
    Total AS (SubtotalManoObra + SubtotalRepuestos + CONVERT(DECIMAL(12,2),ROUND((SubtotalManoObra + SubtotalRepuestos)*PorcentajeImpuesto/100.0,2))),
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Factura_Estado DEFAULT ('EMITIDA'),
    CONSTRAINT CK_Factura_Subtotales CHECK (SubtotalManoObra >= 0 AND SubtotalRepuestos >= 0),
    CONSTRAINT CK_Factura_Tasa CHECK (PorcentajeImpuesto BETWEEN 0 AND 100),
    CONSTRAINT CK_Factura_Rango CHECK (SubtotalManoObra + SubtotalRepuestos + ROUND((SubtotalManoObra + SubtotalRepuestos)*PorcentajeImpuesto/100.0,2) <= 9999999999.99),
    CONSTRAINT CK_Factura_Estado CHECK (Estado IN ('EMITIDA','PAGADA','ANULADA'))
);
CREATE TABLE dbo.DetalleFactura (
    IdDetalleFactura INT IDENTITY NOT NULL CONSTRAINT PK_DetalleFactura PRIMARY KEY,
    IdFactura INT NOT NULL, TipoLinea VARCHAR(12) NOT NULL, IdReparacion INT NULL, IdRepuestoReparacion INT NULL,
    Descripcion VARCHAR(250) NOT NULL, Cantidad DECIMAL(10,2) NOT NULL, PrecioUnitario DECIMAL(12,2) NOT NULL,
    Subtotal AS (CONVERT(DECIMAL(14,2),Cantidad*PrecioUnitario)),
    CONSTRAINT CK_DetFactura_Cantidad CHECK (Cantidad > 0), CONSTRAINT CK_DetFactura_Precio CHECK (PrecioUnitario >= 0),
    CONSTRAINT CK_DetFactura_Importe CHECK (Cantidad * PrecioUnitario <= 999999999999.99),
    CONSTRAINT CK_DetFactura_Origen CHECK (
      (TipoLinea = 'MANO_OBRA' AND IdReparacion IS NOT NULL AND IdRepuestoReparacion IS NULL)
      OR (TipoLinea = 'REPUESTO' AND IdReparacion IS NULL AND IdRepuestoReparacion IS NOT NULL))
);
CREATE TABLE dbo.Pago (
    IdPago INT IDENTITY NOT NULL CONSTRAINT PK_Pago PRIMARY KEY,
    IdFactura INT NOT NULL, IdMetodoPago INT NOT NULL, Monto DECIMAL(12,2) NOT NULL,
    FechaPago DATETIME2(0) NOT NULL CONSTRAINT DF_Pago_Fecha DEFAULT (SYSUTCDATETIME()),
    Referencia VARCHAR(60) NULL, IdUsuario INT NOT NULL,
    Estado VARCHAR(10) NOT NULL CONSTRAINT DF_Pago_Estado DEFAULT ('APLICADO'), MotivoAnulacion VARCHAR(300) NULL,
    CONSTRAINT CK_Pago_Monto CHECK (Monto > 0), CONSTRAINT CK_Pago_Estado CHECK (Estado IN ('APLICADO','ANULADO')),
    CONSTRAINT CK_Pago_Anulacion CHECK (Estado <> 'ANULADO' OR (MotivoAnulacion IS NOT NULL AND LEN(LTRIM(RTRIM(MotivoAnulacion))) > 0))
);
CREATE TABLE dbo.Entrega (
    IdEntrega INT IDENTITY NOT NULL CONSTRAINT PK_Entrega PRIMARY KEY,
    IdOrden INT NOT NULL CONSTRAINT UQ_Entrega_Orden UNIQUE, IdUsuarioEntrega INT NOT NULL,
    NombreRecibe VARCHAR(150) NOT NULL, DocumentoRecibe VARCHAR(30) NULL,
    FechaEntrega DATETIME2(0) NOT NULL CONSTRAINT DF_Entrega_Fecha DEFAULT (SYSUTCDATETIME()), Observaciones VARCHAR(500) NULL,
    CONSTRAINT CK_Entrega_Recibe CHECK (LEN(LTRIM(RTRIM(NombreRecibe))) > 0)
);
CREATE TABLE dbo.AuditoriaPrecioRepuesto (
    IdAuditoria INT IDENTITY NOT NULL CONSTRAINT PK_AuditoriaPrecioRepuesto PRIMARY KEY,
    IdRepuesto INT NOT NULL, PrecioCompraAnterior DECIMAL(12,2) NOT NULL, PrecioCompraNuevo DECIMAL(12,2) NOT NULL,
    PrecioVentaAnterior DECIMAL(12,2) NOT NULL, PrecioVentaNuevo DECIMAL(12,2) NOT NULL,
    FechaCambio DATETIME2(0) NOT NULL CONSTRAINT DF_Auditoria_Fecha DEFAULT (SYSUTCDATETIME()),
    UsuarioBD SYSNAME NOT NULL CONSTRAINT DF_Auditoria_Usuario DEFAULT (SUSER_SNAME()), IdUsuarioApp INT NULL
);
COMMIT TRANSACTION;
GO
