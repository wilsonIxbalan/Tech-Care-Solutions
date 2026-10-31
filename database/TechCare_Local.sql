/* GENERADO: instalacion completa en SQL Server local desde instancia vacia.
   Ejecutar con sqlcmd -b. No usar en Azure. No borra la base si ya existe. */
USE master;
GO
/* OPCIONAL, SOLO SQL Server local, conectado a master. No ejecutar en Azure.
   No borra ni reutiliza una base existente. Requiere permiso de crear bases. */
IF CONVERT(INT,SERVERPROPERTY('EngineEdition'))=5
    THROW 50092,N'En Azure la base se crea por el portal, no con este archivo.',1;
IF DB_NAME()<>N'master' THROW 50093,N'Para este bootstrap local conectar a master.',1;
IF DB_ID(N'TechCareDB') IS NOT NULL THROW 50094,N'TechCareDB ya existe; no se modifico.',1;
CREATE DATABASE TechCareDB COLLATE Modern_Spanish_CI_AS;
GO
USE TechCareDB;
GO
/* GENERADO por pnpm sql:build. Editar fases, no este archivo.
   SQL Server 2022 / Azure SQL Database. Conectar a una BD de proyecto VACIA.
   Ejecutar con cliente que detenga al primer error (sqlcmd -b o SQLCMD :ON ERROR EXIT).
   NO ejecutar sobre la BD compartida con datos. Sin DROP, usuarios ni secretos. */
/* ===== fases/01_tablas.sql ===== */
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

/* ===== fases/02_relaciones.sql ===== */
/* FASE 02. Todas las tablas ya existen. NO ACTION salvo configuracion N:M. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
ALTER TABLE dbo.RolPermiso ADD CONSTRAINT FK_RolPermiso_Rol FOREIGN KEY (IdRol) REFERENCES dbo.Rol(IdRol) ON DELETE CASCADE;
ALTER TABLE dbo.RolPermiso ADD CONSTRAINT FK_RolPermiso_Permiso FOREIGN KEY (IdPermiso) REFERENCES dbo.Permiso(IdPermiso) ON DELETE CASCADE;
ALTER TABLE dbo.UsuarioRol ADD CONSTRAINT FK_UsuarioRol_Usuario FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario) ON DELETE CASCADE;
ALTER TABLE dbo.UsuarioRol ADD CONSTRAINT FK_UsuarioRol_Rol FOREIGN KEY (IdRol) REFERENCES dbo.Rol(IdRol);
ALTER TABLE dbo.Equipo ADD CONSTRAINT FK_Equipo_Cliente FOREIGN KEY (IdCliente) REFERENCES dbo.Cliente(IdCliente);
ALTER TABLE dbo.Equipo ADD CONSTRAINT FK_Equipo_Tipo FOREIGN KEY (IdTipoEquipo) REFERENCES dbo.TipoEquipo(IdTipoEquipo);
ALTER TABLE dbo.Equipo ADD CONSTRAINT FK_Equipo_Marca FOREIGN KEY (IdMarca) REFERENCES dbo.Marca(IdMarca);
ALTER TABLE dbo.TransicionEstadoOrden ADD CONSTRAINT FK_Transicion_Origen FOREIGN KEY (IdEstadoOrigen) REFERENCES dbo.EstadoOrden(IdEstadoOrden);
ALTER TABLE dbo.TransicionEstadoOrden ADD CONSTRAINT FK_Transicion_Destino FOREIGN KEY (IdEstadoDestino) REFERENCES dbo.EstadoOrden(IdEstadoOrden);
ALTER TABLE dbo.OrdenServicio ADD CONSTRAINT FK_Orden_Equipo FOREIGN KEY (IdEquipo) REFERENCES dbo.Equipo(IdEquipo);
ALTER TABLE dbo.OrdenServicio ADD CONSTRAINT FK_Orden_Recepcion FOREIGN KEY (IdUsuarioRecepcion) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.OrdenServicio ADD CONSTRAINT FK_Orden_Prioridad FOREIGN KEY (IdPrioridad) REFERENCES dbo.Prioridad(IdPrioridad);
ALTER TABLE dbo.OrdenServicio ADD CONSTRAINT FK_Orden_Estado FOREIGN KEY (IdEstadoOrden) REFERENCES dbo.EstadoOrden(IdEstadoOrden);
ALTER TABLE dbo.HistorialEstadoOrden ADD CONSTRAINT FK_Historial_Orden FOREIGN KEY (IdOrden) REFERENCES dbo.OrdenServicio(IdOrden);
ALTER TABLE dbo.HistorialEstadoOrden ADD CONSTRAINT FK_Historial_Anterior FOREIGN KEY (IdEstadoAnterior) REFERENCES dbo.EstadoOrden(IdEstadoOrden);
ALTER TABLE dbo.HistorialEstadoOrden ADD CONSTRAINT FK_Historial_Nuevo FOREIGN KEY (IdEstadoNuevo) REFERENCES dbo.EstadoOrden(IdEstadoOrden);
ALTER TABLE dbo.HistorialEstadoOrden ADD CONSTRAINT FK_Historial_Usuario FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.Diagnostico ADD CONSTRAINT FK_Diagnostico_Orden FOREIGN KEY (IdOrden) REFERENCES dbo.OrdenServicio(IdOrden);
ALTER TABLE dbo.Diagnostico ADD CONSTRAINT FK_Diagnostico_Tecnico FOREIGN KEY (IdTecnico) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.Reparacion ADD CONSTRAINT FK_Reparacion_Diagnostico FOREIGN KEY (IdDiagnostico) REFERENCES dbo.Diagnostico(IdDiagnostico);
ALTER TABLE dbo.Reparacion ADD CONSTRAINT FK_Reparacion_Tecnico FOREIGN KEY (IdTecnico) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.ActividadReparacion ADD CONSTRAINT FK_Actividad_Reparacion FOREIGN KEY (IdReparacion) REFERENCES dbo.Reparacion(IdReparacion);
ALTER TABLE dbo.ActividadReparacion ADD CONSTRAINT FK_Actividad_Tecnico FOREIGN KEY (IdTecnico) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.Repuesto ADD CONSTRAINT FK_Repuesto_Categoria FOREIGN KEY (IdCategoria) REFERENCES dbo.CategoriaRepuesto(IdCategoria);
ALTER TABLE dbo.InventarioBodega ADD CONSTRAINT FK_Inventario_Bodega FOREIGN KEY (IdBodega) REFERENCES dbo.Bodega(IdBodega);
ALTER TABLE dbo.InventarioBodega ADD CONSTRAINT FK_Inventario_Repuesto FOREIGN KEY (IdRepuesto) REFERENCES dbo.Repuesto(IdRepuesto);
ALTER TABLE dbo.Compra ADD CONSTRAINT FK_Compra_Proveedor FOREIGN KEY (IdProveedor) REFERENCES dbo.Proveedor(IdProveedor);
ALTER TABLE dbo.Compra ADD CONSTRAINT FK_Compra_Bodega FOREIGN KEY (IdBodegaDestino) REFERENCES dbo.Bodega(IdBodega);
ALTER TABLE dbo.Compra ADD CONSTRAINT FK_Compra_Registro FOREIGN KEY (IdUsuarioRegistro) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.Compra ADD CONSTRAINT FK_Compra_Recepcion FOREIGN KEY (IdUsuarioRecepcion) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.DetalleCompra ADD CONSTRAINT FK_DetalleCompra_Compra FOREIGN KEY (IdCompra) REFERENCES dbo.Compra(IdCompra);
ALTER TABLE dbo.DetalleCompra ADD CONSTRAINT FK_DetalleCompra_Repuesto FOREIGN KEY (IdRepuesto) REFERENCES dbo.Repuesto(IdRepuesto);
ALTER TABLE dbo.RepuestoReparacion ADD CONSTRAINT FK_Consumo_Reparacion FOREIGN KEY (IdReparacion) REFERENCES dbo.Reparacion(IdReparacion);
ALTER TABLE dbo.RepuestoReparacion ADD CONSTRAINT FK_Consumo_Inventario FOREIGN KEY (IdBodega,IdRepuesto) REFERENCES dbo.InventarioBodega(IdBodega,IdRepuesto);
ALTER TABLE dbo.RepuestoReparacion ADD CONSTRAINT FK_Consumo_Usuario FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.MovimientoInventario ADD CONSTRAINT FK_Movimiento_Inventario FOREIGN KEY (IdBodega,IdRepuesto) REFERENCES dbo.InventarioBodega(IdBodega,IdRepuesto);
ALTER TABLE dbo.MovimientoInventario ADD CONSTRAINT FK_Movimiento_Tipo FOREIGN KEY (IdTipoMovimiento) REFERENCES dbo.TipoMovimiento(IdTipoMovimiento);
ALTER TABLE dbo.MovimientoInventario ADD CONSTRAINT FK_Movimiento_Usuario FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.MovimientoInventario ADD CONSTRAINT FK_Movimiento_Compra FOREIGN KEY (IdDetalleCompra) REFERENCES dbo.DetalleCompra(IdDetalleCompra);
ALTER TABLE dbo.MovimientoInventario ADD CONSTRAINT FK_Movimiento_Consumo FOREIGN KEY (IdRepuestoReparacion) REFERENCES dbo.RepuestoReparacion(IdRepuestoReparacion);
ALTER TABLE dbo.Factura ADD CONSTRAINT FK_Factura_Orden FOREIGN KEY (IdOrden) REFERENCES dbo.OrdenServicio(IdOrden);
ALTER TABLE dbo.Factura ADD CONSTRAINT FK_Factura_Usuario FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.DetalleFactura ADD CONSTRAINT FK_DetalleFactura_Factura FOREIGN KEY (IdFactura) REFERENCES dbo.Factura(IdFactura);
ALTER TABLE dbo.DetalleFactura ADD CONSTRAINT FK_DetalleFactura_Reparacion FOREIGN KEY (IdReparacion) REFERENCES dbo.Reparacion(IdReparacion);
ALTER TABLE dbo.DetalleFactura ADD CONSTRAINT FK_DetalleFactura_Consumo FOREIGN KEY (IdRepuestoReparacion) REFERENCES dbo.RepuestoReparacion(IdRepuestoReparacion);
ALTER TABLE dbo.Pago ADD CONSTRAINT FK_Pago_Factura FOREIGN KEY (IdFactura) REFERENCES dbo.Factura(IdFactura);
ALTER TABLE dbo.Pago ADD CONSTRAINT FK_Pago_Metodo FOREIGN KEY (IdMetodoPago) REFERENCES dbo.MetodoPago(IdMetodoPago);
ALTER TABLE dbo.Pago ADD CONSTRAINT FK_Pago_Usuario FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.Entrega ADD CONSTRAINT FK_Entrega_Orden FOREIGN KEY (IdOrden) REFERENCES dbo.OrdenServicio(IdOrden);
ALTER TABLE dbo.Entrega ADD CONSTRAINT FK_Entrega_Usuario FOREIGN KEY (IdUsuarioEntrega) REFERENCES dbo.Usuario(IdUsuario);
ALTER TABLE dbo.AuditoriaPrecioRepuesto ADD CONSTRAINT FK_Auditoria_Repuesto FOREIGN KEY (IdRepuesto) REFERENCES dbo.Repuesto(IdRepuesto);
ALTER TABLE dbo.AuditoriaPrecioRepuesto ADD CONSTRAINT FK_Auditoria_Usuario FOREIGN KEY (IdUsuarioApp) REFERENCES dbo.Usuario(IdUsuario);
COMMIT TRANSACTION;
GO

/* ===== fases/03_indices_secuencias_tipos.sql ===== */
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

