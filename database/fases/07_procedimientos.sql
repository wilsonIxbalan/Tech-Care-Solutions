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
