/* DATOS SEMILLA 02 · maestros .
   Requiere: construccion SQL v1 + usuarios_semilla.sql ya ejecutados.
   Crea: 3 bodegas, 8 proveedores, 30 repuestos, 30 clientes, 45 equipos y
   2 usuarios para SEC-01 (sin rol e inactivo).
   No se ejecuta dos veces (se detiene si ya hay datos). No toca constraints. */
USE TechCareDB;
GO
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

IF (SELECT COUNT(*) FROM dbo.Usuario) < 10
    THROW 59001, N'Falta ejecutar usuarios_semilla.sql (se esperan 10 usuarios).', 1;
IF EXISTS(SELECT 1 FROM dbo.Cliente) OR EXISTS(SELECT 1 FROM dbo.Bodega) OR EXISTS(SELECT 1 FROM dbo.Repuesto)
    THROW 59002, N'Los maestros ya tienen datos; este script no se ejecuta dos veces.', 1;

BEGIN TRANSACTION;

/* ---- Usuarios SEC-01. Misma clave que caja2 (hash Argon2id copiado). ---- */
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email,Activo)
VALUES
 ('sinrol1','$argon2id$v=19$m=65536,p=4,t=3$Eaa3Og5FdEh0YGTEpA5h9g$pg219lIDa7wD2cqau8ScpMyEXqUd/uG2vCzmCfDGi7U','Usuario Sin Rol Prueba','sinrol1@techcare.test',1),
 ('inactivo1','$argon2id$v=19$m=65536,p=4,t=3$Eaa3Og5FdEh0YGTEpA5h9g$pg219lIDa7wD2cqau8ScpMyEXqUd/uG2vCzmCfDGi7U','Usuario Inactivo Prueba','inactivo1@techcare.test',0);
-- sinrol1 queda sin fila en UsuarioRol a proposito. inactivo1 tiene rol pero Activo=0.
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='RECEPCION' WHERE u.NombreUsuario='inactivo1';

/* ---- Bodegas ---- */
INSERT dbo.Bodega(Codigo,Nombre,Ubicacion) VALUES
 ('BOD-01','Bodega Principal','Zona 1, estante A'),
 ('BOD-02','Bodega Taller','Area de taller'),
 ('BOD-03','Bodega Reserva','Almacen de reserva');

/* ---- Proveedores ---- */
INSERT dbo.Proveedor(NIT,Nombre,NombreContacto,Telefono,Email,Direccion) VALUES
 ('1100234-5','Tecnologia y Partes, S.A.','Mario Estrada','22345601','ventas@tecpartes.test','Zona 4, Guatemala'),
 ('2200345-6','Importadora Central de Repuestos','Rosa Menchu','22345602','contacto@importcentral.test','Zona 9, Guatemala'),
 ('3300456-7','Compu Mayoreo Guatemala','Julio Arevalo','22345603','pedidos@compumayoreo.test','Zona 12, Guatemala'),
 ('4400567-8','Redes y Conectividad, S.A.','Elena Quinonez','22345604','ventas@redesyconect.test','Zona 10, Guatemala'),
 ('5500678-9','Suministros de Impresion GT','Marvin Lopez','22345605','info@suministrosgt.test','Zona 11, Guatemala'),
 ('6600789-1','Energia Portatil, S.A.','Cecilia Rivas','22345606','ventas@energiaportatil.test','Mixco, Guatemala'),
 ('7700890-2','Componentes del Istmo','Byron Tobar','22345607','compras@istmo.test','Zona 7, Guatemala'),
 ('8800901-3','Distribuidora Digital Maya','Ingrid Coc','22345608','ventas@digitalmaya.test','Zona 5, Guatemala');