/* ===== fases/04_funciones.sql ===== */
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

/* ===== fases/05_vistas.sql ===== */
/* FASE 05. Lecturas sin SELECT *. Todos los objetos permanecen en dbo.
   Primero proyecciones base normalizadas; despues vistas que las consumen. */
CREATE OR ALTER VIEW dbo.vw_Ordenes
AS
SELECT o.IdOrden,o.NumeroOrden,e.IdCliente,c.NombreMostrar AS ClienteNombre,
  o.IdEquipo,e.NumeroSerie,te.Nombre AS TipoEquipoNombre,m.Nombre AS MarcaNombre,e.Modelo,
  o.IdUsuarioRecepcion,u.NombreCompleto AS Recepcionista,o.FechaIngreso,o.ProblemaReportado,
  o.IdPrioridad,p.Nombre AS Prioridad,p.Nivel AS NivelPrioridad,
  o.IdEstadoOrden,eo.Codigo AS Estado,eo.Nombre AS EstadoNombre,eo.EsFinal,
  o.FechaEstimada,o.Observaciones
FROM dbo.OrdenServicio o JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo
JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente
JOIN dbo.TipoEquipo te ON te.IdTipoEquipo=e.IdTipoEquipo JOIN dbo.Marca m ON m.IdMarca=e.IdMarca
JOIN dbo.Usuario u ON u.IdUsuario=o.IdUsuarioRecepcion
JOIN dbo.Prioridad p ON p.IdPrioridad=o.IdPrioridad JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden;
GO
CREATE OR ALTER VIEW dbo.vw_Diagnosticos
AS
SELECT d.IdDiagnostico,d.IdOrden,d.IdTecnico,u.NombreCompleto AS TecnicoNombre,
  d.FechaDiagnostico,d.Descripcion,d.CostoManoObraEstimado,d.Estado
FROM dbo.Diagnostico d JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico;
GO
CREATE OR ALTER VIEW dbo.vw_Reparaciones
AS
SELECT r.IdReparacion,d.IdOrden,r.IdDiagnostico,r.IdTecnico,u.NombreCompleto AS TecnicoNombre,
  r.FechaInicio,r.FechaFin,r.Descripcion,r.CostoManoObra,r.Estado
FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico
JOIN dbo.Usuario u ON u.IdUsuario=r.IdTecnico;
GO
CREATE OR ALTER VIEW dbo.vw_Actividades
AS
SELECT a.IdActividad,a.IdReparacion,a.IdTecnico,u.NombreCompleto AS TecnicoNombre,
  a.Descripcion,a.FechaActividad,a.HorasInvertidas
FROM dbo.ActividadReparacion a JOIN dbo.Usuario u ON u.IdUsuario=a.IdTecnico;
GO
CREATE OR ALTER VIEW dbo.vw_Consumos
AS
SELECT rr.IdRepuestoReparacion,rr.IdReparacion,d.IdOrden,r.IdTecnico,u.NombreCompleto AS TecnicoNombre,
  rr.IdBodega,b.Nombre AS BodegaNombre,rr.IdRepuesto,rp.Codigo AS CodigoRepuesto,rp.Nombre AS RepuestoNombre,
  rr.Cantidad,rr.PrecioCostoUnitario,rr.PrecioVentaUnitario,rr.Subtotal,rr.FechaAsignacion,rr.IdUsuario,rr.Estado
FROM dbo.RepuestoReparacion rr JOIN dbo.Reparacion r ON r.IdReparacion=rr.IdReparacion
JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico JOIN dbo.Usuario u ON u.IdUsuario=r.IdTecnico
JOIN dbo.Bodega b ON b.IdBodega=rr.IdBodega JOIN dbo.Repuesto rp ON rp.IdRepuesto=rr.IdRepuesto;
GO
CREATE OR ALTER VIEW dbo.vw_HistorialEstadoOrden
AS
SELECT h.IdHistorial,h.IdOrden,ea.Codigo AS EstadoAnterior,en.Codigo AS EstadoNuevo,
  h.FechaCambio,h.IdUsuario,u.NombreCompleto AS UsuarioNombre,h.Observacion
FROM dbo.HistorialEstadoOrden h LEFT JOIN dbo.EstadoOrden ea ON ea.IdEstadoOrden=h.IdEstadoAnterior
JOIN dbo.EstadoOrden en ON en.IdEstadoOrden=h.IdEstadoNuevo JOIN dbo.Usuario u ON u.IdUsuario=h.IdUsuario;
GO
CREATE OR ALTER VIEW dbo.vw_InventarioActual
AS
SELECT ib.IdBodega,b.Nombre AS BodegaNombre,r.IdCategoria,c.Nombre AS CategoriaNombre,
  ib.IdRepuesto,r.Codigo AS CodigoRepuesto,r.Nombre AS RepuestoNombre,
  ib.Existencia,ib.StockMinimo,CONVERT(BIT,CASE WHEN ib.Existencia<=ib.StockMinimo THEN 1 ELSE 0 END) AS BajoMinimo,
  CONVERT(BIT,CASE WHEN ib.Existencia=0 THEN 1 ELSE 0 END) AS SinStock,ib.FechaUltimoMovimiento
FROM dbo.InventarioBodega ib JOIN dbo.Bodega b ON b.IdBodega=ib.IdBodega
JOIN dbo.Repuesto r ON r.IdRepuesto=ib.IdRepuesto JOIN dbo.CategoriaRepuesto c ON c.IdCategoria=r.IdCategoria;
GO
CREATE OR ALTER VIEW dbo.vw_Compras
AS
SELECT co.IdCompra,co.NumeroCompra,co.IdProveedor,p.Nombre AS ProveedorNombre,
  co.IdBodegaDestino,b.Nombre AS BodegaNombre,co.IdUsuarioRegistro,co.FechaCompra,
  co.FechaRecepcion,co.IdUsuarioRecepcion,co.NumeroDocumentoProveedor,co.Estado,co.Observaciones,
  CONVERT(DECIMAL(14,2),ISNULL(s.Total,0)) AS Total
FROM dbo.Compra co JOIN dbo.Proveedor p ON p.IdProveedor=co.IdProveedor
JOIN dbo.Bodega b ON b.IdBodega=co.IdBodegaDestino
OUTER APPLY (SELECT SUM(dc.Subtotal) AS Total FROM dbo.DetalleCompra dc WHERE dc.IdCompra=co.IdCompra) s;
GO
CREATE OR ALTER VIEW dbo.vw_DetalleCompra
AS
SELECT dc.IdDetalleCompra,dc.IdCompra,dc.IdRepuesto,r.Codigo AS CodigoRepuesto,r.Nombre AS RepuestoNombre,
  dc.Cantidad,dc.CostoUnitario,dc.Subtotal
FROM dbo.DetalleCompra dc JOIN dbo.Repuesto r ON r.IdRepuesto=dc.IdRepuesto;
GO
CREATE OR ALTER VIEW dbo.vw_Facturas
AS
SELECT f.IdFactura,f.NumeroFactura,f.IdOrden,o.NumeroOrden,e.IdCliente,c.NombreMostrar AS ClienteNombre,
  f.NITFacturacion,f.NombreFacturacion,f.DireccionFacturacion,f.FechaFactura,
  f.SubtotalManoObra,f.SubtotalRepuestos,f.PorcentajeImpuesto,f.Subtotal,f.Impuesto,f.Total,f.Estado,
  CONVERT(DECIMAL(12,2),ISNULL(p.TotalPagado,0)) AS TotalPagado,ISNULL(p.CantidadPagos,0) AS CantidadPagos,
  CONVERT(DECIMAL(12,2),CASE WHEN f.Estado='ANULADA' THEN 0 ELSE f.Total-ISNULL(p.TotalPagado,0) END) AS Saldo
FROM dbo.Factura f JOIN dbo.OrdenServicio o ON o.IdOrden=f.IdOrden
JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente
LEFT JOIN (SELECT IdFactura,SUM(Monto) AS TotalPagado,COUNT(*) AS CantidadPagos FROM dbo.Pago WHERE Estado='APLICADO' GROUP BY IdFactura) p ON p.IdFactura=f.IdFactura;
GO
CREATE OR ALTER VIEW dbo.vw_FacturaSaldo
AS
SELECT IdFactura,NumeroFactura,IdOrden,NumeroOrden,IdCliente,ClienteNombre,FechaFactura,Estado,
  NITFacturacion,NombreFacturacion,SubtotalManoObra,SubtotalRepuestos,PorcentajeImpuesto,
  Subtotal,Impuesto,Total,TotalPagado,CantidadPagos,Saldo
FROM dbo.vw_Facturas;
GO
CREATE OR ALTER VIEW dbo.vw_DetalleFactura
AS
SELECT df.IdDetalleFactura,df.IdFactura,df.TipoLinea,df.IdReparacion,df.IdRepuestoReparacion,
  df.Descripcion,df.Cantidad,df.PrecioUnitario,df.Subtotal
FROM dbo.DetalleFactura df;
GO
CREATE OR ALTER VIEW dbo.vw_Pagos
AS
SELECT p.IdPago,p.IdFactura,p.IdMetodoPago,m.Nombre AS MetodoPagoNombre,p.Monto,p.FechaPago,p.Referencia,
  p.IdUsuario,u.NombreCompleto AS UsuarioNombre,p.Estado,p.MotivoAnulacion
FROM dbo.Pago p JOIN dbo.MetodoPago m ON m.IdMetodoPago=p.IdMetodoPago JOIN dbo.Usuario u ON u.IdUsuario=p.IdUsuario;
GO
CREATE OR ALTER VIEW dbo.vw_Entregas
AS
SELECT en.IdEntrega,en.IdOrden,en.IdUsuarioEntrega,u.NombreCompleto AS UsuarioEntregaNombre,
  en.NombreRecibe,en.DocumentoRecibe,en.FechaEntrega,en.Observaciones
