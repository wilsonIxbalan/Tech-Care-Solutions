/* DATOS DE DEMOSTRACION - PDF del proyecto, pagina 11.
   MANUAL, independiente del maestro y del arranque de la API. NO EJECUTADO.
   Ejecutar completo en una copia de pruebas de TechCareDB, con cliente que se
   detenga al error. No usar app_techcare para esta carga administrativa.
   No borra ni modifica cuentas/datos existentes. Prefijo reservado SEM26 / sem26.
   Una segunda ejecucion se RECHAZA; nunca se limpian transacciones historicas.

   Antes de ejecutar: respaldo/copia de pruebas, bootstrap de administrador y
   hash Argon2id generado LOCALMENTE con password:hash. Pegar hash solo en copia
   privada, nunca en Git. Crea 10 cuentas ACTIVAS sin rol ADMINISTRADOR y con la
   misma clave de demostracion: no cargar en produccion ni publicar esas claves.
   Cambiar @ConfirmarCarga a 1 es confirmacion EXPLICITA de estas condiciones.

   Resultado propio de la semilla (sin contar filas previas):
   10 usuarios, 30 clientes, 45 equipos, 60 ordenes, 45 diagnosticos,
   35 reparaciones, 30 repuestos, 3 bodegas, 90 existencias, 8 proveedores,
   20 compras (18 recibidas/2 pendientes), 139 movimientos, 30 facturas,
   45 pagos, 20 entregas. Los IDs reales se resuelven, no se presuponen.
   Ordenes ingresadas durante los ultimos 90 dias; procesamiento/recepcion/
   facturacion ahora. No se falsifican fechas de movimientos ni documentos.
   No se deshabilitan triggers/constraints ni se altera stock directamente.
   Una transaccion exterior revierte toda la carga si falla cualquier asercion.
   Los valores de IDENTITY/SEQUENCE pueden dejar saltos tras un rollback. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;
SET NOCOUNT ON;

DECLARE @ConfirmarCarga BIT = 0;
DECLARE @HashDemo VARCHAR(MAX) = '<HASH_ARGON2ID_GENERADO_LOCALMENTE>';
IF @ConfirmarCarga <> 1
    THROW 53000, N'Carga desactivada. Revisar instrucciones y confirmar solo en una base de pruebas.', 1;
IF DB_NAME() <> N'TechCareDB'
    THROW 53001, N'Conectar expresamente a la copia de pruebas TechCareDB.', 1;
IF @@TRANCOUNT <> 0
    THROW 53002, N'Finalizar la transaccion existente antes de ejecutar la semilla.', 1;
IF DATALENGTH(@HashDemo) NOT BETWEEN 40 AND 255 OR @HashDemo LIKE '%<%'
   OR @HashDemo NOT LIKE '$argon2id$v=19$m=%$%$%'
    THROW 53003, N'Completar hash Argon2id en copia privada; no guardar secretos en Git.', 1;

SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @Lock INT, @Admin INT;
    EXEC @Lock = sys.sp_getapplock @Resource=N'TechCare.Semilla.SEM26',
        @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=0;
    IF @Lock < 0 THROW 53004, N'Otra carga de demostracion esta en curso.', 1;
    -- Mismo mutex que las escrituras de usuarios del backend.
    SELECT @Admin=IdRol FROM dbo.Rol WITH(UPDLOCK,HOLDLOCK)
        WHERE Codigo='ADMINISTRADOR' AND Activo=1;
    IF NOT EXISTS(SELECT 1 FROM dbo.Usuario u JOIN dbo.UsuarioRol ur ON ur.IdUsuario=u.IdUsuario
                  WHERE u.Activo=1 AND ur.IdRol=@Admin)
        THROW 53005, N'Primero provisionar el administrador mediante el bootstrap independiente.', 1;
    IF (SELECT COUNT(*) FROM dbo.Rol WHERE Activo=1 AND Codigo IN('RECEPCION','TECNICO','BODEGA','CAJA'))<>4
        THROW 53006, N'Faltan roles activos del catalogo.', 1;
    IF EXISTS(SELECT 1 FROM dbo.Usuario WHERE NombreUsuario LIKE 'sem26.%' OR Email LIKE 'sem26.%')
       OR EXISTS(SELECT 1 FROM dbo.Cliente WHERE Email LIKE 'sem26.%')
       OR EXISTS(SELECT 1 FROM dbo.Equipo WHERE NumeroSerie LIKE 'SEM26-%')
       OR EXISTS(SELECT 1 FROM dbo.Repuesto WHERE Codigo LIKE 'SEM26-%')
       OR EXISTS(SELECT 1 FROM dbo.Bodega WHERE Codigo LIKE 'SEM26-%')
       OR EXISTS(SELECT 1 FROM dbo.Proveedor WHERE NIT LIKE 'SEM26-%' OR Email LIKE 'sem26.%')
       OR EXISTS(SELECT 1 FROM dbo.OrdenServicio WHERE NumeroOrden LIKE 'SEM26-%')
        THROW 53007, N'Ya existen identificadores de esta semilla. No se inserta ni se elimina nada.', 1;

    DECLARE @Usuarios TABLE(N INT PRIMARY KEY, Id INT NOT NULL, Rol VARCHAR(30));
    DECLARE @Clientes TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Equipos TABLE(N INT PRIMARY KEY, Id INT NOT NULL, Cliente INT NOT NULL);
    DECLARE @Repuestos TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Bodegas TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Proveedores TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Compras TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Ordenes TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Diagnosticos TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Reparaciones TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Facturas TABLE(N INT PRIMARY KEY, Id INT NOT NULL, Total DECIMAL(12,2));
    DECLARE @Categorias TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Tipos TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Marcas TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Prioridades TABLE(N INT PRIMARY KEY, Id INT NOT NULL);
    DECLARE @Piezas TABLE(N INT PRIMARY KEY, Categoria VARCHAR(80), Nombre VARCHAR(120), Costo DECIMAL(12,2), Venta DECIMAL(12,2));
    INSERT @Piezas VALUES
        (1,'Almacenamiento','SSD SATA 240 GB',150,225),(2,'Almacenamiento','SSD NVMe 500 GB',250,375),
        (3,'Almacenamiento','Disco duro SATA 1 TB',280,420),
        (4,'Memoria RAM','Memoria DDR4 8 GB para laptop',150,225),(5,'Memoria RAM','Memoria DDR4 16 GB para escritorio',250,375),
        (6,'Memoria RAM','Memoria DDR3 4 GB',75,115),
        (7,'Pantallas','Panel laptop 14 pulgadas',450,650),(8,'Pantallas','Panel laptop 15.6 pulgadas',500,725),
        (9,'Pantallas','Panel monitor 21.5 pulgadas',550,800),
        (10,'Baterias y cargadores','Cargador universal 65 W',100,160),(11,'Baterias y cargadores','Bateria laptop 3 celdas',225,340),
        (12,'Baterias y cargadores','Adaptador USB-C 90 W',180,275),
        (13,'Placas y procesadores','Placa de puerto de carga',90,145),(14,'Placas y procesadores','Procesador de escritorio de prueba',400,600),
        (15,'Placas y procesadores','Modulo de alimentacion de placa',125,190),
        (16,'Perifericos','Teclado USB',45,75),(17,'Perifericos','Teclado para laptop',130,200),
        (18,'Perifericos','Mouse optico USB',25,45),
        (19,'Impresion','Rodillo de alimentacion de impresora',60,100),(20,'Impresion','Cartucho de tinta negro',85,135),
        (21,'Impresion','Unidad de fusor de impresora',350,525),
        (22,'Redes','Adaptador Wi-Fi USB',65,105),(23,'Redes','Tarjeta de red PCIe',100,155),
        (24,'Redes','Adaptador Ethernet USB-C',80,125),
        (25,'Refrigeracion','Ventilador para laptop',80,130),(26,'Refrigeracion','Ventilador de gabinete 120 mm',35,60),
        (27,'Refrigeracion','Pasta termica 4 g',25,45),
        (28,'Cables y conectores','Cable SATA de datos',15,30),(29,'Cables y conectores','Cable HDMI 1.5 m',25,45),
        (30,'Cables y conectores','Conector de alimentacion DC',10,25);
    INSERT @Categorias SELECT ROW_NUMBER() OVER(ORDER BY IdCategoria),IdCategoria FROM dbo.CategoriaRepuesto;
    INSERT @Tipos SELECT ROW_NUMBER() OVER(ORDER BY IdTipoEquipo),IdTipoEquipo FROM dbo.TipoEquipo;
    INSERT @Marcas SELECT ROW_NUMBER() OVER(ORDER BY IdMarca),IdMarca FROM dbo.Marca;
    INSERT @Prioridades SELECT ROW_NUMBER() OVER(ORDER BY Nivel,IdPrioridad),IdPrioridad FROM dbo.Prioridad;
    DECLARE @NC INT=(SELECT COUNT(*) FROM @Categorias),@NT INT=(SELECT COUNT(*) FROM @Tipos),
        @NM INT=(SELECT COUNT(*) FROM @Marcas),@NP INT=(SELECT COUNT(*) FROM @Prioridades);
    DECLARE @EstadoRecibido INT=(SELECT IdEstadoOrden FROM dbo.EstadoOrden WHERE Codigo='RECIBIDO'),
        @Efectivo INT=(SELECT IdMetodoPago FROM dbo.MetodoPago WHERE Codigo='EFECTIVO' AND Activo=1),
        @Transferencia INT=(SELECT IdMetodoPago FROM dbo.MetodoPago WHERE Codigo='TRANSFERENCIA' AND Activo=1);
    IF @NC=0 OR @NT=0 OR @NM=0 OR @NP=0 OR @EstadoRecibido IS NULL OR @Efectivo IS NULL OR @Transferencia IS NULL
        THROW 53008, N'Faltan catalogos iniciales requeridos.', 1;

    DECLARE @I INT=1,@J INT,@Id INT,@Rol VARCHAR(30),@S VARCHAR(3),@Codigo VARCHAR(30),
        @Categoria INT,@Tipo INT,@Marca INT,@Prioridad INT,@Cliente INT,@Equipo INT,
        @Bodega INT,@Repuesto INT,@Proveedor INT,@Orden INT,@Diagnostico INT,@Reparacion INT,
        @Factura INT,@Salida INT,@Actividad INT,@Pago INT,@Tecnico INT,@Cantidad INT,
        @Costo DECIMAL(12,2),@Monto DECIMAL(12,2),@Total DECIMAL(12,2),
        @Fecha DATETIME2(0),@Numero VARCHAR(20),@NombreRepuesto VARCHAR(120),@Venta DECIMAL(12,2),@Documento VARCHAR(40);
    WHILE @I<=10
    BEGIN
        SET @S=RIGHT('000'+CONVERT(VARCHAR(3),@I),3);
        SET @Rol=CASE WHEN @I<=2 THEN 'RECEPCION' WHEN @I<=6 THEN 'TECNICO' WHEN @I<=8 THEN 'BODEGA' ELSE 'CAJA' END;
        INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
            VALUES('sem26.usuario'+@S,@HashDemo,'Demostracion '+@Rol+' '+@S,'sem26.usuario'+@S+'@example.invalid');
        SET @Id=CONVERT(INT,SCOPE_IDENTITY());
        INSERT @Usuarios VALUES(@I,@Id,@Rol);
        INSERT dbo.UsuarioRol(IdUsuario,IdRol) SELECT @Id,IdRol FROM dbo.Rol WHERE Codigo=@Rol AND Activo=1;
        SET @I+=1;
    END;
    DECLARE @Recepcion INT=(SELECT Id FROM @Usuarios WHERE N=1),
        @Almacen INT=(SELECT Id FROM @Usuarios WHERE N=7),@Caja INT=(SELECT Id FROM @Usuarios WHERE N=9);

    SET @I=1;
    WHILE @I<=30
    BEGIN
        SET @S=RIGHT('000'+CONVERT(VARCHAR(3),@I),3);
        INSERT dbo.Cliente(TipoCliente,NIT,Nombres,Apellidos,RazonSocial,NombreContacto,Telefono,Email,Direccion)
            VALUES(CASE WHEN @I%3=0 THEN 'EMPRESARIAL' ELSE 'INDIVIDUAL' END,'CF',
                CASE WHEN @I%3<>0 THEN 'Cliente demo '+@S END,CASE WHEN @I%3<>0 THEN 'Pruebas' END,
                CASE WHEN @I%3=0 THEN 'Empresa demostracion '+@S END,'Contacto de pruebas','00000000',
                'sem26.cliente'+@S+'@example.invalid','Direccion ficticia para demostracion');
        INSERT @Clientes VALUES(@I,CONVERT(INT,SCOPE_IDENTITY()));
        SET @Categoria=NULL;
        SELECT @Categoria=c.IdCategoria,@NombreRepuesto=p.Nombre,@Costo=p.Costo,@Venta=p.Venta
            FROM @Piezas p JOIN dbo.CategoriaRepuesto c ON c.Nombre=p.Categoria WHERE p.N=@I;
        IF @Categoria IS NULL THROW 53009, N'Falta una categoria requerida por los repuestos de demostracion.', 1;
        INSERT dbo.Repuesto(IdCategoria,Codigo,Nombre,Descripcion,PrecioCompraReferencia,PrecioVenta)
            VALUES(@Categoria,'SEM26-R'+@S,@NombreRepuesto,'Articulo de demostracion; precios ficticios en quetzales',@Costo,@Venta);
        INSERT @Repuestos VALUES(@I,CONVERT(INT,SCOPE_IDENTITY()));
        SET @I+=1;
    END;
    SET @I=1;
    WHILE @I<=45
    BEGIN
        SET @S=RIGHT('000'+CONVERT(VARCHAR(3),@I),3);
        -- Solo clientes 1..29 poseen equipos: el cliente 30 no tiene ordenes.
        SELECT @Cliente=Id FROM @Clientes WHERE N=1+((@I-1)%29);
        SELECT @Tipo=Id FROM @Tipos WHERE N=1+((@I-1)%@NT);
        SELECT @Marca=Id FROM @Marcas WHERE N=1+((@I-1)%@NM);
        INSERT dbo.Equipo(IdCliente,IdTipoEquipo,IdMarca,Modelo,NumeroSerie,Descripcion)
            VALUES(@Cliente,@Tipo,@Marca,'Modelo demo '+@S,'SEM26-E'+@S,'Equipo ficticio para pruebas academicas');
        INSERT @Equipos VALUES(@I,CONVERT(INT,SCOPE_IDENTITY()),@Cliente);
        SET @I+=1;
    END;
    SET @I=1;
    WHILE @I<=8
    BEGIN
        SET @S=RIGHT('000'+CONVERT(VARCHAR(3),@I),3);
        INSERT dbo.Proveedor(NIT,Nombre,NombreContacto,Telefono,Email,Direccion)
            VALUES('SEM26-P'+@S,'Proveedor demostracion '+@S,'Contacto ficticio','00000000',
                'sem26.proveedor'+@S+'@example.invalid','Direccion ficticia para demostracion');
        INSERT @Proveedores VALUES(@I,CONVERT(INT,SCOPE_IDENTITY()));
        SET @I+=1;
    END;
    SET @I=1;
    WHILE @I<=3
    BEGIN
        SET @S=RIGHT('000'+CONVERT(VARCHAR(3),@I),3);
        INSERT dbo.Bodega(Codigo,Nombre,Ubicacion) VALUES('SEM26-B'+@S,'Bodega demostracion '+@S,'Ubicacion ficticia');
        SET @Bodega=CONVERT(INT,SCOPE_IDENTITY());
        INSERT @Bodegas VALUES(@I,@Bodega);
        SET @J=1;
        WHILE @J<=30
        BEGIN
            SELECT @Repuesto=Id FROM @Repuestos WHERE N=@J;
            EXEC dbo.usp_CambiarStockMinimo @Bodega,@Repuesto,5,@Almacen;
            SET @J+=1;
        END;
        SET @I+=1;
    END;

    -- 18 compras cubren los 90 pares bodega/repuesto; dos quedan pendientes.
    DECLARE @Detalle dbo.tvp_DetalleCompra;
    SET @I=1;
    WHILE @I<=20
    BEGIN
        DELETE FROM @Detalle;
        SELECT @Proveedor=Id FROM @Proveedores WHERE N=1+((@I-1)%8);
        SELECT @Bodega=Id FROM @Bodegas WHERE N=1+((@I-1)/6)%3;
        INSERT @Detalle(IdRepuesto,Cantidad,CostoUnitario)
            SELECT r.Id,15+5*((@I-1)/6),p.PrecioCompraReferencia
            FROM @Repuestos r JOIN dbo.Repuesto p ON p.IdRepuesto=r.Id
            WHERE r.N BETWEEN 1+5*((@I-1)%6) AND 5+5*((@I-1)%6);
        SET @Documento='SEM26-DOC-'+CONVERT(VARCHAR(3),@I);
        EXEC dbo.sp_RegistrarCompra @IdProveedor=@Proveedor,@IdBodegaDestino=@Bodega,@IdUsuario=@Almacen,
            @NumeroDocumentoProveedor=@Documento,@Observaciones='Conjunto SEM26 de demostracion',@Detalle=@Detalle,@IdCompra=@Id OUTPUT;
        INSERT @Compras VALUES(@I,@Id);
        IF @I<=18 EXEC dbo.sp_RecibirCompra @Id,@Almacen;
        SET @I+=1;
    END;

    SET @I=1;
    WHILE @I<=60
    BEGIN
        -- Primeras 3 entregadas del equipo 1; luego una nueva orden para ese equipo.
        SET @J=CASE WHEN @I<=3 THEN 1 WHEN @I<=20 THEN @I-2 ELSE @I-20 END;
        SELECT @Equipo=Id,@Cliente=Cliente FROM @Equipos WHERE N=@J;
        SELECT @Prioridad=Id FROM @Prioridades WHERE N=1+((@I-1)%@NP);
        SELECT @Tecnico=Id FROM @Usuarios WHERE N=3+((@I-1)%4);
        SET @Fecha=DATEADD(DAY,-(91-@I),SYSUTCDATETIME());
        -- Un reingreso debe ser posterior a la entrega anterior, realizada ahora.
        -- No inventar ordenes historicas solapadas para alcanzar la cardinalidad.
        IF EXISTS(SELECT 1 FROM dbo.OrdenServicio WHERE IdEquipo=@Equipo)
            SET @Fecha=SYSUTCDATETIME();
        SET @Numero='SEM26-OS-'+RIGHT('000'+CONVERT(VARCHAR(3),@I),3);
        -- Ingreso historico permitido por trigger, sin cambiar una fila ya creada.
        -- El SP normal usa fecha actual y no permite importar fechas historicas.
        INSERT dbo.OrdenServicio(NumeroOrden,IdEquipo,IdUsuarioRecepcion,FechaIngreso,ProblemaReportado,IdPrioridad,IdEstadoOrden,Observaciones)
            VALUES(@Numero,@Equipo,@Recepcion,@Fecha,'Problema de demostracion: revision y mantenimiento',@Prioridad,@EstadoRecibido,'Conjunto SEM26. Ingreso historico; procesado al cargar.');
        SET @Orden=CONVERT(INT,SCOPE_IDENTITY());
        INSERT @Ordenes VALUES(@I,@Orden);
        IF @I<=45
        BEGIN
            SET @Costo=75+@I*5;
            EXEC dbo.sp_RegistrarDiagnostico @Orden,@Tecnico,'Diagnostico de demostracion: evaluacion tecnica',@Costo,@Diagnostico OUTPUT;
            INSERT @Diagnosticos VALUES(@I,@Diagnostico);
        END;
        IF @I<=35
        BEGIN
            EXEC dbo.sp_IniciarReparacion @Orden,@Tecnico,'Mantenimiento y verificacion de funcionamiento',@Costo,@Reparacion OUTPUT;
            INSERT @Reparaciones VALUES(@I,@Reparacion);
            EXEC dbo.usp_RegistrarActividad @Reparacion,@Tecnico,'Inspeccion y limpieza de demostracion',1.50,@Actividad OUTPUT;
            IF @I<=30 AND @I%5<>0
            BEGIN
                SELECT @Bodega=Id FROM @Bodegas WHERE N=1+((@I-1)%3);
                SET @J=1;
                WHILE @J<=2
                BEGIN
                    SELECT @Repuesto=Id FROM @Repuestos WHERE N=1+(((@I-1)*2+@J-1)%28);
                    EXEC dbo.sp_AsignarRepuestoReparacion @Reparacion,@Bodega,@Repuesto,1,@Tecnico,@Salida OUTPUT;
                    SET @J+=1;
                END;
            END;
            IF @I<=30 EXEC dbo.sp_FinalizarReparacion @Reparacion,@Tecnico,'Pruebas de funcionamiento satisfactorias';
        END;
        IF @I<=30
        BEGIN
            EXEC dbo.sp_GenerarFactura @IdOrden=@Orden,@IdUsuario=@Caja,@PorcentajeImpuesto=12.00,@IdFactura=@Factura OUTPUT;
            SELECT @Total=Total FROM dbo.Factura WHERE IdFactura=@Factura;
            INSERT @Facturas VALUES(@I,@Factura,@Total);
            IF @I<=25
            BEGIN
                SET @Monto=ROUND(@Total/2,2);
                EXEC dbo.sp_RegistrarPago @Factura,@Efectivo,@Monto,@Caja,'SEM26 abono inicial',@Pago OUTPUT;
            END;
            IF @I<=20
            BEGIN
                SET @Monto=dbo.fn_SaldoFactura(@Factura);
                EXEC dbo.sp_RegistrarPago @Factura,@Transferencia,@Monto,@Caja,'SEM26 liquidacion',@Pago OUTPUT;
                EXEC dbo.sp_EntregarOrden @Orden,@Recepcion,'Receptor ficticio de demostracion',NULL,'Entrega SEM26';
            END;
        END;
        IF @I BETWEEN 46 AND 50 EXEC dbo.sp_CambiarEstadoOrden @Orden,'DIAGNOSTICO',@Recepcion,'En revision, sin diagnostico registrado';
        IF @I>=56 EXEC dbo.sp_CambiarEstadoOrden @Orden,'CANCELADO',@Recepcion,'Cliente de demostracion desiste antes del diagnostico';
        SET @I+=1;
    END;

    -- Cero y bajo minimo mediante procesos, nunca UPDATE manual de existencia.
    SELECT @Bodega=Id FROM @Bodegas WHERE N=1;
    SELECT @Repuesto=Id FROM @Repuestos WHERE N=30;
    SELECT @Cantidad=Existencia FROM dbo.InventarioBodega WHERE IdBodega=@Bodega AND IdRepuesto=@Repuesto;
    EXEC dbo.sp_AjustarInventario @Bodega,@Repuesto,'AJUSTE_SALIDA',@Cantidad,@Almacen,'SEM26 baja por piezas de demostracion danadas',5;
    SELECT @Bodega=Id FROM @Bodegas WHERE N=2;
    EXEC dbo.usp_CambiarStockMinimo @Bodega,@Repuesto,25,@Almacen;
    -- Precio actual distinto del historico, conserva facturas/consumos previos.
    SELECT @Repuesto=Id FROM @Repuestos WHERE N=1;
    SELECT @Costo=PrecioCompraReferencia+5,@Monto=PrecioVenta+10 FROM dbo.Repuesto WHERE IdRepuesto=@Repuesto;
    EXEC dbo.usp_ActualizarPreciosRepuesto @Repuesto,@Costo,@Monto,@Almacen;

    -- Aserciones sobre SOLO el conjunto creado: no cuentan datos anteriores.
    IF (SELECT COUNT(*) FROM @Usuarios)<>10 OR (SELECT COUNT(*) FROM @Clientes)<>30
       OR (SELECT COUNT(*) FROM @Equipos)<>45 OR (SELECT COUNT(*) FROM @Ordenes)<>60
       OR (SELECT COUNT(*) FROM @Diagnosticos)<>45 OR (SELECT COUNT(*) FROM @Reparaciones)<>35
       OR (SELECT COUNT(*) FROM @Repuestos)<>30 OR (SELECT COUNT(*) FROM @Bodegas)<>3
       OR (SELECT COUNT(*) FROM @Proveedores)<>8 OR (SELECT COUNT(*) FROM @Compras)<>20
       OR (SELECT COUNT(*) FROM @Facturas)<>30
        THROW 53010, N'No se alcanzaron los conteos de entidades del PDF.', 1;
    IF (SELECT COUNT(*) FROM dbo.InventarioBodega ib JOIN @Bodegas b ON b.Id=ib.IdBodega JOIN @Repuestos r ON r.Id=ib.IdRepuesto)<>90
       OR (SELECT COUNT(*) FROM dbo.MovimientoInventario m JOIN @Bodegas b ON b.Id=m.IdBodega)<>139
       OR (SELECT COUNT(*) FROM dbo.Pago p JOIN @Facturas f ON f.Id=p.IdFactura)<>45
       OR (SELECT COUNT(*) FROM dbo.Entrega e JOIN @Ordenes o ON o.Id=e.IdOrden)<>20
        THROW 53011, N'No coinciden existencias, movimientos, pagos o entregas esperados.', 1;
    IF NOT EXISTS(SELECT 1 FROM @Clientes c WHERE NOT EXISTS(SELECT 1 FROM dbo.Equipo e JOIN dbo.OrdenServicio o ON o.IdEquipo=e.IdEquipo WHERE e.IdCliente=c.Id))
       OR NOT EXISTS(SELECT o.IdEquipo FROM dbo.OrdenServicio o JOIN @Ordenes s ON s.Id=o.IdOrden GROUP BY o.IdEquipo HAVING COUNT(*)>=3)
       OR NOT EXISTS(SELECT 1 FROM @Ordenes o WHERE NOT EXISTS(SELECT 1 FROM dbo.Diagnostico d WHERE d.IdOrden=o.Id))
       OR NOT EXISTS(SELECT 1 FROM @Diagnosticos d WHERE NOT EXISTS(SELECT 1 FROM dbo.Reparacion r WHERE r.IdDiagnostico=d.Id))
        THROW 53012, N'Faltan escenarios opcionales de cliente, equipo o diagnostico.', 1;
    IF EXISTS(SELECT 1 FROM @Ordenes a JOIN dbo.OrdenServicio anterior ON anterior.IdOrden=a.Id
        JOIN dbo.Entrega entrega ON entrega.IdOrden=anterior.IdOrden
        JOIN dbo.OrdenServicio siguiente ON siguiente.IdEquipo=anterior.IdEquipo AND siguiente.IdOrden>anterior.IdOrden
        WHERE siguiente.FechaIngreso<entrega.FechaEntrega)
        THROW 53015, N'Un reingreso de equipo precede a la entrega de su orden anterior.', 1;
    IF NOT EXISTS(SELECT rr.IdReparacion FROM dbo.RepuestoReparacion rr JOIN @Reparaciones r ON r.Id=rr.IdReparacion GROUP BY rr.IdReparacion HAVING COUNT(*)>=2)
       OR NOT EXISTS(SELECT 1 FROM @Reparaciones r WHERE NOT EXISTS(SELECT 1 FROM dbo.RepuestoReparacion rr WHERE rr.IdReparacion=r.Id))
       OR NOT EXISTS(SELECT ib.IdRepuesto FROM dbo.InventarioBodega ib JOIN @Repuestos r ON r.Id=ib.IdRepuesto WHERE ib.Existencia>0 GROUP BY ib.IdRepuesto HAVING COUNT(*)>=2 AND MIN(ib.Existencia)<>MAX(ib.Existencia))
       OR NOT EXISTS(SELECT 1 FROM dbo.InventarioBodega ib JOIN @Bodegas b ON b.Id=ib.IdBodega WHERE ib.Existencia=0)
       OR NOT EXISTS(SELECT 1 FROM dbo.InventarioBodega ib JOIN @Bodegas b ON b.Id=ib.IdBodega WHERE ib.Existencia>0 AND ib.Existencia<ib.StockMinimo)
        THROW 53013, N'Faltan escenarios de reparacion o inventario.', 1;
    IF (SELECT COUNT(*) FROM dbo.Factura f JOIN @Facturas s ON s.Id=f.IdFactura WHERE f.Estado='PAGADA')<>20
       OR (SELECT COUNT(*) FROM @Facturas f WHERE dbo.fn_SaldoFactura(f.Id)>0)<>10
       OR (SELECT COUNT(*) FROM dbo.Compra c JOIN @Compras s ON s.Id=c.IdCompra WHERE c.Estado='PENDIENTE')<>2
       OR NOT EXISTS(SELECT p.IdFactura FROM dbo.Pago p JOIN @Facturas f ON f.Id=p.IdFactura GROUP BY p.IdFactura HAVING COUNT(*)>=2)
       OR NOT EXISTS(SELECT 1 FROM dbo.RepuestoReparacion rr JOIN @Reparaciones r ON r.Id=rr.IdReparacion WHERE rr.IdRepuesto=@Repuesto AND rr.PrecioVentaUnitario<>@Monto)
       OR EXISTS(SELECT 1 FROM dbo.Factura f JOIN @Facturas s ON s.Id=f.IdFactura WHERE f.Total<>s.Total OR dbo.fn_SaldoFactura(f.IdFactura)<0)
        THROW 53014, N'Faltan escenarios financieros o se alteraron precios historicos.', 1;
    COMMIT TRANSACTION;
    SELECT 'SEM26' AS Conjunto,10 AS Usuarios,30 AS Clientes,45 AS Equipos,60 AS Ordenes,
        45 AS Diagnosticos,35 AS Reparaciones,30 AS Repuestos,3 AS Bodegas,90 AS Existencias,
        8 AS Proveedores,20 AS Compras,139 AS Movimientos,30 AS Facturas,45 AS Pagos,20 AS Entregas;
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
