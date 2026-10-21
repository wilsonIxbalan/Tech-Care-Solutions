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