FROM dbo.Entrega en JOIN dbo.Usuario u ON u.IdUsuario=en.IdUsuarioEntrega;
GO
CREATE OR ALTER VIEW dbo.vw_OrdenesActivas
AS
SELECT o.IdOrden,o.NumeroOrden,o.IdCliente,o.ClienteNombre,o.IdEquipo,o.NumeroSerie,o.TipoEquipoNombre,
  o.MarcaNombre,o.Modelo,o.FechaIngreso,o.FechaEstimada,o.Estado,o.IdPrioridad,o.Prioridad,o.NivelPrioridad,
  t.IdTecnico,t.TecnicoNombre AS TecnicoResponsable
FROM dbo.vw_Ordenes o OUTER APPLY (
  SELECT TOP (1) x.IdTecnico,x.TecnicoNombre FROM (
    SELECT r.IdTecnico,r.TecnicoNombre,r.FechaInicio AS Fecha,r.IdReparacion AS Registro,1 AS Prioridad
    FROM dbo.vw_Reparaciones r WHERE r.IdOrden=o.IdOrden AND r.Estado<>'CANCELADA'
    UNION ALL
    SELECT d.IdTecnico,u.NombreCompleto,d.FechaDiagnostico,d.IdDiagnostico,2
    FROM dbo.Diagnostico d JOIN dbo.Usuario u ON u.IdUsuario=d.IdTecnico WHERE d.IdOrden=o.IdOrden AND d.Estado='ACTIVO'
  ) x ORDER BY x.Prioridad,x.Fecha DESC,x.Registro DESC
) t WHERE o.EsFinal=0;
GO
CREATE OR ALTER VIEW dbo.vw_MovimientosInventario
AS
SELECT mi.IdMovimiento,mi.IdBodega,b.Nombre AS BodegaNombre,mi.IdRepuesto,rp.Codigo AS CodigoRepuesto,
  rp.Nombre AS RepuestoNombre,tm.Codigo AS CodigoTipoMovimiento,tm.Naturaleza,mi.Cantidad,
  mi.FechaMovimiento,mi.IdUsuario,u.NombreCompleto AS UsuarioNombre,mi.DocumentoOrigen,
  COALESCE(co.NumeroCompra,os.NumeroOrden,'AJUSTE') AS NumeroDocumento,
  mi.IdDetalleCompra,mi.IdRepuestoReparacion,mi.ExistenciaResultante,mi.Observacion
FROM dbo.MovimientoInventario mi JOIN dbo.Bodega b ON b.IdBodega=mi.IdBodega
JOIN dbo.Repuesto rp ON rp.IdRepuesto=mi.IdRepuesto JOIN dbo.TipoMovimiento tm ON tm.IdTipoMovimiento=mi.IdTipoMovimiento
JOIN dbo.Usuario u ON u.IdUsuario=mi.IdUsuario
LEFT JOIN dbo.DetalleCompra dc ON dc.IdDetalleCompra=mi.IdDetalleCompra LEFT JOIN dbo.Compra co ON co.IdCompra=dc.IdCompra
LEFT JOIN dbo.RepuestoReparacion rr ON rr.IdRepuestoReparacion=mi.IdRepuestoReparacion
LEFT JOIN dbo.Reparacion re ON re.IdReparacion=rr.IdReparacion
LEFT JOIN dbo.Diagnostico dg ON dg.IdDiagnostico=re.IdDiagnostico LEFT JOIN dbo.OrdenServicio os ON os.IdOrden=dg.IdOrden;
GO
/* Grano: orden/diagnostico/reparacion/consumo/movimiento. Cabeceras financieras
   pueden repetirse: NO sumar TotalFactura/TotalPagado sobre estas filas. */
CREATE OR ALTER VIEW dbo.vw_TrazabilidadOrden
AS
SELECT o.IdOrden,o.NumeroOrden,o.FechaIngreso,o.ProblemaReportado,o.Estado AS EstadoOrden,
  o.Prioridad,o.IdCliente,o.ClienteNombre,o.IdEquipo,o.NumeroSerie,o.TipoEquipoNombre,o.MarcaNombre,o.Modelo,o.Recepcionista,
  d.IdDiagnostico,d.FechaDiagnostico,d.Descripcion AS Diagnostico,d.Estado AS EstadoDiagnostico,
  td.NombreCompleto AS TecnicoDiagnostico,r.IdReparacion,r.FechaInicio,r.FechaFin,r.Estado AS EstadoReparacion,r.CostoManoObra,
  tr.NombreCompleto AS TecnicoReparacion,rr.IdRepuestoReparacion,rr.IdBodega,rr.IdRepuesto,
  rp.Codigo AS CodigoRepuesto,rp.Nombre AS RepuestoNombre,rr.Cantidad,rr.PrecioCostoUnitario,rr.PrecioVentaUnitario,rr.Subtotal AS SubtotalRepuesto,
  mi.IdMovimiento,mi.FechaMovimiento,mi.ExistenciaResultante,
  f.IdFactura,f.NumeroFactura,f.Estado AS EstadoFactura,f.Total AS TotalFactura,f.TotalPagado,f.Saldo AS SaldoPendiente,
  en.FechaEntrega,en.NombreRecibe
FROM dbo.vw_Ordenes o LEFT JOIN dbo.Diagnostico d ON d.IdOrden=o.IdOrden
LEFT JOIN dbo.Usuario td ON td.IdUsuario=d.IdTecnico LEFT JOIN dbo.Reparacion r ON r.IdDiagnostico=d.IdDiagnostico
LEFT JOIN dbo.Usuario tr ON tr.IdUsuario=r.IdTecnico LEFT JOIN dbo.RepuestoReparacion rr ON rr.IdReparacion=r.IdReparacion
LEFT JOIN dbo.Repuesto rp ON rp.IdRepuesto=rr.IdRepuesto
LEFT JOIN dbo.MovimientoInventario mi ON mi.IdRepuestoReparacion=rr.IdRepuestoReparacion
LEFT JOIN dbo.vw_Facturas f ON f.IdOrden=o.IdOrden LEFT JOIN dbo.Entrega en ON en.IdOrden=o.IdOrden;
GO
CREATE OR ALTER VIEW dbo.vw_IngresosFacturadosMensual
AS
SELECT YEAR(f.FechaFactura) AS Anio,MONTH(f.FechaFactura) AS Mes,COUNT(*) AS CantidadFacturas,
  SUM(f.SubtotalManoObra) AS TotalManoObra,SUM(f.SubtotalRepuestos) AS TotalRepuestos,
  SUM(f.Subtotal) AS Subtotal,SUM(f.Impuesto) AS Impuesto,SUM(f.Total) AS Total
FROM dbo.Factura f WHERE f.Estado<>'ANULADA' GROUP BY YEAR(f.FechaFactura),MONTH(f.FechaFactura);
GO
CREATE OR ALTER VIEW dbo.vw_DashboardResumen
AS
SELECT
 (SELECT COUNT(*) FROM dbo.vw_Ordenes WHERE EsFinal=0) AS OrdenesAbiertas,
 (SELECT COUNT(*) FROM dbo.vw_Ordenes WHERE Estado='DIAGNOSTICO') AS OrdenesEnDiagnostico,
 (SELECT COUNT(*) FROM dbo.vw_Ordenes WHERE Estado='REPARACION') AS OrdenesEnReparacion,
 (SELECT COUNT(*) FROM dbo.vw_Ordenes WHERE Estado='LISTO') AS OrdenesListas,
 (SELECT COUNT(*) FROM dbo.vw_FacturaSaldo WHERE Estado='EMITIDA' AND Saldo>0) AS FacturasConSaldo,
 (SELECT COUNT(*) FROM dbo.vw_InventarioActual WHERE BajoMinimo=1) AS RepuestosBajoMinimo;
GO
CREATE OR ALTER VIEW dbo.vw_ActividadReciente
AS
SELECT 'ESTADO_ORDEN' AS Tipo,'Orden '+o.NumeroOrden+': '+e.Nombre AS Descripcion,h.FechaCambio AS Fecha
FROM dbo.HistorialEstadoOrden h JOIN dbo.OrdenServicio o ON o.IdOrden=h.IdOrden
JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=h.IdEstadoNuevo
UNION ALL
SELECT 'MOVIMIENTO_INVENTARIO','Inventario '+r.Codigo+': '+t.Nombre,m.FechaMovimiento
FROM dbo.MovimientoInventario m JOIN dbo.Repuesto r ON r.IdRepuesto=m.IdRepuesto
JOIN dbo.TipoMovimiento t ON t.IdTipoMovimiento=m.IdTipoMovimiento;
GO