/* ---- Repuestos (3 por categoria). Precios en quetzales. ---- */
INSERT dbo.Repuesto(IdCategoria,Codigo,Nombre,PrecioCompraReferencia,PrecioVenta)
SELECT c.IdCategoria,v.Codigo,v.Nombre,v.Compra,v.Venta
FROM (VALUES
 ('Almacenamiento','REP-001','SSD SATA 480 GB',310.00,420.00),
 ('Almacenamiento','REP-002','SSD NVMe 512 GB',380.00,520.00),
 ('Almacenamiento','REP-003','Disco duro 1 TB 2.5 pulgadas',280.00,380.00),
 ('Memoria RAM','REP-004','Memoria DDR4 8 GB SODIMM',210.00,300.00),
 ('Memoria RAM','REP-005','Memoria DDR4 16 GB SODIMM',380.00,520.00),
 ('Memoria RAM','REP-006','Memoria DDR4 8 GB DIMM escritorio',200.00,290.00),
 ('Pantallas','REP-007','Pantalla LED 15.6 pulgadas laptop',620.00,850.00),
 ('Pantallas','REP-008','Pantalla LED 14 pulgadas laptop',580.00,800.00),
 ('Pantallas','REP-009','Panel LCD 21.5 pulgadas monitor',540.00,750.00),
 ('Baterias y cargadores','REP-010','Bateria laptop 6 celdas',260.00,380.00),
 ('Baterias y cargadores','REP-011','Cargador universal 65 W',140.00,210.00),
 ('Baterias y cargadores','REP-012','Cargador 90 W',185.00,275.00),
 ('Placas y procesadores','REP-013','Tarjeta madre laptop generica',950.00,1300.00),
 ('Placas y procesadores','REP-014','Procesador Core i5',1250.00,1600.00),
 ('Placas y procesadores','REP-015','Tarjeta de video 4 GB',1400.00,1850.00),
 ('Perifericos','REP-016','Teclado laptop en espanol',150.00,240.00),
 ('Perifericos','REP-017','Teclado USB',80.00,130.00),
 ('Perifericos','REP-018','Mouse inalambrico',45.00,80.00),
 ('Impresion','REP-019','Cartucho de tinta negro',95.00,150.00),
 ('Impresion','REP-020','Cartucho de tinta color',120.00,185.00),
 ('Impresion','REP-021','Rodillo de arrastre',70.00,120.00),
 ('Redes','REP-022','Adaptador WiFi USB',85.00,140.00),
 ('Redes','REP-023','Tarjeta de red PCIe Gigabit',110.00,175.00),
 ('Redes','REP-024','Switch 8 puertos',210.00,320.00),
 ('Refrigeracion','REP-025','Ventilador de CPU',65.00,110.00),
 ('Refrigeracion','REP-026','Ventilador de laptop',75.00,125.00),
 ('Refrigeracion','REP-027','Pasta termica 15 g',25.00,50.00),
 ('Cables y conectores','REP-028','Cable HDMI 1.8 m',30.00,60.00),
 ('Cables y conectores','REP-029','Cable de poder',25.00,45.00),
 ('Cables y conectores','REP-030','Cable SATA',18.00,35.00)
) v(Categoria,Codigo,Nombre,Compra,Venta)
JOIN dbo.CategoriaRepuesto c ON c.Nombre=v.Categoria
ORDER BY v.Codigo;

/* ---- Clientes: 1-20 individuales, 21-30 empresariales. El 30 no tendra equipos ni ordenes. ---- */
;WITH v(n,Tipo,Nombres,Apellidos,Razon) AS (
 SELECT n,Tipo,Nombres,Apellidos,Razon FROM (VALUES
 (1,'INDIVIDUAL','Carlos','Mendez',CAST(NULL AS VARCHAR(150))),
 (2,'INDIVIDUAL','Maria','Lopez',NULL),
 (3,'INDIVIDUAL','Jose','Hernandez',NULL),
 (4,'INDIVIDUAL','Ana','Garcia',NULL),
 (5,'INDIVIDUAL','Luis','Perez',NULL),
 (6,'INDIVIDUAL','Sofia','Ramirez',NULL),
 (7,'INDIVIDUAL','Diego','Castillo',NULL),
 (8,'INDIVIDUAL','Lucia','Morales',NULL),
 (9,'INDIVIDUAL','Pedro','Alvarado',NULL),
 (10,'INDIVIDUAL','Gabriela','Cifuentes',NULL),
 (11,'INDIVIDUAL','Andres','Orellana',NULL),
 (12,'INDIVIDUAL','Karla','Ordonez',NULL),
 (13,'INDIVIDUAL','Fernando','Pineda',NULL),
 (14,'INDIVIDUAL','Daniela','Reyes',NULL),
 (15,'INDIVIDUAL','Ricardo','Solis',NULL),
 (16,'INDIVIDUAL','Paola','Barrios',NULL),
 (17,'INDIVIDUAL','Hector','Duarte',NULL),
 (18,'INDIVIDUAL','Valeria','Lemus',NULL),
 (19,'INDIVIDUAL','Oscar','Montenegro',NULL),
 (20,'INDIVIDUAL','Beatriz','Tzoc',NULL),
 (21,'EMPRESARIAL',NULL,NULL,'Distribuidora La Esperanza, S.A.'),
 (22,'EMPRESARIAL',NULL,NULL,'Clinica Santa Lucia'),
 (23,'EMPRESARIAL',NULL,NULL,'Colegio Horizonte'),
 (24,'EMPRESARIAL',NULL,NULL,'Ferreteria El Constructor'),
 (25,'EMPRESARIAL',NULL,NULL,'Contadores Asociados, S.A.'),
 (26,'EMPRESARIAL',NULL,NULL,'Panaderia Dona Rosa'),
 (27,'EMPRESARIAL',NULL,NULL,'Taller Mecanico Los Andes'),
 (28,'EMPRESARIAL',NULL,NULL,'Agencia de Viajes Quetzal'),
 (29,'EMPRESARIAL',NULL,NULL,'Bufete Juridico Lopez y Asociados'),
 (30,'EMPRESARIAL',NULL,NULL,'Cafe Cumbre Verde, S.A.')
 ) AS x(n,Tipo,Nombres,Apellidos,Razon)
)
INSERT dbo.Cliente(TipoCliente,NIT,Nombres,Apellidos,RazonSocial,NombreContacto,Telefono,Email,Direccion)
SELECT Tipo,
  CASE WHEN Tipo='INDIVIDUAL' AND n%7=0 THEN 'CF' ELSE CONCAT(1000000+n*7919,'-',n%10) END,
  Nombres,Apellidos,Razon,
  CASE WHEN Tipo='EMPRESARIAL' THEN 'Encargado de sistemas' END,
  CONCAT('55',RIGHT(CONCAT('000000',n*7919),6)),
  CONCAT('cliente',n,'@correo.test'),
  CONCAT((n%25)+1,'a. calle ',(n%18)+1,'-',(n%90)+10,', zona ',(n%12)+1,', Guatemala')
