/* RL26: escenarios adicionales FICTICIOS para demostracion, no datos reales.
   Independiente de SEM26: NO lo elimina, renombra ni modifica. No ejecutar el
   maestro, bootstrap o SEM26 otra vez. No ejecutado por la implementacion.
   Solo en BD de pruebas, con respaldo y sin otras escrituras durante la carga.
   Ejecutar TODO el lote; una transaccion revierte la carga si ocurre un error.
   IDENTITY/SEQUENCE pueden dejar saltos aun cuando se haga rollback.

   Primero crear desde la web, como administrador, los cuatro usuarios abajo
   con sus roles. Usar passwords privados distintos; este script NO crea usuarios
   ni contiene passwords/hashes. Si usas otros nombres, cambiar SOLO estas cuatro
   variables en una copia privada. El administrador existente no se modifica.

   Contactos, empresas, telefonos, direcciones, precios y series son ficticios.
   Correos example.invalid y telefonos 0000 son deliberadamente no operativos.
   No son identidades fiscales ni facturas certificadas. No contactar a nadie.
   Los ingresos se importan con fechas pasadas; diagnostico, compras, movimientos,
   facturas, pagos y entregas llevan la fecha REAL de carga. No falsificar eventos.

   Agrega 12 clientes, 24 equipos, 24 ordenes en los siete estados, 19 diagnosticos,
   14 reparaciones, 18 repuestos, 3 bodegas, 54 existencias, 6 proveedores,
   12 compras (9 recibidas/3 pendientes), 73 movimientos, 8 facturas,
   13 pagos y 6 entregas. Deja 2 ordenes LISTO SIN FACTURA para probar caja,
   trabajos en proceso, equipos sin diagnostico y clientes sin ordenes.
   Los identificadores RL26 solo marcan el conjunto; los nombres son descriptivos.
   Reejecutar se rechaza; no limpiar historia con DELETE para repetir pruebas. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;
SET NOCOUNT ON;

DECLARE @ConfirmarCarga BIT=0;
DECLARE @UsuarioRecepcion VARCHAR(50)='lucia.morales';
DECLARE @UsuarioTecnico VARCHAR(50)='diego.salazar';
DECLARE @UsuarioBodega VARCHAR(50)='paola.castillo';
DECLARE @UsuarioCaja VARCHAR(50)='andres.fuentes';
IF @ConfirmarCarga<>1 THROW 53100,N'Revisar instrucciones y confirmar la carga solo en pruebas.',1;
IF DB_NAME()<>N'TechCareDB' THROW 53101,N'Conectar expresamente a TechCareDB de pruebas.',1;
IF @@TRANCOUNT<>0 THROW 53102,N'Finalizar la transaccion existente antes de cargar.',1;
IF (@@OPTIONS & 2)=2 THROW 53102,N'Ejecutar con transacciones implicitas desactivadas y sin una transaccion previa.',1;

SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @Lock INT;
 EXEC @Lock=sys.sp_getapplock @Resource=N'TechCare.Semilla.RL26',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
 IF @Lock<0 THROW 53103,N'Otra carga RL26 esta en curso.',1;
 DECLARE @Recepcion INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario=@UsuarioRecepcion AND Activo=1),
  @Tecnico INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario=@UsuarioTecnico AND Activo=1),
  @BodegaUsuario INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario=@UsuarioBodega AND Activo=1),
  @Caja INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario=@UsuarioCaja AND Activo=1);
 IF @Recepcion IS NULL OR @Tecnico IS NULL OR @BodegaUsuario IS NULL OR @Caja IS NULL
  THROW 53104,N'Crear primero los cuatro usuarios activos desde Usuarios y roles, o indicar sus nombres correctos.',1;
 IF dbo.fn_UsuarioTieneRol(@Recepcion,'RECEPCION')=0 OR dbo.fn_UsuarioTieneRol(@Tecnico,'TECNICO')=0
    OR dbo.fn_UsuarioTieneRol(@BodegaUsuario,'BODEGA')=0 OR dbo.fn_UsuarioTieneRol(@Caja,'CAJA')=0
  THROW 53105,N'Asignar los roles RECEPCION, TECNICO, BODEGA y CAJA a los actores elegidos.',1;
 IF EXISTS(SELECT 1 FROM dbo.Cliente WHERE Email LIKE 'rl26.%')
    OR EXISTS(SELECT 1 FROM dbo.Equipo WHERE NumeroSerie LIKE 'RL26-%')
    OR EXISTS(SELECT 1 FROM dbo.Repuesto WHERE Codigo LIKE 'RL26-%')
    OR EXISTS(SELECT 1 FROM dbo.Bodega WHERE Codigo LIKE 'RL26-%')
    OR EXISTS(SELECT 1 FROM dbo.Proveedor WHERE NIT LIKE 'RL26-%')
    OR EXISTS(SELECT 1 FROM dbo.OrdenServicio WHERE NumeroOrden LIKE 'RL26-%')
  THROW 53106,N'Este conjunto ya existe. No se agrega ni se elimina nada.',1;

 DECLARE @ClientesOrigen TABLE(N INT PRIMARY KEY,Nombres VARCHAR(100),Apellidos VARCHAR(100),Empresa VARCHAR(150),Contacto VARCHAR(120),Direccion VARCHAR(250));
 INSERT @ClientesOrigen VALUES
  (1,'Mariana','López Cabrera',NULL,NULL,'Sector residencial ficticio, zona 7, ciudad de Guatemala'),
  (2,'Carlos','Méndez Rojas',NULL,NULL,'Colonia de demostracion, zona 11, ciudad de Guatemala'),
  (3,NULL,NULL,'Estudio Arce Diseño','Sofía Arce','Oficina ficticia de diseno, zona 10, ciudad de Guatemala'),
  (4,'Ana Lucía','Rivas Molina',NULL,NULL,'Residencial ilustrativo, Mixco, Guatemala'),
  (5,NULL,NULL,'Clínica Horizonte Integral','Gabriela León','Consultorio de demostracion, zona 12, ciudad de Guatemala'),
  (6,'Jorge','Castillo Perez',NULL,NULL,'Sector ficticio de vivienda, Villa Nueva, Guatemala'),
  (7,NULL,NULL,'Comercial Las Jacarandas','Roberto Sandoval','Local comercial ilustrativo, zona 1, ciudad de Guatemala'),
  (8,'Valeria','Hernández Soto',NULL,NULL,'Colonia de demostracion, zona 16, ciudad de Guatemala'),
  (9,NULL,NULL,'Academia Puente Digital','Elena Rosales','Centro educativo ficticio, San Miguel Petapa, Guatemala'),
  (10,'Luis Fernando','Aguilar Reyes',NULL,NULL,'Sector ilustrativo, Santa Catarina Pinula, Guatemala'),
  (11,'Daniela','Cortés Alvarado',NULL,NULL,'Residencial de demostracion, zona 18, ciudad de Guatemala'),
  (12,'Esteban','Paz Velásquez',NULL,NULL,'Direccion ficticia para registro de un cliente sin servicios');
 DECLARE @Clientes TABLE(N INT PRIMARY KEY,Id INT NOT NULL);
 DECLARE @Equipos TABLE(N INT PRIMARY KEY,Id INT NOT NULL);
 DECLARE @Repuestos TABLE(N INT PRIMARY KEY,Id INT NOT NULL);
 DECLARE @Bodegas TABLE(N INT PRIMARY KEY,Id INT NOT NULL);
 DECLARE @Proveedores TABLE(N INT PRIMARY KEY,Id INT NOT NULL);
 DECLARE @Compras TABLE(N INT PRIMARY KEY,Id INT NOT NULL);
 DECLARE @Ordenes TABLE(N INT PRIMARY KEY,Id INT NOT NULL);
 DECLARE @Reparaciones TABLE(N INT PRIMARY KEY,Id INT NOT NULL);
 DECLARE @Facturas TABLE(N INT PRIMARY KEY,Id INT NOT NULL,Total DECIMAL(12,2));

 DECLARE @EquiposOrigen TABLE(N INT PRIMARY KEY,Cliente INT,Tipo VARCHAR(60),Marca VARCHAR(60),Modelo VARCHAR(80),Descripcion VARCHAR(300));
 INSERT @EquiposOrigen VALUES
  (1,1,'Laptop','HP','ProBook 450 G8','Laptop de trabajo con disco y memoria actualizables'),
  (2,2,'Laptop','Dell','Latitude 5420','Equipo portatil para trabajo administrativo'),
  (3,3,'Impresora','Epson','EcoTank L3250','Impresora de documentos y material de diseno'),
  (4,4,'Equipo de red','TP-Link','Archer C6','Router domestico de doble banda'),
  (5,5,'Computadora de escritorio','Lenovo','ThinkCentre M720','Computadora administrativa del consultorio'),
  (6,6,'Laptop','Asus','VivoBook X515','Laptop de uso personal y estudio'),
  (7,7,'Laptop','Acer','Aspire 5 A515','Laptop del punto de venta'),
  (8,8,'Impresora','Brother','HL-L2350DW','Impresora laser monocromatica'),
  (9,9,'Computadora de escritorio','Dell','OptiPlex 7080','Estacion del laboratorio de computacion'),
  (10,10,'Laptop','Lenovo','IdeaPad 3 15ITL6','Laptop para clases y videoconferencias'),
  (11,11,'Impresora','HP','LaserJet Pro M404','Impresora de oficina con conexion USB'),
  (12,3,'Computadora de escritorio','Dell','OptiPlex 5060','Equipo de apoyo del estudio de diseno'),
  (13,5,'Laptop','Lenovo','Legion 5 15ACH6','Equipo de trabajo grafico del consultorio'),
  (14,7,'Laptop','HP','ProBook 440 G7','Equipo administrativo con mantenimiento pendiente'),
  (15,9,'Laptop','Dell','Inspiron 3501','Laptop docente para evaluacion inicial'),
  (16,1,'Impresora','Canon','PIXMA G3110','Impresora familiar con falla por diagnosticar'),
  (17,2,'Equipo de red','Cisco','RV340','Router de oficina pendiente de autorizacion'),
  (18,4,'Laptop','Acer','Swift 3 SF314','Laptop con falla intermitente de encendido'),
  (19,6,'Monitor','Samsung','F24T350','Monitor de escritorio con imagen intermitente'),
  (20,8,'Laptop','Apple','MacBook Air A1466','Equipo recibido para evaluacion de bateria'),
  (21,10,'Impresora','Epson','EcoTank L3150','Impresora en cola de diagnostico'),
  (22,11,'Laptop','HP','Pavilion 15-eg','Laptop recien recibida por ruido de ventilacion'),
  (23,9,'Equipo de red','TP-Link','TL-SG108','Switch del laboratorio recien recibido'),
  (24,7,'Computadora de escritorio','Lenovo','ThinkCentre M710','Equipo cuya evaluacion fue cancelada por el cliente');

 DECLARE @Piezas TABLE(N INT PRIMARY KEY,Categoria VARCHAR(80),Codigo VARCHAR(30),Nombre VARCHAR(120),Costo DECIMAL(12,2),Venta DECIMAL(12,2));
 INSERT @Piezas VALUES
  (1,'Almacenamiento','RL26-SSD-NV2-500','SSD Kingston NV2 500 GB',220,350),
  (2,'Memoria RAM','RL26-RAM-DDR4-8','Memoria DDR4 SODIMM 8 GB',145,225),
  (3,'Baterias y cargadores','RL26-BAT-LAT5420','Bateria compatible Latitude 5420',300,450),
  (4,'Baterias y cargadores','RL26-AC-DELL65','Cargador compatible Dell 65 W',110,175),
  (5,'Impresion','RL26-ROD-L3250','Rodillo de alimentacion compatible L3250',70,120),
  (6,'Impresion','RL26-KIT-L3250','Kit de almohadillas compatible L3250',55,95),
  (7,'Baterias y cargadores','RL26-AC-12V','Adaptador de corriente 12 V',50,85),
  (8,'Refrigeracion','RL26-FAN-80','Ventilador de gabinete 80 mm',40,70),
  (9,'Refrigeracion','RL26-PASTA-4G','Pasta termica de servicio 4 g',25,45),
  (10,'Perifericos','RL26-KB-X515','Teclado compatible VivoBook X515',160,260),
  (11,'Pantallas','RL26-PANEL-156','Panel FHD compatible de 15.6 pulgadas',480,720),
  (12,'Cables y conectores','RL26-FLEX-A515','Cable flex compatible Aspire A515',90,150),
  (13,'Impresion','RL26-ROD-BROTHER','Rodillo compatible Brother HL-L2350DW',85,140),
  (14,'Baterias y cargadores','RL26-PSU-OPT7080','Fuente compatible OptiPlex 7080',320,480),
  (15,'Cables y conectores','RL26-JACK-IDEAPAD','Conector de carga compatible IdeaPad 3',65,110),
  (16,'Cables y conectores','RL26-USB-M404','Modulo USB compatible LaserJet M404',130,210),
  (17,'Baterias y cargadores','RL26-CMOS-2032','Bateria CMOS CR2032',10,25),
  (18,'Refrigeracion','RL26-FAN-LEGION','Ventilador compatible Legion 5',180,290);
 DECLARE @Escenarios TABLE(N INT PRIMARY KEY,Problema VARCHAR(1000),Diagnostico VARCHAR(1000),Trabajo VARCHAR(1000),ManoObra DECIMAL(12,2),Pieza1 INT,Pieza2 INT);
 INSERT @Escenarios VALUES
  (1,'El inicio tarda varios minutos y las aplicaciones se congelan.','Disco con desgaste y memoria insuficiente para las aplicaciones de trabajo.','Instalacion de SSD, ampliacion de memoria y pruebas de estabilidad.',180,1,2),
  (2,'La bateria no retiene carga y el adaptador se desconecta.','Bateria agotada y cable del cargador con falso contacto.','Cambio de bateria y adaptador; prueba de carga y autonomia.',150,3,4),
  (3,'La impresora toma varias hojas y muestra aviso de mantenimiento.','Rodillo desgastado y almohadillas al final de su vida util.','Cambio de rodillo y almohadillas; limpieza y prueba de alimentacion.',160,5,6),
  (4,'El router se reinicia al conectar varios dispositivos.','Adaptador de corriente inestable bajo carga.','Sustitucion del adaptador y prueba continua de conectividad.',100,7,NULL),
  (5,'La computadora se apaga despues de varios minutos de uso.','Ventilador de gabinete detenido y transferencia termica deficiente.','Cambio de ventilador y pasta termica; prueba de temperatura.',200,8,9),
  (6,'Varias teclas no responden despues de un derrame.','Teclado con dano por liquido; placa principal sin afectacion visible.','Cambio de teclado y verificacion completa de las teclas.',175,10,NULL),
  (7,'La pantalla presenta lineas y pierde imagen al mover la tapa.','Panel danado y cable flex deteriorado en la bisagra.','Cambio de panel y cable flex; prueba de apertura y cierre.',220,11,12),
  (8,'El papel se atasca durante la impresion de documentos.','Rodillo de alimentacion desgastado.','Sustitucion del rodillo y prueba con distintos gramajes.',140,13,NULL),
  (9,'La estacion no enciende y no presenta indicadores luminosos.','Fuente de alimentacion sin voltaje de salida.','Cambio de fuente y prueba de arranque con carga.',180,14,NULL),
  (10,'La laptop solo carga cuando se sostiene el conector en una posicion.','Conector de alimentacion con desgaste mecanico.','Cambio de conector y verificacion de carga estable.',175,15,NULL),
  (11,'La impresora no es reconocida por USB en varios equipos.','Modulo USB con dano fisico en el conector.','Cambio del modulo y pruebas de comunicacion e impresion.',150,16,NULL),
  (12,'La fecha se pierde al desconectar la computadora.','Bateria CMOS agotada; configuracion de firmware se restablece.','Cambio de bateria y revision de configuracion de arranque.',90,17,NULL),
  (13,'La laptop hace ruido y limita el rendimiento al trabajar con graficos.','Ventilador con desgaste de rodamiento.','Sustitucion del ventilador; pruebas termicas aun en proceso.',210,18,NULL),
  (14,'El equipo se calienta y el ventilador trabaja constantemente.','Acumulacion de polvo en conductos de ventilacion.','Limpieza interna y prueba de temperatura en proceso.',160,NULL,NULL),
  (15,'La laptop muestra una pantalla azul de forma intermitente.','Se requiere prueba extendida de memoria y almacenamiento.','Pendiente de autorizacion del cliente.',170,NULL,NULL),
  (16,'Los documentos salen con franjas de color.','Sistema de tinta requiere limpieza y evaluacion de inyectores.','Pendiente de autorizacion del cliente.',150,NULL,NULL),
  (17,'La red pierde conectividad varias veces al dia.','Configuracion de red requiere revision y prueba de carga.','Pendiente de autorizacion del cliente.',190,NULL,NULL),
  (18,'La laptop no siempre enciende al presionar el boton.','Circuito de encendido requiere evaluacion de componentes.','Pendiente de autorizacion del cliente.',200,NULL,NULL),
  (19,'El monitor pierde imagen despues de calentarse.','Posible falla termica de alimentacion; requiere prueba extendida.','Pendiente de autorizacion del cliente.',130,NULL,NULL),
  (20,'La bateria dura menos de una hora.',NULL,NULL,0,NULL,NULL),
  (21,'La impresora muestra luces de error al iniciar.',NULL,NULL,0,NULL,NULL),
  (22,'Se escucha un ruido fuerte al iniciar aplicaciones.',NULL,NULL,0,NULL,NULL),
  (23,'Dos puertos de red no establecen enlace.',NULL,NULL,0,NULL,NULL),
  (24,'El cliente solicita revision, pero luego retira la solicitud.',NULL,NULL,0,NULL,NULL);

 DECLARE @N INT=1,@J INT,@Id INT,@Cliente INT,@Equipo INT,@Categoria INT,@Tipo INT,@Marca INT,@Bodega INT,@Proveedor INT,
  @Repuesto INT,@Orden INT,@Diagnostico INT,@Reparacion INT,@Consumo INT,@Actividad INT,@Factura INT,@Pago INT,
  @Prioridad INT,@EstadoInicial INT=(SELECT IdEstadoOrden FROM dbo.EstadoOrden WHERE Codigo='RECIBIDO'),
  @Efectivo INT=(SELECT IdMetodoPago FROM dbo.MetodoPago WHERE Codigo='EFECTIVO' AND Activo=1),
  @Transferencia INT=(SELECT IdMetodoPago FROM dbo.MetodoPago WHERE Codigo='TRANSFERENCIA' AND Activo=1),
  @Ingreso DATETIME2(0),@Estimada DATE,@Numero VARCHAR(20),@Texto VARCHAR(1000),@DiagTexto VARCHAR(1000),@Trabajo VARCHAR(1000),
  @Costo DECIMAL(12,2),@Monto DECIMAL(12,2),@Total DECIMAL(12,2),@Nombre VARCHAR(150),@Cantidad INT;
 IF @EstadoInicial IS NULL OR @Efectivo IS NULL OR @Transferencia IS NULL
  THROW 53107,N'Faltan catalogos de estado o metodos de pago activos.',1;
 WHILE @N<=12
 BEGIN
  INSERT dbo.Cliente(TipoCliente,NIT,Nombres,Apellidos,RazonSocial,NombreContacto,Telefono,Email,Direccion)
   SELECT CASE WHEN Empresa IS NULL THEN 'INDIVIDUAL' ELSE 'EMPRESARIAL' END,'CF',Nombres,Apellidos,Empresa,Contacto,
    '0000-'+RIGHT('0000'+CONVERT(VARCHAR(4),N),4),'rl26.contacto'+CONVERT(VARCHAR(2),N)+'@example.invalid',Direccion
   FROM @ClientesOrigen WHERE N=@N;
  INSERT @Clientes VALUES(@N,CONVERT(INT,SCOPE_IDENTITY()));
  SET @N+=1;
 END;
 SET @N=1;
 WHILE @N<=24
 BEGIN
  SET @Tipo=NULL; SET @Marca=NULL;
  SELECT @Tipo=t.IdTipoEquipo,@Marca=m.IdMarca,@Cliente=c.Id FROM @EquiposOrigen e
   JOIN dbo.TipoEquipo t ON t.Nombre=e.Tipo JOIN dbo.Marca m ON m.Nombre=e.Marca JOIN @Clientes c ON c.N=e.Cliente WHERE e.N=@N;
  IF @Tipo IS NULL OR @Marca IS NULL THROW 53108,N'Faltan tipos de equipo o marcas del catalogo inicial.',1;
  INSERT dbo.Equipo(IdCliente,IdTipoEquipo,IdMarca,Modelo,NumeroSerie,Descripcion)
   SELECT @Cliente,@Tipo,@Marca,Modelo,'RL26-EQ-'+RIGHT('000'+CONVERT(VARCHAR(3),N),3),Descripcion FROM @EquiposOrigen WHERE N=@N;
  INSERT @Equipos VALUES(@N,CONVERT(INT,SCOPE_IDENTITY()));
  SET @N+=1;
 END;
 SET @N=1;
 WHILE @N<=18
 BEGIN
  SET @Categoria=NULL;
  SELECT @Categoria=c.IdCategoria FROM @Piezas p JOIN dbo.CategoriaRepuesto c ON c.Nombre=p.Categoria WHERE p.N=@N;
  IF @Categoria IS NULL THROW 53109,N'Falta una categoria requerida por los repuestos.',1;
  INSERT dbo.Repuesto(IdCategoria,Codigo,Nombre,Descripcion,PrecioCompraReferencia,PrecioVenta)
   SELECT @Categoria,Codigo,Nombre,'Articulo ficticio de demostracion; precios ilustrativos en quetzales.',Costo,Venta FROM @Piezas WHERE N=@N;
  INSERT @Repuestos VALUES(@N,CONVERT(INT,SCOPE_IDENTITY()));
  SET @N+=1;
 END;
 INSERT dbo.Bodega(Codigo,Nombre,Ubicacion) VALUES
  ('RL26-CENTRAL','Taller central','Ubicacion de demostracion, zona 10'),
  ('RL26-IMPRESION','Area de impresion','Area ficticia de repuestos de impresion'),
  ('RL26-RESERVA','Reserva de abastecimiento','Ubicacion ficticia de almacenamiento');
 INSERT @Bodegas SELECT CASE Codigo WHEN 'RL26-CENTRAL' THEN 1 WHEN 'RL26-IMPRESION' THEN 2 ELSE 3 END,IdBodega
  FROM dbo.Bodega WHERE Codigo IN('RL26-CENTRAL','RL26-IMPRESION','RL26-RESERVA');
 DECLARE @NombresProveedor TABLE(N INT PRIMARY KEY,Nombre VARCHAR(150));
 INSERT @NombresProveedor VALUES (1,'Suministros Quetzal'),(2,'Distribuidora Tecno Norte'),(3,'Componentes del Valle'),
  (4,'Soluciones de Impresion Alameda'),(5,'Redes y Energia del Centro'),(6,'Repuestos Electronicos Mirador');
 SET @N=1;
 WHILE @N<=6
 BEGIN
  INSERT dbo.Proveedor(NIT,Nombre,NombreContacto,Telefono,Email,Direccion)
   SELECT 'RL26-P-'+CONVERT(VARCHAR(2),N),Nombre,'Contacto ficticio de ventas','0000-00'+RIGHT('00'+CONVERT(VARCHAR(2),N),2),
    'rl26.ventas'+CONVERT(VARCHAR(2),N)+'@example.invalid','Direccion comercial ficticia para demostracion' FROM @NombresProveedor WHERE N=@N;
  INSERT @Proveedores VALUES(@N,CONVERT(INT,SCOPE_IDENTITY())); SET @N+=1;
 END;
 DECLARE @Detalle dbo.tvp_DetalleCompra;
 SET @N=1;
 WHILE @N<=12
 BEGIN
  DELETE FROM @Detalle;
  SELECT @Bodega=Id FROM @Bodegas WHERE N=CASE WHEN @N<=9 THEN 1+(@N-1)/3 ELSE @N-9 END;
  SELECT @Proveedor=Id FROM @Proveedores WHERE N=1+((@N-1)%6);
  INSERT @Detalle(IdRepuesto,Cantidad,CostoUnitario)
   SELECT r.Id,CASE WHEN @N<=9 THEN 15+5*((@N-1)/3) ELSE 7 END,p.Costo FROM @Piezas p JOIN @Repuestos r ON r.N=p.N
   WHERE p.N BETWEEN 1+6*((@N-1)%3) AND 6+6*((@N-1)%3);
  SET @Nombre='RL26-COMP-'+RIGHT('000'+CONVERT(VARCHAR(3),@N),3);
  EXEC dbo.sp_RegistrarCompra @IdProveedor=@Proveedor,@IdBodegaDestino=@Bodega,@IdUsuario=@BodegaUsuario,
   @NumeroDocumentoProveedor=@Nombre,@Observaciones='Abastecimiento ficticio del taller',@Detalle=@Detalle,@IdCompra=@Id OUTPUT;
  INSERT @Compras VALUES(@N,@Id);
  IF @N<=9 EXEC dbo.sp_RecibirCompra @Id,@BodegaUsuario;
  SET @N+=1;
 END;
 SET @N=1;
 WHILE @N<=3
 BEGIN
  SELECT @Bodega=Id FROM @Bodegas WHERE N=@N; SET @J=1;
  WHILE @J<=18
  BEGIN
   SELECT @Repuesto=Id FROM @Repuestos WHERE N=@J;
   EXEC dbo.usp_CambiarStockMinimo @Bodega,@Repuesto,5,@BodegaUsuario;
   SET @J+=1;
  END;
  SET @N+=1;
 END;

 SET @N=1;
 WHILE @N<=24
 BEGIN
  SELECT @Equipo=Id FROM @Equipos WHERE N=@N;
  SELECT @Texto=Problema,@DiagTexto=Diagnostico,@Trabajo=Trabajo,@Costo=ManoObra FROM @Escenarios WHERE N=@N;
  SET @Prioridad=NULL;
  SELECT @Prioridad=IdPrioridad FROM dbo.Prioridad WHERE Codigo=CASE WHEN @N IN(5,9,17) THEN 'URGENTE' WHEN @N%3=0 THEN 'ALTA' WHEN @N%4=0 THEN 'BAJA' ELSE 'NORMAL' END;
  IF @Prioridad IS NULL THROW 53110,N'Falta una prioridad del catalogo inicial.',1;
  SET @Ingreso=DATEADD(DAY,-(1+(@N%21)),SYSUTCDATETIME());
  SET @Estimada=DATEADD(DAY,5,CONVERT(DATE,DATEADD(HOUR,-6,@Ingreso)));
  SET @Numero='RL26-OS-'+RIGHT('000'+CONVERT(VARCHAR(3),@N),3);
  INSERT dbo.OrdenServicio(NumeroOrden,IdEquipo,IdUsuarioRecepcion,FechaIngreso,ProblemaReportado,IdPrioridad,IdEstadoOrden,FechaEstimada,Observaciones)
   VALUES(@Numero,@Equipo,@Recepcion,@Ingreso,@Texto,@Prioridad,@EstadoInicial,@Estimada,'Escenario ficticio de taller. Eventos posteriores registrados al cargar.');
  SET @Orden=CONVERT(INT,SCOPE_IDENTITY()); INSERT @Ordenes VALUES(@N,@Orden);
  IF @N<=19 EXEC dbo.sp_RegistrarDiagnostico @Orden,@Tecnico,@DiagTexto,@Costo,@Diagnostico OUTPUT;
  IF @N<=14
  BEGIN
   EXEC dbo.sp_IniciarReparacion @Orden,@Tecnico,@Trabajo,@Costo,@Reparacion OUTPUT;
   INSERT @Reparaciones VALUES(@N,@Reparacion);
   EXEC dbo.usp_RegistrarActividad @Reparacion,@Tecnico,'Inspeccion de componentes y comprobacion del sintoma reportado.',0.75,@Actividad OUTPUT;
   SELECT @Bodega=Id FROM @Bodegas WHERE N=1;
   SET @J=1;
   WHILE @J<=2
   BEGIN
    SET @Repuesto=NULL;
    SELECT @Repuesto=r.Id FROM @Escenarios e JOIN @Repuestos r ON r.N=CASE WHEN @J=1 THEN e.Pieza1 ELSE e.Pieza2 END WHERE e.N=@N;
    IF @Repuesto IS NOT NULL EXEC dbo.sp_AsignarRepuestoReparacion @Reparacion,@Bodega,@Repuesto,1,@Tecnico,@Consumo OUTPUT;
    SET @J+=1;
   END;
   IF @N<=10
   BEGIN
    EXEC dbo.usp_RegistrarActividad @Reparacion,@Tecnico,'Prueba funcional posterior al trabajo y verificacion de estabilidad.',0.50,@Actividad OUTPUT;
    EXEC dbo.sp_FinalizarReparacion @Reparacion,@Tecnico,'Trabajo finalizado y comprobado con prueba funcional.';
   END;
  END;
  IF @N<=8
  BEGIN
   EXEC dbo.sp_GenerarFactura @IdOrden=@Orden,@IdUsuario=@Caja,@IdFactura=@Factura OUTPUT;
   SELECT @Total=Total FROM dbo.Factura WHERE IdFactura=@Factura;
   INSERT @Facturas VALUES(@N,@Factura,@Total);
   IF @N<=7
   BEGIN
    SET @Monto=ROUND(@Total*0.40,2);
    EXEC dbo.sp_RegistrarPago @Factura,@Efectivo,@Monto,@Caja,'Abono inicial de demostracion',@Pago OUTPUT;
   END;
   IF @N<=6
   BEGIN
    SET @Monto=dbo.fn_SaldoFactura(@Factura);
    EXEC dbo.sp_RegistrarPago @Factura,@Transferencia,@Monto,@Caja,'Liquidacion de demostracion',@Pago OUTPUT;
    SELECT @Nombre=COALESCE(c.NombreContacto,c.NombreMostrar) FROM dbo.Cliente c JOIN dbo.Equipo e ON e.IdCliente=c.IdCliente WHERE e.IdEquipo=@Equipo;
    EXEC dbo.sp_EntregarOrden @Orden,@Recepcion,@Nombre,NULL,'Equipo entregado tras comprobacion de saldo cero.';
   END;
  END;
  IF @N BETWEEN 20 AND 21 EXEC dbo.sp_CambiarEstadoOrden @Orden,'DIAGNOSTICO',@Recepcion,'Equipo en cola de evaluacion tecnica.';
  IF @N=24 EXEC dbo.sp_CambiarEstadoOrden @Orden,'CANCELADO',@Recepcion,'Cliente retira la solicitud antes de iniciar diagnostico.';
  SET @N+=1;
 END;
 -- Agotar un repuesto en una bodega no elimina su disponibilidad en las otras.
 SELECT @Bodega=Id FROM @Bodegas WHERE N=1;
 SELECT @Repuesto=Id FROM @Repuestos WHERE N=18;
 SELECT @Cantidad=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@Bodega AND IdRepuesto=@Repuesto;
 EXEC dbo.sp_AjustarInventario @Bodega,@Repuesto,'AJUSTE_SALIDA',@Cantidad,@BodegaUsuario,'Baja ficticia por lote de ventiladores defectuoso.',5;
 SELECT @Bodega=Id FROM @Bodegas WHERE N=2;
 EXEC dbo.usp_CambiarStockMinimo @Bodega,@Repuesto,25,@BodegaUsuario;
 SELECT @Repuesto=Id FROM @Repuestos WHERE N=1;
 EXEC dbo.usp_ActualizarPreciosRepuesto @Repuesto,240.00,375.00,@BodegaUsuario;

 IF (SELECT COUNT(*) FROM @Clientes)<>12 OR (SELECT COUNT(*) FROM @Equipos)<>24 OR (SELECT COUNT(*) FROM @Ordenes)<>24
    OR (SELECT COUNT(*) FROM @Reparaciones)<>14 OR (SELECT COUNT(*) FROM @Facturas)<>8 OR (SELECT COUNT(*) FROM @Compras)<>12
  THROW 53111,N'No coinciden los conteos previstos del conjunto RL26.',1;
 IF (SELECT COUNT(*) FROM dbo.Diagnostico d JOIN @Ordenes o ON o.Id=d.IdOrden)<>19
    OR (SELECT COUNT(*) FROM dbo.InventarioBodega i JOIN @Bodegas b ON b.Id=i.IdBodega)<>54
    OR (SELECT COUNT(*) FROM dbo.MovimientoInventario m JOIN @Bodegas b ON b.Id=m.IdBodega)<>73
    OR (SELECT COUNT(*) FROM dbo.Pago p JOIN @Facturas f ON f.Id=p.IdFactura)<>13
    OR (SELECT COUNT(*) FROM dbo.Entrega e JOIN @Ordenes o ON o.Id=e.IdOrden)<>6
  THROW 53112,N'No coinciden diagnosticos, inventario, movimientos, pagos o entregas previstos.',1;
 IF (SELECT COUNT(*) FROM @Ordenes o JOIN dbo.OrdenServicio s ON s.IdOrden=o.Id JOIN dbo.EstadoOrden e ON e.IdEstadoOrden=s.IdEstadoOrden
      WHERE e.Codigo='LISTO' AND NOT EXISTS(SELECT 1 FROM dbo.Factura f WHERE f.IdOrden=s.IdOrden))<>2
    OR (SELECT COUNT(*) FROM @Facturas f WHERE dbo.fn_SaldoFactura(f.Id)>0)<>2
    OR NOT EXISTS(SELECT 1 FROM @Clientes c WHERE NOT EXISTS(SELECT 1 FROM dbo.Equipo e JOIN dbo.OrdenServicio o ON o.IdEquipo=e.IdEquipo WHERE e.IdCliente=c.Id))
  THROW 53113,N'Faltan escenarios para facturar, cobrar o consultar un cliente sin servicios.',1;
 IF EXISTS(SELECT 1 FROM @Facturas f JOIN dbo.Factura s ON s.IdFactura=f.Id WHERE s.Total<>f.Total OR dbo.fn_SaldoFactura(s.IdFactura)<0)
    OR NOT EXISTS(SELECT 1 FROM dbo.InventarioBodega i JOIN @Bodegas b ON b.Id=i.IdBodega WHERE i.Existencia=0)
  THROW 53114,N'No se conservan saldos, precios historicos o el escenario de stock cero.',1;
 COMMIT TRANSACTION;
 SELECT 'RL26' AS Conjunto,12 AS Clientes,24 AS Equipos,24 AS Ordenes,19 AS Diagnosticos,14 AS Reparaciones,
  18 AS Repuestos,3 AS Bodegas,54 AS Existencias,6 AS Proveedores,12 AS Compras,73 AS Movimientos,8 AS Facturas,13 AS Pagos,6 AS Entregas;
 SELECT s.NumeroOrden,c.NombreMostrar AS Cliente,e.Modelo,eo.Nombre AS Estado,p.Nombre AS Prioridad
  FROM dbo.OrdenServicio s JOIN @Ordenes nuevas ON nuevas.Id=s.IdOrden JOIN dbo.Equipo e ON e.IdEquipo=s.IdEquipo
  JOIN dbo.Cliente c ON c.IdCliente=e.IdCliente JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=s.IdEstadoOrden
  JOIN dbo.Prioridad p ON p.IdPrioridad=s.IdPrioridad ORDER BY s.NumeroOrden;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