/* ===== fases/06_catalogos.sql ===== */
/* FASE 06. Solo catalogos. No crea usuarios, passwords ni datos de negocio. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
INSERT dbo.Rol(Codigo,Nombre,Descripcion) VALUES
 ('ADMINISTRADOR','Administrador','Administracion del sistema'),('RECEPCION','Recepcion','Clientes, equipos y ordenes'),
 ('TECNICO','Tecnico','Diagnostico, reparacion y consumo'),('BODEGA','Bodega','Inventario y compras'),('CAJA','Caja','Facturacion y pagos');
INSERT dbo.Permiso(Codigo,Descripcion) VALUES
 ('CLIENTES_GESTIONAR','Gestionar clientes'),('EQUIPOS_GESTIONAR','Gestionar equipos'),('ORDENES_CREAR','Registrar ordenes'),
 ('DIAGNOSTICO_REGISTRAR','Registrar diagnostico'),('REPARACION_GESTIONAR','Gestionar reparaciones'),('REPUESTOS_CONSUMIR','Consumir repuestos'),
 ('INVENTARIO_GESTIONAR','Gestionar inventario'),('COMPRAS_GESTIONAR','Registrar y recibir compras'),('PROVEEDORES_GESTIONAR','Gestionar proveedores'),
 ('FACTURAR','Emitir factura'),('PAGOS_REGISTRAR','Registrar/anular pagos'),('ENTREGAR_ORDEN','Entregar orden'),
 ('REPORTES_VER','Consultar reportes'),('USUARIOS_GESTIONAR','Gestionar usuarios');
INSERT dbo.RolPermiso(IdRol,IdPermiso)
SELECT r.IdRol,p.IdPermiso FROM dbo.Rol r CROSS JOIN dbo.Permiso p WHERE r.Codigo='ADMINISTRADOR';
DECLARE @RP TABLE (Rol VARCHAR(30),Permiso VARCHAR(40));
INSERT @RP VALUES
 ('RECEPCION','CLIENTES_GESTIONAR'),('RECEPCION','EQUIPOS_GESTIONAR'),('RECEPCION','ORDENES_CREAR'),('RECEPCION','ENTREGAR_ORDEN'),('RECEPCION','REPORTES_VER'),
 ('TECNICO','DIAGNOSTICO_REGISTRAR'),('TECNICO','REPARACION_GESTIONAR'),('TECNICO','REPUESTOS_CONSUMIR'),('TECNICO','REPORTES_VER'),
 ('BODEGA','INVENTARIO_GESTIONAR'),('BODEGA','COMPRAS_GESTIONAR'),('BODEGA','PROVEEDORES_GESTIONAR'),('BODEGA','REPORTES_VER'),
 ('CAJA','FACTURAR'),('CAJA','PAGOS_REGISTRAR'),('CAJA','ENTREGAR_ORDEN'),('CAJA','REPORTES_VER');
INSERT dbo.RolPermiso(IdRol,IdPermiso)
SELECT r.IdRol,p.IdPermiso FROM @RP x JOIN dbo.Rol r ON r.Codigo=x.Rol JOIN dbo.Permiso p ON p.Codigo=x.Permiso;
INSERT dbo.EstadoOrden(Codigo,Nombre,Orden,EsFinal) VALUES
 ('RECIBIDO','Recibido',1,0),('DIAGNOSTICO','En diagnostico',2,0),('ESPERANDO_AUTORIZACION','Esperando autorizacion',3,0),
 ('REPARACION','En reparacion',4,0),('LISTO','Listo para entregar',5,0),('ENTREGADO','Entregado',6,1),('CANCELADO','Cancelado',7,1);
DECLARE @Transiciones TABLE(Origen VARCHAR(30),Destino VARCHAR(30));
INSERT @Transiciones VALUES ('RECIBIDO','DIAGNOSTICO'),('RECIBIDO','CANCELADO'),('DIAGNOSTICO','ESPERANDO_AUTORIZACION'),('DIAGNOSTICO','CANCELADO'),
 ('ESPERANDO_AUTORIZACION','REPARACION'),('ESPERANDO_AUTORIZACION','DIAGNOSTICO'),('ESPERANDO_AUTORIZACION','CANCELADO'),
 ('REPARACION','LISTO'),('REPARACION','CANCELADO'),('LISTO','ENTREGADO'),('LISTO','REPARACION');
INSERT dbo.TransicionEstadoOrden(IdEstadoOrigen,IdEstadoDestino)
SELECT a.IdEstadoOrden,b.IdEstadoOrden FROM @Transiciones t JOIN dbo.EstadoOrden a ON a.Codigo=t.Origen JOIN dbo.EstadoOrden b ON b.Codigo=t.Destino;
INSERT dbo.Prioridad(Codigo,Nombre,Nivel) VALUES ('BAJA','Baja',1),('NORMAL','Normal',2),('ALTA','Alta',3),('URGENTE','Urgente',4);
INSERT dbo.TipoEquipo(Nombre) VALUES ('Laptop'),('Computadora de escritorio'),('Impresora'),('Equipo de red'),('Monitor'),('Servidor'),('Otro');
INSERT dbo.Marca(Nombre) VALUES ('HP'),('Dell'),('Lenovo'),('Asus'),('Acer'),('Apple'),('Epson'),('Canon'),('Brother'),('Cisco'),('TP-Link'),('Samsung'),('LG'),('Otra');
INSERT dbo.CategoriaRepuesto(Nombre,Descripcion) VALUES
 ('Almacenamiento','Discos y SSD'),('Memoria RAM','Modulos'),('Pantallas','Paneles'),('Baterias y cargadores','Energia'),
 ('Placas y procesadores','Tarjetas y CPU'),('Perifericos','Teclados y dispositivos'),('Impresion','Cartuchos y rodillos'),
 ('Redes','Adaptadores'),('Refrigeracion','Ventiladores'),('Cables y conectores','Conectores');
INSERT dbo.TipoMovimiento(Codigo,Nombre,Naturaleza) VALUES
 ('COMPRA_ENTRADA','Recepcion de compra','E'),('CONSUMO_REPARACION','Consumo en reparacion','S'),('AJUSTE_ENTRADA','Ajuste entrada','E'),('AJUSTE_SALIDA','Ajuste salida','S');
INSERT dbo.MetodoPago(Codigo,Nombre) VALUES ('EFECTIVO','Efectivo'),('TARJETA','Tarjeta'),('TRANSFERENCIA','Transferencia'),('CHEQUE','Cheque'),('DEPOSITO','Deposito');
COMMIT TRANSACTION;
GO

/* ===== fases/07_procedimientos.sql ===== */
/* FASE 07. Procesos. Bloquear primero orden y despues reparacion/factura/pago.
   Inventario serializa por bodega para simplificar el trabajo de cuatro usuarios.
   Los SP reutilizan transaccion exterior; el llamador debe hacer rollback al fallar. */