FROM v ORDER BY n;

/* ---- Equipos: 45, repartidos entre los clientes 1-29 (el 30 queda sin equipos). ---- */
CREATE TABLE #Cli(rn INT NOT NULL PRIMARY KEY, IdCliente INT NOT NULL);
INSERT #Cli(rn,IdCliente) SELECT CONVERT(INT,ROW_NUMBER() OVER(ORDER BY IdCliente)),IdCliente FROM dbo.Cliente;

;WITH n AS (
  SELECT TOP (45) CONVERT(INT,ROW_NUMBER() OVER(ORDER BY (SELECT NULL))) AS i FROM sys.all_objects
), t AS (
  SELECT i,CHOOSE(i%6+1,'Laptop','Computadora de escritorio','Impresora','Equipo de red','Monitor','Servidor') AS Tipo FROM n
), m AS (
  SELECT i,Tipo,
   CASE Tipo
    WHEN 'Laptop' THEN CHOOSE(i%6+1,'HP','Dell','Lenovo','Asus','Acer','Apple')
    WHEN 'Computadora de escritorio' THEN CHOOSE(i%4+1,'HP','Dell','Lenovo','Acer')
    WHEN 'Impresora' THEN CHOOSE(i%4+1,'Epson','Canon','Brother','HP')
    WHEN 'Equipo de red' THEN CHOOSE(i%2+1,'Cisco','TP-Link')
    WHEN 'Monitor' THEN CHOOSE(i%3+1,'Samsung','LG','Dell')
    ELSE CHOOSE(i%3+1,'Dell','HP','Lenovo') END AS Marca
  FROM t
)
INSERT dbo.Equipo(IdCliente,IdTipoEquipo,IdMarca,Modelo,NumeroSerie,Descripcion)
SELECT c.IdCliente,te.IdTipoEquipo,ma.IdMarca,
  CONCAT(LEFT(m.Tipo,3),'-',100+m.i*3),
  CONCAT('TC-SN-',RIGHT(CONCAT('0000',m.i),4)),
  CONCAT(m.Tipo,' ',m.Marca,' de uso diario (dato de prueba)')
FROM m
JOIN #Cli c ON c.rn=((m.i-1)%29)+1
JOIN dbo.TipoEquipo te ON te.Nombre=m.Tipo
JOIN dbo.Marca ma ON ma.Nombre=m.Marca
ORDER BY m.i;

DROP TABLE #Cli;
COMMIT TRANSACTION;

SELECT N'Usuarios' AS Tabla,COUNT(*) AS Filas FROM dbo.Usuario
UNION ALL SELECT N'Bodegas',COUNT(*) FROM dbo.Bodega
UNION ALL SELECT N'Proveedores',COUNT(*) FROM dbo.Proveedor
UNION ALL SELECT N'Repuestos',COUNT(*) FROM dbo.Repuesto
UNION ALL SELECT N'Clientes',COUNT(*) FROM dbo.Cliente
UNION ALL SELECT N'Equipos',COUNT(*) FROM dbo.Equipo;
GO