CREATE OR ALTER PROCEDURE dbo.sp_CambiarEstadoOrden
 @IdOrden INT,@CodigoEstadoNuevo VARCHAR(30),@IdUsuario INT,@Observacion VARCHAR(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Actual INT,@CodigoActual VARCHAR(30),@Nuevo INT,@Factura INT;
  SELECT @Actual=o.IdEstadoOrden,@CodigoActual=e.Codigo FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK)
  JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@IdOrden;
  IF @Actual IS NULL THROW 50100,N'La orden no existe.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Usuario WHERE IdUsuario=@IdUsuario AND Activo=1) THROW 50101,N'Usuario no disponible.',1;
  SELECT @Nuevo=IdEstadoOrden FROM dbo.EstadoOrden WHERE Codigo=@CodigoEstadoNuevo;
  IF @Nuevo IS NULL THROW 50102,N'El estado destino no existe.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.TransicionEstadoOrden WHERE IdEstadoOrigen=@Actual AND IdEstadoDestino=@Nuevo)
   THROW 50103,N'Transicion de estado no permitida.',1;
  IF @CodigoEstadoNuevo='CANCELADO' AND dbo.fn_UsuarioTieneRol(@IdUsuario,'RECEPCION')=0 AND dbo.fn_UsuarioTieneRol(@IdUsuario,'ADMINISTRADOR')=0
   THROW 50112,N'Usuario sin permiso para cancelar ordenes.',1;
  IF @CodigoEstadoNuevo='DIAGNOSTICO' AND dbo.fn_UsuarioTieneRol(@IdUsuario,'RECEPCION')=0 AND dbo.fn_UsuarioTienePermiso(@IdUsuario,'DIAGNOSTICO_REGISTRAR')=0
   THROW 50112,N'Usuario sin permiso para diagnostico.',1;
  IF @CodigoEstadoNuevo='ESPERANDO_AUTORIZACION' AND dbo.fn_UsuarioTienePermiso(@IdUsuario,'DIAGNOSTICO_REGISTRAR')=0
   THROW 50112,N'Usuario sin permiso para diagnostico.',1;
  IF @CodigoEstadoNuevo IN('REPARACION','LISTO') AND dbo.fn_UsuarioTienePermiso(@IdUsuario,'REPARACION_GESTIONAR')=0
   THROW 50112,N'Usuario sin permiso para reparacion.',1;
  IF @CodigoEstadoNuevo='ENTREGADO' AND dbo.fn_UsuarioTienePermiso(@IdUsuario,'ENTREGAR_ORDEN')=0
   THROW 50112,N'Usuario sin permiso para entregar.',1;
  IF @CodigoEstadoNuevo IN('ESPERANDO_AUTORIZACION','REPARACION')
     AND NOT EXISTS(SELECT 1 FROM dbo.Diagnostico WHERE IdOrden=@IdOrden AND Estado='ACTIVO')
   THROW 50104,N'Se requiere diagnostico activo.',1;
  IF @CodigoEstadoNuevo='REPARACION' AND EXISTS(SELECT 1 FROM dbo.Factura WHERE IdOrden=@IdOrden)
   THROW 50113,N'Una orden facturada no se reabre ni recibe nuevos trabajos.',1;
  IF @CodigoEstadoNuevo='LISTO'
  BEGIN
   IF EXISTS(SELECT 1 FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE d.IdOrden=@IdOrden AND r.Estado='EN_PROCESO')
    THROW 50105,N'Existen reparaciones en proceso.',1;
   IF NOT EXISTS(SELECT 1 FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE d.IdOrden=@IdOrden AND r.Estado='FINALIZADA')
    THROW 50106,N'Falta una reparacion finalizada.',1;
  END;
  IF @CodigoEstadoNuevo='ENTREGADO'
  BEGIN
   IF NOT EXISTS(SELECT 1 FROM dbo.Entrega WHERE IdOrden=@IdOrden) THROW 50107,N'Falta el registro de entrega.',1;
   SELECT @Factura=IdFactura FROM dbo.Factura WITH(UPDLOCK,HOLDLOCK) WHERE IdOrden=@IdOrden AND Estado<>'ANULADA';
   IF @Factura IS NULL THROW 50108,N'Falta factura vigente.',1;
   IF dbo.fn_SaldoFactura(@Factura)<>0 THROW 50109,N'La factura tiene saldo pendiente o inconsistente.',1;
  END;
  IF @CodigoEstadoNuevo='CANCELADO'
  BEGIN
   IF EXISTS(SELECT 1 FROM dbo.RepuestoReparacion rr JOIN dbo.Reparacion r ON r.IdReparacion=rr.IdReparacion
    JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE d.IdOrden=@IdOrden AND rr.Estado='ACTIVO')
    THROW 50110,N'No cancelar una orden con repuestos consumidos.',1;
   IF EXISTS(SELECT 1 FROM dbo.Factura WHERE IdOrden=@IdOrden AND Estado<>'ANULADA') THROW 50111,N'La orden tiene factura vigente.',1;
   UPDATE r SET Estado='CANCELADA',FechaFin=SYSUTCDATETIME()
    FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico
    WHERE d.IdOrden=@IdOrden AND r.Estado='EN_PROCESO';
  END;
  INSERT dbo.HistorialEstadoOrden(IdOrden,IdEstadoAnterior,IdEstadoNuevo,IdUsuario,Observacion)
   VALUES(@IdOrden,@Actual,@Nuevo,@IdUsuario,@Observacion);
  UPDATE dbo.OrdenServicio SET IdEstadoOrden=@Nuevo WHERE IdOrden=@IdOrden;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarOrdenServicio
 @IdCliente INT,@IdEquipo INT,@IdUsuarioRecepcion INT,@IdPrioridad INT,@ProblemaReportado VARCHAR(1000),
 @FechaEstimada DATE=NULL,@Observaciones VARCHAR(500)=NULL,@IdOrden INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Propietario INT,@EquipoEstado VARCHAR(10),@Estado INT,@Numero VARCHAR(20),@N BIGINT;
  SELECT @Propietario=IdCliente,@EquipoEstado=Estado FROM dbo.Equipo WITH(UPDLOCK,HOLDLOCK) WHERE IdEquipo=@IdEquipo;
  IF NOT EXISTS(SELECT 1 FROM dbo.Cliente WHERE IdCliente=@IdCliente AND Estado='ACTIVO') THROW 50200,N'Cliente inexistente o inactivo.',1;
  IF @Propietario IS NULL OR @Propietario<>@IdCliente OR @EquipoEstado<>'ACTIVO' THROW 50201,N'Equipo no disponible o de otro cliente.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuarioRecepcion,'ORDENES_CREAR')=0 THROW 50202,N'Usuario sin permiso de recepcion.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Prioridad WHERE IdPrioridad=@IdPrioridad) THROW 50203,N'Prioridad no valida.',1;
  IF @ProblemaReportado IS NULL OR LEN(LTRIM(RTRIM(@ProblemaReportado)))=0 THROW 50204,N'Indicar el problema reportado.',1;
  IF @FechaEstimada<CONVERT(DATE,DATEADD(HOUR,-6,SYSUTCDATETIME())) THROW 50205,N'Fecha estimada anterior al ingreso.',1;
  IF EXISTS(SELECT 1 FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK) JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdEquipo=@IdEquipo AND e.EsFinal=0)
   THROW 50206,N'El equipo ya tiene una orden abierta.',1;
  SELECT @Estado=IdEstadoOrden FROM dbo.EstadoOrden WHERE Codigo='RECIBIDO';
  SET @N=NEXT VALUE FOR dbo.seq_NumeroOrden;
  SET @Numero='OS-'+CONVERT(VARCHAR(4),YEAR(SYSUTCDATETIME()))+'-'+CASE WHEN @N<1000000 THEN RIGHT('000000'+CONVERT(VARCHAR(10),@N),6) ELSE CONVERT(VARCHAR(10),@N) END;
  INSERT dbo.OrdenServicio(NumeroOrden,IdEquipo,IdUsuarioRecepcion,ProblemaReportado,IdPrioridad,IdEstadoOrden,FechaEstimada,Observaciones)
   VALUES(@Numero,@IdEquipo,@IdUsuarioRecepcion,@ProblemaReportado,@IdPrioridad,@Estado,@FechaEstimada,@Observaciones);
  SET @IdOrden=CONVERT(INT,SCOPE_IDENTITY());
  -- El trigger AFTER INSERT agrega el historial inicial, incluso en ingreso SQL directo.
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarDiagnostico
 @IdOrden INT,@IdTecnico INT,@Descripcion VARCHAR(1000),@CostoManoObraEstimado DECIMAL(12,2),@IdDiagnostico INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Estado VARCHAR(30);
  SELECT @Estado=e.Codigo FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK) JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@IdOrden;
  IF @Estado IS NULL THROW 50300,N'La orden no existe.',1;
  IF @Estado NOT IN('RECIBIDO','DIAGNOSTICO') THROW 50301,N'El estado no permite diagnosticar.',1;
  IF dbo.fn_UsuarioTieneRol(@IdTecnico,'TECNICO')=0 OR dbo.fn_UsuarioTienePermiso(@IdTecnico,'DIAGNOSTICO_REGISTRAR')=0 THROW 50302,N'Se requiere tecnico activo autorizado.',1;
  IF @Descripcion IS NULL OR LEN(LTRIM(RTRIM(@Descripcion)))=0 THROW 50303,N'Indicar diagnostico.',1;
  IF @CostoManoObraEstimado IS NULL OR @CostoManoObraEstimado<0 THROW 50304,N'Costo estimado invalido.',1;
  IF EXISTS(SELECT 1 FROM dbo.Diagnostico WHERE IdOrden=@IdOrden AND Estado='ACTIVO') THROW 50305,N'Ya existe diagnostico activo.',1;
  IF @Estado='RECIBIDO' EXEC dbo.sp_CambiarEstadoOrden @IdOrden,'DIAGNOSTICO',@IdTecnico,'Inicio de diagnostico';
  INSERT dbo.Diagnostico(IdOrden,IdTecnico,Descripcion,CostoManoObraEstimado) VALUES(@IdOrden,@IdTecnico,@Descripcion,@CostoManoObraEstimado);
  SET @IdDiagnostico=CONVERT(INT,SCOPE_IDENTITY());
  EXEC dbo.sp_CambiarEstadoOrden @IdOrden,'ESPERANDO_AUTORIZACION',@IdTecnico,'Diagnostico registrado';
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_IniciarReparacion
 @IdOrden INT,@IdTecnico INT,@Descripcion VARCHAR(1000),@CostoManoObra DECIMAL(12,2),@IdReparacion INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Estado VARCHAR(30),@Diagnostico INT;
  SELECT @Estado=e.Codigo FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK) JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@IdOrden;
  IF @Estado IS NULL THROW 50400,N'La orden no existe.',1;
  IF @Estado NOT IN('ESPERANDO_AUTORIZACION','REPARACION') THROW 50401,N'El estado no permite iniciar reparacion.',1;
  IF dbo.fn_UsuarioTieneRol(@IdTecnico,'TECNICO')=0 OR dbo.fn_UsuarioTienePermiso(@IdTecnico,'REPARACION_GESTIONAR')=0 THROW 50402,N'Se requiere tecnico activo autorizado.',1;
  IF @CostoManoObra IS NULL OR @CostoManoObra<0 THROW 50403,N'Costo de mano de obra invalido.',1;
  IF @Descripcion IS NULL OR LEN(LTRIM(RTRIM(@Descripcion)))=0 THROW 50404,N'Indicar el trabajo.',1;
  SELECT @Diagnostico=IdDiagnostico FROM dbo.Diagnostico WHERE IdOrden=@IdOrden AND Estado='ACTIVO';
  IF @Diagnostico IS NULL THROW 50405,N'Se requiere diagnostico previo.',1;
  IF EXISTS(SELECT 1 FROM dbo.Factura WHERE IdOrden=@IdOrden) THROW 50113,N'No agregar trabajos a una orden facturada.',1;
  INSERT dbo.Reparacion(IdDiagnostico,IdTecnico,Descripcion,CostoManoObra) VALUES(@Diagnostico,@IdTecnico,@Descripcion,@CostoManoObra);
  SET @IdReparacion=CONVERT(INT,SCOPE_IDENTITY());
  IF @Estado='ESPERANDO_AUTORIZACION' EXEC dbo.sp_CambiarEstadoOrden @IdOrden,'REPARACION',@IdTecnico,'Reparacion autorizada e iniciada';
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_FinalizarReparacion
 @IdReparacion INT,@IdUsuario INT,@Observacion VARCHAR(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Orden INT,@Estado VARCHAR(12),@Tecnico INT,@EstadoOrden VARCHAR(30),@Obs VARCHAR(500);
  SELECT @Orden=d.IdOrden FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE r.IdReparacion=@IdReparacion;
  IF @Orden IS NULL THROW 50500,N'La reparacion no existe.',1;
  SELECT @EstadoOrden=e.Codigo FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK) JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@Orden;
  SELECT @Estado=Estado,@Tecnico=IdTecnico FROM dbo.Reparacion WITH(UPDLOCK,HOLDLOCK) WHERE IdReparacion=@IdReparacion;
  IF @Estado<>'EN_PROCESO' OR @EstadoOrden<>'REPARACION' THROW 50501,N'La reparacion/orden no esta en proceso.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'REPARACION_GESTIONAR')=0
   THROW 50502,N'Usuario sin permiso de reparacion.',1;
  IF dbo.fn_UsuarioTieneRol(@IdUsuario,'ADMINISTRADOR')=0 AND (@IdUsuario<>@Tecnico OR dbo.fn_UsuarioTieneRol(@IdUsuario,'TECNICO')=0)
   THROW 50502,N'Solo el tecnico responsable o administrador puede finalizar.',1;
  UPDATE dbo.Reparacion SET Estado='FINALIZADA',FechaFin=SYSUTCDATETIME() WHERE IdReparacion=@IdReparacion;
  IF NOT EXISTS(SELECT 1 FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE d.IdOrden=@Orden AND r.Estado='EN_PROCESO')
  BEGIN
   SET @Obs=ISNULL(@Observacion,'Reparacion finalizada');
   EXEC dbo.sp_CambiarEstadoOrden @Orden,'LISTO',@IdUsuario,@Obs;
  END;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_AsignarRepuestoReparacion
 @IdReparacion INT,@IdBodega INT,@IdRepuesto INT,@Cantidad INT,@IdUsuario INT,@IdRepuestoReparacion INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Orden INT,@EstadoOrden VARCHAR(30),@Estado VARCHAR(12),@Existencia INT,@Costo DECIMAL(12,2),@Venta DECIMAL(12,2),@Tipo INT;
  IF @Cantidad IS NULL OR @Cantidad<=0 THROW 50600,N'Cantidad no valida.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'REPUESTOS_CONSUMIR')=0 THROW 50601,N'Usuario sin permiso de consumo.',1;
  SELECT @Orden=d.IdOrden FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE r.IdReparacion=@IdReparacion;
  IF @Orden IS NULL THROW 50602,N'La reparacion no existe.',1;
  SELECT @EstadoOrden=e.Codigo FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK) JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@Orden;
  SELECT @Estado=Estado FROM dbo.Reparacion WITH(UPDLOCK,HOLDLOCK) WHERE IdReparacion=@IdReparacion;
  IF @Estado<>'EN_PROCESO' OR @EstadoOrden<>'REPARACION' THROW 50603,N'La reparacion debe estar en proceso.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Bodega WITH(UPDLOCK,HOLDLOCK) WHERE IdBodega=@IdBodega AND Estado='ACTIVA') THROW 50608,N'Bodega no disponible.',1;
  SELECT @Costo=PrecioCompraReferencia,@Venta=PrecioVenta FROM dbo.Repuesto WITH(HOLDLOCK) WHERE IdRepuesto=@IdRepuesto AND Estado='ACTIVO';
  IF @Costo IS NULL THROW 50604,N'Repuesto inexistente o inactivo.',1;
  SELECT @Existencia=Existencia FROM dbo.InventarioBodega WITH(UPDLOCK,HOLDLOCK) WHERE IdBodega=@IdBodega AND IdRepuesto=@IdRepuesto;
  IF @Existencia IS NULL THROW 50606,N'Repuesto no registrado en esa bodega.',1;
  IF @Existencia<@Cantidad THROW 50607,N'Stock insuficiente en la bodega seleccionada.',1;
  SELECT @Tipo=IdTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo='CONSUMO_REPARACION';
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=1;
  UPDATE dbo.InventarioBodega SET Existencia=Existencia-@Cantidad,FechaUltimoMovimiento=SYSUTCDATETIME() WHERE IdBodega=@IdBodega AND IdRepuesto=@IdRepuesto;
  INSERT dbo.RepuestoReparacion(IdReparacion,IdBodega,IdRepuesto,Cantidad,PrecioCostoUnitario,PrecioVentaUnitario,IdUsuario)
   VALUES(@IdReparacion,@IdBodega,@IdRepuesto,@Cantidad,@Costo,@Venta,@IdUsuario);
  SET @IdRepuestoReparacion=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.MovimientoInventario(IdBodega,IdRepuesto,IdTipoMovimiento,Cantidad,IdUsuario,DocumentoOrigen,IdRepuestoReparacion,ExistenciaResultante)
   VALUES(@IdBodega,@IdRepuesto,@Tipo,@Cantidad,@IdUsuario,'REPARACION',@IdRepuestoReparacion,@Existencia-@Cantidad);
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=NULL;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=NULL;
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarCompra
 @IdProveedor INT,@IdBodegaDestino INT,@IdUsuario INT,@NumeroDocumentoProveedor VARCHAR(40)=NULL,
 @Observaciones VARCHAR(500)=NULL,@Detalle dbo.tvp_DetalleCompra READONLY,@IdCompra INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.Proveedor WHERE IdProveedor=@IdProveedor AND Estado='ACTIVO') THROW 50700,N'Proveedor no disponible.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Bodega WHERE IdBodega=@IdBodegaDestino AND Estado='ACTIVA') THROW 50701,N'Bodega no disponible.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'COMPRAS_GESTIONAR')=0 THROW 50702,N'Usuario sin permiso de compras.',1;
  IF NOT EXISTS(SELECT 1 FROM @Detalle) THROW 50703,N'La compra requiere detalle.',1;
  IF EXISTS(SELECT 1 FROM @Detalle WHERE Cantidad<=0 OR CostoUnitario<0) THROW 50704,N'Detalle invalido.',1;
  IF EXISTS(SELECT 1 FROM @Detalle d LEFT JOIN dbo.Repuesto r ON r.IdRepuesto=d.IdRepuesto WHERE r.IdRepuesto IS NULL OR r.Estado<>'ACTIVO') THROW 50706,N'Repuestos no disponibles.',1;
  DECLARE @Numero VARCHAR(20),@N BIGINT=NEXT VALUE FOR dbo.seq_NumeroCompra;
  SET @Numero='CP-'+CONVERT(VARCHAR(4),YEAR(SYSUTCDATETIME()))+'-'+CASE WHEN @N<1000000 THEN RIGHT('000000'+CONVERT(VARCHAR(10),@N),6) ELSE CONVERT(VARCHAR(10),@N) END;
  INSERT dbo.Compra(NumeroCompra,IdProveedor,IdBodegaDestino,IdUsuarioRegistro,NumeroDocumentoProveedor,Observaciones)
   VALUES(@Numero,@IdProveedor,@IdBodegaDestino,@IdUsuario,@NumeroDocumentoProveedor,@Observaciones);
  SET @IdCompra=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.DetalleCompra(IdCompra,IdRepuesto,Cantidad,CostoUnitario) SELECT @IdCompra,IdRepuesto,Cantidad,CostoUnitario FROM @Detalle;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_RecibirCompra @IdCompra INT,@IdUsuario INT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Estado VARCHAR(10),@Bodega INT,@Tipo INT;
  SELECT @Estado=Estado,@Bodega=IdBodegaDestino FROM dbo.Compra WITH(UPDLOCK,HOLDLOCK) WHERE IdCompra=@IdCompra;
  IF @Estado IS NULL THROW 50800,N'La compra no existe.',1;
  IF @Estado<>'PENDIENTE' THROW 50801,N'Solo se recibe una compra pendiente.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'COMPRAS_GESTIONAR')=0 THROW 50802,N'Usuario sin permiso de recepcion.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.DetalleCompra WHERE IdCompra=@IdCompra) THROW 50803,N'La compra no tiene detalle.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Bodega WITH(UPDLOCK,HOLDLOCK) WHERE IdBodega=@Bodega AND Estado='ACTIVA') THROW 50804,N'Bodega inactiva.',1;
  IF EXISTS(SELECT 1 FROM dbo.DetalleCompra dc JOIN dbo.Repuesto r ON r.IdRepuesto=dc.IdRepuesto WHERE dc.IdCompra=@IdCompra AND r.Estado<>'ACTIVO') THROW 50805,N'La compra contiene repuestos inactivos.',1;
  SELECT @Tipo=IdTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo='COMPRA_ENTRADA';
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=1;
  INSERT dbo.InventarioBodega(IdBodega,IdRepuesto,Existencia,StockMinimo)
   SELECT @Bodega,dc.IdRepuesto,0,0 FROM dbo.DetalleCompra dc WHERE dc.IdCompra=@IdCompra
   AND NOT EXISTS(SELECT 1 FROM dbo.InventarioBodega ib WITH(UPDLOCK,HOLDLOCK) WHERE ib.IdBodega=@Bodega AND ib.IdRepuesto=dc.IdRepuesto);
  UPDATE ib SET Existencia=ib.Existencia+dc.Cantidad,FechaUltimoMovimiento=SYSUTCDATETIME()
   FROM dbo.InventarioBodega ib JOIN dbo.DetalleCompra dc ON dc.IdRepuesto=ib.IdRepuesto WHERE ib.IdBodega=@Bodega AND dc.IdCompra=@IdCompra;
  INSERT dbo.MovimientoInventario(IdBodega,IdRepuesto,IdTipoMovimiento,Cantidad,IdUsuario,DocumentoOrigen,IdDetalleCompra,ExistenciaResultante)
   SELECT @Bodega,dc.IdRepuesto,@Tipo,dc.Cantidad,@IdUsuario,'COMPRA',dc.IdDetalleCompra,ib.Existencia
   FROM dbo.DetalleCompra dc JOIN dbo.InventarioBodega ib ON ib.IdBodega=@Bodega AND ib.IdRepuesto=dc.IdRepuesto WHERE dc.IdCompra=@IdCompra;
  UPDATE dbo.Compra SET Estado='RECIBIDA',FechaRecepcion=SYSUTCDATETIME(),IdUsuarioRecepcion=@IdUsuario WHERE IdCompra=@IdCompra;
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=NULL;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=NULL;
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_AjustarInventario
 @IdBodega INT,@IdRepuesto INT,@CodigoTipoMovimiento VARCHAR(30),@Cantidad INT,@IdUsuario INT,@Observacion VARCHAR(300),@StockMinimo INT=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Tipo INT,@Naturaleza CHAR(1),@Existencia INT,@Nueva INT;
  IF @CodigoTipoMovimiento IS NULL OR @CodigoTipoMovimiento NOT IN('AJUSTE_ENTRADA','AJUSTE_SALIDA') THROW 50900,N'Tipo de ajuste no valido.',1;
  IF @Cantidad IS NULL OR @Cantidad<=0 THROW 50901,N'Cantidad no valida.',1;
  IF @Observacion IS NULL OR LEN(LTRIM(RTRIM(@Observacion)))=0 THROW 50902,N'Indicar motivo del ajuste.',1;
  IF @StockMinimo<0 THROW 50903,N'Minimo no valido.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'INVENTARIO_GESTIONAR')=0 THROW 50904,N'Usuario sin permiso de ajuste.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Bodega WITH(UPDLOCK,HOLDLOCK) WHERE IdBodega=@IdBodega AND Estado='ACTIVA') THROW 50905,N'Bodega no disponible.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Repuesto WHERE IdRepuesto=@IdRepuesto AND Estado='ACTIVO') THROW 50906,N'Repuesto no disponible.',1;
  SELECT @Tipo=IdTipoMovimiento,@Naturaleza=Naturaleza FROM dbo.TipoMovimiento WHERE Codigo=@CodigoTipoMovimiento;
  SELECT @Existencia=Existencia FROM dbo.InventarioBodega WITH(UPDLOCK,HOLDLOCK) WHERE IdBodega=@IdBodega AND IdRepuesto=@IdRepuesto;
  IF @Existencia IS NULL
  BEGIN
   IF @Naturaleza='S' THROW 50907,N'No existe stock en esa bodega.',1;
   INSERT dbo.InventarioBodega(IdBodega,IdRepuesto,Existencia,StockMinimo) VALUES(@IdBodega,@IdRepuesto,0,ISNULL(@StockMinimo,0));
   SET @Existencia=0;
  END;
  SET @Nueva=CASE WHEN @Naturaleza='E' THEN @Existencia+@Cantidad ELSE @Existencia-@Cantidad END;
  IF @Nueva<0 THROW 50908,N'La existencia no puede quedar negativa.',1;
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=1;
  UPDATE dbo.InventarioBodega SET Existencia=@Nueva,StockMinimo=ISNULL(@StockMinimo,StockMinimo),FechaUltimoMovimiento=SYSUTCDATETIME() WHERE IdBodega=@IdBodega AND IdRepuesto=@IdRepuesto;
  INSERT dbo.MovimientoInventario(IdBodega,IdRepuesto,IdTipoMovimiento,Cantidad,IdUsuario,DocumentoOrigen,Observacion,ExistenciaResultante)
   VALUES(@IdBodega,@IdRepuesto,@Tipo,@Cantidad,@IdUsuario,'AJUSTE',@Observacion,@Nueva);
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=NULL;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  EXEC sys.sp_set_session_context @key=N'ProcesoInventario',@value=NULL;
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_GenerarFactura
 @IdOrden INT,@IdUsuario INT,@NITFacturacion VARCHAR(20)=NULL,@NombreFacturacion VARCHAR(150)=NULL,
 @DireccionFacturacion VARCHAR(250)=NULL,@PorcentajeImpuesto DECIMAL(5,2)=12.00,@IdFactura INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Estado VARCHAR(30),@Cliente INT,@MO DECIMAL(12,2),@Rep DECIMAL(12,2),@Numero VARCHAR(20),@N BIGINT;
  SELECT @Estado=es.Codigo,@Cliente=e.IdCliente FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK)
   JOIN dbo.EstadoOrden es ON es.IdEstadoOrden=o.IdEstadoOrden JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo WHERE o.IdOrden=@IdOrden;
  IF @Estado IS NULL THROW 51000,N'La orden no existe.',1;
  IF @Estado<>'LISTO' THROW 51001,N'Solo se factura una orden lista.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'FACTURAR')=0 THROW 51002,N'Usuario sin permiso de facturacion.',1;
  IF EXISTS(SELECT 1 FROM dbo.Factura WITH(UPDLOCK,HOLDLOCK) WHERE IdOrden=@IdOrden) THROW 51003,N'La orden ya tiene factura.',1;
  IF @PorcentajeImpuesto IS NULL OR @PorcentajeImpuesto NOT BETWEEN 0 AND 100 THROW 51004,N'Impuesto no valido.',1;
  IF EXISTS(SELECT 1 FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE d.IdOrden=@IdOrden AND r.Estado='EN_PROCESO') THROW 50105,N'Existen reparaciones en proceso.',1;
  SET @MO=dbo.fn_TotalManoObraOrden(@IdOrden); SET @Rep=dbo.fn_TotalRepuestosOrden(@IdOrden);
  IF @MO+@Rep=0 THROW 51005,N'No existen conceptos facturables.',1;
  SET @N=NEXT VALUE FOR dbo.seq_NumeroFactura;
  SET @Numero='FAC-'+CONVERT(VARCHAR(4),YEAR(SYSUTCDATETIME()))+'-'+CASE WHEN @N<1000000 THEN RIGHT('000000'+CONVERT(VARCHAR(10),@N),6) ELSE CONVERT(VARCHAR(10),@N) END;
  INSERT dbo.Factura(NumeroFactura,IdOrden,IdUsuario,NITFacturacion,NombreFacturacion,DireccionFacturacion,SubtotalManoObra,SubtotalRepuestos,PorcentajeImpuesto)
   SELECT @Numero,@IdOrden,@IdUsuario,ISNULL(@NITFacturacion,NIT),ISNULL(@NombreFacturacion,NombreMostrar),ISNULL(@DireccionFacturacion,Direccion),@MO,@Rep,@PorcentajeImpuesto
   FROM dbo.Cliente WHERE IdCliente=@Cliente;
  SET @IdFactura=CONVERT(INT,SCOPE_IDENTITY());
  INSERT dbo.DetalleFactura(IdFactura,TipoLinea,IdReparacion,Descripcion,Cantidad,PrecioUnitario)
   SELECT @IdFactura,'MANO_OBRA',r.IdReparacion,LEFT('Mano de obra: '+r.Descripcion,250),1,r.CostoManoObra
   FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE d.IdOrden=@IdOrden AND r.Estado='FINALIZADA';
  INSERT dbo.DetalleFactura(IdFactura,TipoLinea,IdRepuestoReparacion,Descripcion,Cantidad,PrecioUnitario)
   SELECT @IdFactura,'REPUESTO',rr.IdRepuestoReparacion,LEFT('Repuesto: '+rp.Codigo+' '+rp.Nombre,250),rr.Cantidad,rr.PrecioVentaUnitario
   FROM dbo.RepuestoReparacion rr JOIN dbo.Reparacion r ON r.IdReparacion=rr.IdReparacion
   JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico JOIN dbo.Repuesto rp ON rp.IdRepuesto=rr.IdRepuesto
   WHERE d.IdOrden=@IdOrden AND r.Estado<>'CANCELADA' AND rr.Estado='ACTIVO';
  IF (SELECT ISNULL(SUM(Subtotal),0) FROM dbo.DetalleFactura WHERE IdFactura=@IdFactura)<>@MO+@Rep
   THROW 51006,N'La cabecera no coincide con el detalle.',1;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarPago
 @IdFactura INT,@IdMetodoPago INT,@Monto DECIMAL(12,2),@IdUsuario INT,@Referencia VARCHAR(60)=NULL,@IdPago INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Orden INT,@Bloqueo INT,@Estado VARCHAR(10),@Saldo DECIMAL(12,2);
  IF @Monto IS NULL OR @Monto<=0 THROW 51100,N'Monto no valido.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'PAGOS_REGISTRAR')=0 THROW 51101,N'Usuario sin permiso de pago.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.MetodoPago WHERE IdMetodoPago=@IdMetodoPago AND Activo=1) THROW 51102,N'Metodo no disponible.',1;
  SELECT @Orden=IdOrden FROM dbo.Factura WHERE IdFactura=@IdFactura;
  IF @Orden IS NULL THROW 51103,N'La factura no existe.',1;
  SELECT @Bloqueo=IdOrden FROM dbo.OrdenServicio WITH(UPDLOCK,HOLDLOCK) WHERE IdOrden=@Orden;
  SELECT @Estado=Estado FROM dbo.Factura WITH(UPDLOCK,HOLDLOCK) WHERE IdFactura=@IdFactura;
  IF @Estado<>'EMITIDA' THROW 51104,N'La factura no admite pagos.',1;
  SET @Saldo=dbo.fn_SaldoFactura(@IdFactura);
  IF @Monto>@Saldo THROW 51105,N'El pago excede el saldo pendiente.',1;
  INSERT dbo.Pago(IdFactura,IdMetodoPago,Monto,Referencia,IdUsuario) VALUES(@IdFactura,@IdMetodoPago,@Monto,@Referencia,@IdUsuario);
  SET @IdPago=CONVERT(INT,SCOPE_IDENTITY());
  -- El trigger valida el total y sincroniza EMITIDA/PAGADA en la misma transaccion.
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_AnularPago @IdPago INT,@IdUsuario INT,@Motivo VARCHAR(300)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Factura INT,@Orden INT,@EstadoOrden VARCHAR(30),@EstadoFactura VARCHAR(10),@EstadoPago VARCHAR(10);
  IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo)))=0 THROW 51200,N'Indicar motivo de anulacion.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'PAGOS_REGISTRAR')=0 THROW 51201,N'Usuario sin permiso de anulacion.',1;
  SELECT @Factura=p.IdFactura,@Orden=f.IdOrden FROM dbo.Pago p JOIN dbo.Factura f ON f.IdFactura=p.IdFactura WHERE p.IdPago=@IdPago;
  IF @Factura IS NULL THROW 51202,N'El pago no existe.',1;
  SELECT @EstadoOrden=e.Codigo FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK) JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@Orden;
  SELECT @EstadoFactura=Estado FROM dbo.Factura WITH(UPDLOCK,HOLDLOCK) WHERE IdFactura=@Factura;
  SELECT @EstadoPago=Estado FROM dbo.Pago WITH(UPDLOCK,HOLDLOCK) WHERE IdPago=@IdPago;
  IF @EstadoPago<>'APLICADO' THROW 51203,N'El pago ya fue anulado.',1;
  IF @EstadoFactura='ANULADA' THROW 51204,N'La factura esta anulada.',1;
  IF @EstadoOrden='ENTREGADO' THROW 51205,N'No anular pagos despues de entregar.',1;
  UPDATE dbo.Pago SET Estado='ANULADO',MotivoAnulacion=@Motivo WHERE IdPago=@IdPago;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_EntregarOrden
 @IdOrden INT,@IdUsuarioEntrega INT,@NombreRecibe VARCHAR(150),@DocumentoRecibe VARCHAR(30)=NULL,@Observaciones VARCHAR(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Estado VARCHAR(30),@Factura INT;
  SELECT @Estado=e.Codigo FROM dbo.OrdenServicio o WITH(UPDLOCK,HOLDLOCK) JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=o.IdEstadoOrden WHERE o.IdOrden=@IdOrden;
  IF @Estado IS NULL THROW 51300,N'La orden no existe.',1;
  IF @Estado<>'LISTO' THROW 51301,N'Solo se entrega una orden lista.',1;
  IF @NombreRecibe IS NULL OR LEN(LTRIM(RTRIM(@NombreRecibe)))=0 THROW 51302,N'Indicar quien recibe.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuarioEntrega,'ENTREGAR_ORDEN')=0 THROW 51303,N'Usuario sin permiso de entrega.',1;
  SELECT @Factura=IdFactura FROM dbo.Factura WITH(UPDLOCK,HOLDLOCK) WHERE IdOrden=@IdOrden AND Estado<>'ANULADA';
  IF @Factura IS NULL THROW 50108,N'Falta factura vigente.',1;
  IF dbo.fn_SaldoFactura(@Factura)<>0 THROW 50109,N'La factura tiene saldo pendiente.',1;
  INSERT dbo.Entrega(IdOrden,IdUsuarioEntrega,NombreRecibe,DocumentoRecibe,Observaciones)
   VALUES(@IdOrden,@IdUsuarioEntrega,@NombreRecibe,@DocumentoRecibe,@Observaciones);
  EXEC dbo.sp_CambiarEstadoOrden @IdOrden,'ENTREGADO',@IdUsuarioEntrega,'Equipo entregado';
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_RegistrarActividad
 @IdReparacion INT,@IdTecnico INT,@Descripcion VARCHAR(500),@HorasInvertidas DECIMAL(5,2),@IdActividad INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  DECLARE @Orden INT,@Bloqueo INT;
  SELECT @Orden=d.IdOrden FROM dbo.Reparacion r JOIN dbo.Diagnostico d ON d.IdDiagnostico=r.IdDiagnostico WHERE r.IdReparacion=@IdReparacion;
  IF @Orden IS NULL THROW 51400,N'Reparacion inexistente.',1;
  SELECT @Bloqueo=IdOrden FROM dbo.OrdenServicio WITH(UPDLOCK,HOLDLOCK) WHERE IdOrden=@Orden;
  IF dbo.fn_UsuarioTieneRol(@IdTecnico,'TECNICO')=0 OR dbo.fn_UsuarioTienePermiso(@IdTecnico,'REPARACION_GESTIONAR')=0 THROW 51401,N'Se requiere tecnico activo autorizado.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Reparacion WITH(UPDLOCK,HOLDLOCK) WHERE IdReparacion=@IdReparacion AND Estado='EN_PROCESO') THROW 51402,N'Reparacion cerrada.',1;
  IF @Descripcion IS NULL OR LEN(LTRIM(RTRIM(@Descripcion)))=0 OR @HorasInvertidas IS NULL OR @HorasInvertidas<=0 THROW 51403,N'Actividad no valida.',1;
  INSERT dbo.ActividadReparacion(IdReparacion,IdTecnico,Descripcion,HorasInvertidas) VALUES(@IdReparacion,@IdTecnico,@Descripcion,@HorasInvertidas);
  SET @IdActividad=CONVERT(INT,SCOPE_IDENTITY());
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_CambiarStockMinimo @IdBodega INT,@IdRepuesto INT,@StockMinimo INT,@IdUsuario INT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END;
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  IF @StockMinimo IS NULL OR @StockMinimo<0 THROW 51500,N'Minimo no valido.',1;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'INVENTARIO_GESTIONAR')=0 THROW 51501,N'Usuario sin permiso de inventario.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Bodega WITH(UPDLOCK,HOLDLOCK) WHERE IdBodega=@IdBodega AND Estado='ACTIVA') THROW 51502,N'Bodega no disponible.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Repuesto WHERE IdRepuesto=@IdRepuesto AND Estado='ACTIVO') THROW 51503,N'Repuesto no disponible.',1;
  IF EXISTS(SELECT 1 FROM dbo.InventarioBodega WITH(UPDLOCK,HOLDLOCK) WHERE IdBodega=@IdBodega AND IdRepuesto=@IdRepuesto)
   UPDATE dbo.InventarioBodega SET StockMinimo=@StockMinimo WHERE IdBodega=@IdBodega AND IdRepuesto=@IdRepuesto;
  ELSE INSERT dbo.InventarioBodega(IdBodega,IdRepuesto,Existencia,StockMinimo) VALUES(@IdBodega,@IdRepuesto,0,@StockMinimo);
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ActualizarPreciosRepuesto
 @IdRepuesto INT,@PrecioCompraReferencia DECIMAL(12,2),@PrecioVenta DECIMAL(12,2),@IdUsuario INT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Propia BIT=CASE WHEN @@TRANCOUNT=0 THEN 1 ELSE 0 END,@Anterior SQL_VARIANT=SESSION_CONTEXT(N'IdUsuarioApp');
 BEGIN TRY
  IF @Propia=1 BEGIN TRANSACTION;
  IF dbo.fn_UsuarioTienePermiso(@IdUsuario,'INVENTARIO_GESTIONAR')=0 THROW 51600,N'Usuario sin permiso de precios.',1;
  IF @PrecioCompraReferencia IS NULL OR @PrecioVenta IS NULL OR @PrecioCompraReferencia<0 OR @PrecioVenta<0 THROW 51601,N'Precios no validos.',1;
  EXEC sys.sp_set_session_context @key=N'IdUsuarioApp',@value=@IdUsuario;
  UPDATE dbo.Repuesto SET PrecioCompraReferencia=@PrecioCompraReferencia,PrecioVenta=@PrecioVenta WHERE IdRepuesto=@IdRepuesto;
  IF @@ROWCOUNT=0 THROW 51602,N'El repuesto no existe.',1;
  EXEC sys.sp_set_session_context @key=N'IdUsuarioApp',@value=@Anterior;
  IF @Propia=1 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  EXEC sys.sp_set_session_context @key=N'IdUsuarioApp',@value=@Anterior;
  IF @Propia=1 AND @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO

/* ===== fases/08_triggers.sql ===== */
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

/* ===== fases/09_reportes.sql ===== */
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
 SELECT YEAR(f.FechaFactura) AS Anio,MONTH(f.FechaFactura) AS Mes,COUNT_BIG(*) AS CantidadFacturas,
  SUM(f.SubtotalManoObra) AS TotalManoObra,SUM(f.SubtotalRepuestos) AS TotalRepuestos,
  SUM(f.Subtotal) AS Subtotal,SUM(f.Impuesto) AS Impuesto,SUM(f.Total) AS Total
 INTO #Filas
 FROM dbo.Factura f JOIN dbo.OrdenServicio o ON o.IdOrden=f.IdOrden JOIN dbo.Equipo e ON e.IdEquipo=o.IdEquipo
 JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente WHERE f.Estado<>'ANULADA'
  AND (@IdCliente IS NULL OR c.IdCliente=@IdCliente) AND (@Desde IS NULL OR f.FechaFactura>=@Desde)
  AND (@HastaExclusiva IS NULL OR f.FechaFactura<@HastaExclusiva)
 GROUP BY YEAR(f.FechaFactura),MONTH(f.FechaFactura);
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

/* ===== fases/10_permisos.sql ===== */
/* FASE 10. Roles de motor, distintos a Rol/UsuarioRol de la app.
   No crea usuarios, logins ni secretos. Wilson asigna miembros por separado.
   Un solo dbo: permisos por objeto, no EXECUTE/SELECT sobre el esquema completo. */
IF DATABASE_PRINCIPAL_ID(N'tc_runtime') IS NULL EXEC(N'CREATE ROLE tc_runtime AUTHORIZATION dbo;');
IF DATABASE_PRINCIPAL_ID(N'tc_lectura') IS NULL EXEC(N'CREATE ROLE tc_lectura AUTHORIZATION dbo;');
GO
GRANT EXECUTE ON OBJECT::dbo.sp_CambiarEstadoOrden TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RegistrarOrdenServicio TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RegistrarDiagnostico TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_IniciarReparacion TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_FinalizarReparacion TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_AsignarRepuestoReparacion TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RegistrarCompra TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RecibirCompra TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_AjustarInventario TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_GenerarFactura TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_RegistrarPago TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_AnularPago TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.sp_EntregarOrden TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.usp_RegistrarActividad TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.usp_CambiarStockMinimo TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.usp_ActualizarPreciosRepuesto TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_UsuarioTieneRol TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_UsuarioTienePermiso TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_SaldoFactura TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_TotalManoObraOrden TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_TotalRepuestosOrden TO tc_runtime;
GRANT EXECUTE ON OBJECT::dbo.fn_TotalOrden TO tc_runtime;
GRANT EXECUTE ON TYPE::dbo.tvp_DetalleCompra TO tc_runtime;
GRANT REFERENCES ON TYPE::dbo.tvp_DetalleCompra TO tc_runtime;

GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Usuario TO tc_runtime;
GRANT SELECT,INSERT,DELETE ON OBJECT::dbo.UsuarioRol TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.Rol TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.Permiso TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.RolPermiso TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Cliente TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Equipo TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.TipoEquipo TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Marca TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.CategoriaRepuesto TO tc_runtime;
GRANT SELECT,INSERT ON OBJECT::dbo.Repuesto TO tc_runtime;
GRANT UPDATE(Nombre,Descripcion,IdCategoria,Estado) ON OBJECT::dbo.Repuesto TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Bodega TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.Proveedor TO tc_runtime;
GRANT SELECT,INSERT,UPDATE ON OBJECT::dbo.MetodoPago TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.Prioridad TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.EstadoOrden TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.TipoMovimiento TO tc_runtime;

-- Lecturas seguras. Las vistas normalizadas exponen IDs derivados para la API.
GRANT SELECT ON OBJECT::dbo.vw_Ordenes TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Diagnosticos TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Reparaciones TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Actividades TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Consumos TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_HistorialEstadoOrden TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_InventarioActual TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Compras TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_DetalleCompra TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Facturas TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_FacturaSaldo TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_DetalleFactura TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Pagos TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_Entregas TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_OrdenesActivas TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_MovimientosInventario TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_TrazabilidadOrden TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_IngresosFacturadosMensual TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_DashboardResumen TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.vw_ActividadReciente TO tc_runtime;
GRANT SELECT ON OBJECT::dbo.fn_HistorialEquipo TO tc_runtime;

-- Un rol comun de reportes puede asignarse tambien al runtime.
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteOrdenesActivas TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteHistorialCliente TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteHistorialEquipo TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteActividadTecnico TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteRepuestosUtilizados TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteInventario TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteBajoMinimo TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteComprasProveedor TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteMovimientos TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteFacturasSaldo TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteIngresos TO tc_lectura;
GRANT EXECUTE ON OBJECT::dbo.usp_ReporteTrazabilidad TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_OrdenesActivas TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_InventarioActual TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_FacturaSaldo TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_MovimientosInventario TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_TrazabilidadOrden TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_IngresosFacturadosMensual TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_DashboardResumen TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.vw_ActividadReciente TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.fn_HistorialEquipo TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.TipoEquipo TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.Marca TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.Prioridad TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.EstadoOrden TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.CategoriaRepuesto TO tc_lectura;
GRANT SELECT ON OBJECT::dbo.Bodega TO tc_lectura;
ALTER ROLE tc_lectura ADD MEMBER tc_runtime;

DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.OrdenServicio TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.HistorialEstadoOrden TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Diagnostico TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Reparacion TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.ActividadReparacion TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.InventarioBodega TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.RepuestoReparacion TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.MovimientoInventario TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Compra TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.DetalleCompra TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Factura TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.DetalleFactura TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Pago TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.Entrega TO tc_runtime;
DENY INSERT,UPDATE,DELETE ON OBJECT::dbo.AuditoriaPrecioRepuesto TO tc_runtime;
GO

/* ===== fases/11_verificacion.sql ===== */
/* FASE 11. Solo verificacion estructural. No es evidencia de T01-T14.
   No hay usuarios ni datos de demostracion: se preparan en una tarea separada. */
IF COL_LENGTH(N'dbo.OrdenServicio',N'IdCliente') IS NOT NULL
    THROW 51800,N'La orden aun contiene la dependencia transitiva IdCliente.',1;
IF COL_LENGTH(N'dbo.Reparacion',N'IdOrden') IS NOT NULL
    THROW 51801,N'La reparacion aun contiene la dependencia transitiva IdOrden.',1;
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo'))<>33
    THROW 51802,N'No se crearon las 33 tablas previstas.',1;
IF EXISTS(SELECT 1 FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
    THROW 51803,N'Hay FK deshabilitadas o no confiables.',1;
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1)
    THROW 51804,N'Hay CHECK deshabilitados o no confiables.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Rol r JOIN dbo.RolPermiso rp ON rp.IdRol=r.IdRol JOIN dbo.Permiso p ON p.IdPermiso=rp.IdPermiso
    WHERE r.Codigo='CAJA' AND p.Codigo='ENTREGAR_ORDEN')
    THROW 51805,N'Falta el permiso de entrega de Caja.',1;
SELECT N'Tablas' AS Objeto,COUNT(*) AS Cantidad FROM sys.tables WHERE is_ms_shipped=0
UNION ALL SELECT N'FK',COUNT(*) FROM sys.foreign_keys
UNION ALL SELECT N'UNIQUE',COUNT(*) FROM sys.key_constraints WHERE type='UQ'
UNION ALL SELECT N'CHECK',COUNT(*) FROM sys.check_constraints
UNION ALL SELECT N'DEFAULT',COUNT(*) FROM sys.default_constraints
UNION ALL SELECT N'Vistas',COUNT(*) FROM sys.views WHERE is_ms_shipped=0
UNION ALL SELECT N'Funciones',COUNT(*) FROM sys.objects WHERE type IN('FN','IF','TF') AND is_ms_shipped=0
UNION ALL SELECT N'Procedimientos',COUNT(*) FROM sys.procedures WHERE is_ms_shipped=0
UNION ALL SELECT N'Triggers',COUNT(*) FROM sys.triggers WHERE parent_class=1 AND is_ms_shipped=0;
SELECT SCHEMA_NAME(schema_id) AS Esquema,name AS Tabla FROM sys.tables WHERE is_ms_shipped=0 ORDER BY name;
PRINT N'Estructura creada. Faltan las pruebas funcionales, concurrencia y datos de demostracion.';
GO
