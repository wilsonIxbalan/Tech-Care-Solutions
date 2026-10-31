/* DATOS SEMILLA 04 · ordenes de servicio de punta a punta.
   Todo el flujo usa los SP oficiales (diagnostico, reparacion, consumo, factura,
   pago, anulacion de pago, entrega). Solo el INGRESO de la orden puede hacerse con
   fecha atrasada (variable @FechasVariadas) para tener fechas variadas:
     @FechasVariadas = 1 -> INSERT directo en OrdenServicio con FechaIngreso de los
                            ultimos 60 dias (el trigger de ingreso crea el historial inicial).
     @FechasVariadas = 0 -> usa sp_RegistrarOrdenServicio (todo con fecha de hoy).
   Los demas eventos (diagnostico, factura, pago, entrega) quedan con la fecha de ejecucion
   porque los SP usan SYSUTCDATETIME(). Registrar esto como DEC con Wilson.
   Estados finales del plan de 60 ordenes:
     RECIBIDO 6 · DIAGNOSTICO 2 · CANCELADO 4 · ESPERANDO_AUTORIZACION 5 · REPARACION 8
     LISTO sin facturar 3 · LISTO facturado sin pagos 4 · LISTO con pago parcial 6 · ENTREGADO 22 */
USE TechCareDB;
GO
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

IF NOT EXISTS(SELECT 1 FROM dbo.Compra WHERE Estado='RECIBIDA')
    THROW 59020, N'Falta ejecutar 03_inventario_semilla.sql.', 1;
IF EXISTS(SELECT 1 FROM dbo.OrdenServicio)
    THROW 59021, N'Ya existen ordenes; este script no se ejecuta dos veces.', 1;

DECLARE @FechasVariadas BIT = 1;

DECLARE @Recep1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='recep1'),
        @Recep2 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='recep2'),
        @Tec1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='tecnico1'),
        @Tec2 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='tecnico2'),
        @TecAdm INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='admintec'),
        @Caja1 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='caja1'),
        @Caja2 INT=(SELECT IdUsuario FROM dbo.Usuario WHERE NombreUsuario='caja2'),
        @B1 INT=(SELECT IdBodega FROM dbo.Bodega WHERE Codigo='BOD-01'),
        @B2 INT=(SELECT IdBodega FROM dbo.Bodega WHERE Codigo='BOD-02');

/* ---- Plan: estado objetivo de cada orden. Seq 1-45 = primera orden de cada equipo;
        46-47 = 2a y 3a orden del equipo 1; 48-60 = 2a orden de los equipos 2 a 14.
        Las primeras ordenes de los equipos 1-14 terminan ENTREGADO/CANCELADO, porque
        un equipo solo puede tener una orden abierta. ---- */
CREATE TABLE #Plan(Seq INT NOT NULL PRIMARY KEY, Target VARCHAR(15) NOT NULL);
INSERT #Plan(Seq,Target) VALUES
 (1,'ENTREGADO'),(2,'ENTREGADO'),(3,'CANCEL_REC'),(4,'ENTREGADO'),(5,'ENTREGADO'),
 (6,'ENTREGADO'),(7,'ENTREGADO'),(8,'CANCEL_DIAG'),(9,'ENTREGADO'),(10,'ENTREGADO'),
 (11,'ENTREGADO'),(12,'ENTREGADO'),(13,'ENTREGADO'),(14,'ENTREGADO'),(15,'ENTREGADO'),
 (16,'RECIBIDO'),(17,'DIAGNOSTICO'),(18,'ESPERANDO'),(19,'REPARACION'),(20,'LISTO'),
 (21,'FACT'),(22,'PARCIAL'),(23,'ENTREGADO'),(24,'RECIBIDO'),(25,'ESPERANDO'),
 (26,'REPARACION'),(27,'PARCIAL'),(28,'ENTREGADO'),(29,'REPARACION'),(30,'CANCEL_REC'),
 (31,'FACT'),(32,'ESPERANDO'),(33,'PARCIAL'),(34,'ENTREGADO'),(35,'REPARACION'),
 (36,'RECIBIDO'),(37,'LISTO'),(38,'REPARACION'),(39,'DIAGNOSTICO'),(40,'PARCIAL'),
 (41,'ENTREGADO'),(42,'ESPERANDO'),(43,'REPARACION'),(44,'FACT'),(45,'ENTREGADO'),
 (46,'ENTREGADO'),(47,'PARCIAL'),(48,'ENTREGADO'),(49,'ENTREGADO'),(50,'ENTREGADO'),
 (51,'RECIBIDO'),(52,'RECIBIDO'),(53,'RECIBIDO'),(54,'CANCEL_ESP'),(55,'ESPERANDO'),
 (56,'REPARACION'),(57,'REPARACION'),(58,'LISTO'),(59,'FACT'),(60,'PARCIAL');

DECLARE @Seq INT=1,@Max INT=60;
DECLARE @Target VARCHAR(15),@EqNum INT,@IdEquipo INT,@IdCliente INT,@Tipo VARCHAR(60),@v INT;
DECLARE @Recep INT,@Tec INT,@Caja INT,@Entrega INT,@IdPrioridad INT;
DECLARE @IdOrden INT,@IdDiag INT,@IdRep INT,@IdRep2 INT,@IdAct INT,@IdCons INT,@IdFac INT,@IdPago INT,@Metodo INT;
DECLARE @Total DECIMAL(12,2),@Mon DECIMAL(12,2),@Saldo DECIMAL(12,2),@Costo DECIMAL(12,2);
DECLARE @Doc VARCHAR(30);
DECLARE @Prob VARCHAR(1000),@Diag VARCHAR(1000),@RepDesc VARCHAR(1000),@Obs VARCHAR(500),@Ref VARCHAR(60),@Nombre VARCHAR(150);
DECLARE @NReps INT,@p INT,@bod INT,@repu INT,@cant INT,@Num VARCHAR(20),@N BIGINT,@Ingreso DATETIME2(0),@Est DATE;

WHILE @Seq<=@Max
BEGIN
  SELECT @Target=Target FROM #Plan WHERE Seq=@Seq;
  SET @EqNum=CASE WHEN @Seq<=45 THEN @Seq WHEN @Seq IN(46,47) THEN 1 ELSE @Seq-46 END;
  SELECT @IdEquipo=e.IdEquipo,@IdCliente=e.IdCliente,@Tipo=t.Nombre
  FROM dbo.Equipo e JOIN dbo.TipoEquipo t ON t.IdTipoEquipo=e.IdTipoEquipo
  WHERE e.NumeroSerie=CONCAT('TC-SN-',RIGHT(CONCAT('0000',@EqNum),4));
  IF @IdEquipo IS NULL THROW 59022, N'No se encontro el equipo del plan; revisar 02_maestros_semilla.sql.', 1;

  SET @v=@Seq%4;
  SET @Recep=CASE WHEN @Seq%2=0 THEN @Recep2 ELSE @Recep1 END;
  SET @Tec=CASE @Seq%3 WHEN 0 THEN @Tec1 WHEN 1 THEN @Tec2 ELSE @TecAdm END;
  SET @Caja=CASE WHEN @Seq%2=0 THEN @Caja2 ELSE @Caja1 END;
  SET @Costo=100+25*(@Seq%9);
  SET @IdRep2=NULL; SET @IdFac=NULL;
  SELECT @IdPrioridad=IdPrioridad FROM dbo.Prioridad WHERE Codigo=CHOOSE(@Seq%4+1,'BAJA','NORMAL','ALTA','URGENTE');

  SET @Prob=CASE @Tipo
    WHEN 'Laptop' THEN CHOOSE(@v+1,'No enciende','Pantalla con lineas horizontales','La bateria no carga','Teclado con teclas sin respuesta')
    WHEN 'Computadora de escritorio' THEN CHOOSE(@v+1,'No inicia el sistema operativo','Se apaga sola al cabo de unos minutos','Ruido fuerte del ventilador','Disco lento y mensajes de error')
    WHEN 'Impresora' THEN CHOOSE(@v+1,'No imprime','Atasca el papel','Impresiones con manchas','No reconoce los cartuchos')
    WHEN 'Equipo de red' THEN CHOOSE(@v+1,'Sin conexion de red','Se reinicia constantemente','Puertos sin respuesta','Senal WiFi intermitente')
    WHEN 'Monitor' THEN CHOOSE(@v+1,'Sin imagen','Parpadeo constante','Lineas verticales en pantalla','No enciende')
    ELSE CHOOSE(@v+1,'Reinicios inesperados','Alertas de disco','Sobrecalentamiento','No arranca') END;
  SET @Obs=CASE WHEN @Seq%5=0 THEN 'Cliente solicita llamada antes de reparar' END;
  SET @Diag=CONCAT('Revision completa: ',CHOOSE(@v+1,
    'falla localizada en modulo principal; requiere cambio de componente',
    'desgaste de pieza; se recomienda reemplazo y pruebas',
    'acumulacion de polvo y componente danado; limpieza y cambio',
    'falla intermitente confirmada; se reemplaza pieza y se calibra'));
  SET @RepDesc=CHOOSE(@v+1,'Reemplazo de componente y pruebas','Reparacion de modulo y calibracion',
    'Limpieza interna y cambio de pieza','Mantenimiento correctivo y verificacion');

  /* ---- 1. Ingreso ---- */
  IF @FechasVariadas=1
  BEGIN
    SET @Ingreso=DATEADD(HOUR,9+(@Seq%8),CONVERT(DATETIME2(0),CONVERT(DATE,DATEADD(DAY,-(61-@Seq),SYSUTCDATETIME()))));
    SET @Est=CONVERT(DATE,DATEADD(DAY,5,@Ingreso));
    SET @N=NEXT VALUE FOR dbo.seq_NumeroOrden;
    SET @Num=CONCAT('OS-',YEAR(@Ingreso),'-',CASE WHEN @N<1000000 THEN RIGHT(CONCAT('000000',@N),6) ELSE CONVERT(VARCHAR(10),@N) END);
    INSERT dbo.OrdenServicio(NumeroOrden,IdEquipo,IdUsuarioRecepcion,FechaIngreso,ProblemaReportado,IdPrioridad,IdEstadoOrden,FechaEstimada,Observaciones)
    SELECT @Num,@IdEquipo,@Recep,@Ingreso,@Prob,@IdPrioridad,eo.IdEstadoOrden,@Est,@Obs
    FROM dbo.EstadoOrden eo WHERE eo.Codigo='RECIBIDO';
    SET @IdOrden=CONVERT(INT,SCOPE_IDENTITY());
  END
  ELSE
  BEGIN
    SET @Est=CONVERT(DATE,DATEADD(DAY,-6+5,SYSUTCDATETIME()));
    EXEC dbo.sp_RegistrarOrdenServicio @IdCliente=@IdCliente,@IdEquipo=@IdEquipo,@IdUsuarioRecepcion=@Recep,
         @IdPrioridad=@IdPrioridad,@ProblemaReportado=@Prob,@FechaEstimada=@Est,@Observaciones=@Obs,@IdOrden=@IdOrden OUTPUT;
  END;

  /* ---- 2. Avance segun el estado objetivo ---- */
  IF @Target='CANCEL_REC'
    EXEC dbo.sp_CambiarEstadoOrden @IdOrden,'CANCELADO',@Recep,'Cliente desiste antes del diagnostico';
  ELSE IF @Target IN('DIAGNOSTICO','CANCEL_DIAG')
  BEGIN
    EXEC dbo.sp_CambiarEstadoOrden @IdOrden,'DIAGNOSTICO',@Recep,'Se asigna a diagnostico';
    IF @Target='CANCEL_DIAG'
      EXEC dbo.sp_CambiarEstadoOrden @IdOrden,'CANCELADO',@Recep,'Cliente cancela durante el diagnostico';
  END
  ELSE IF @Target<>'RECIBIDO'
  BEGIN
    EXEC dbo.sp_RegistrarDiagnostico @IdOrden=@IdOrden,@IdTecnico=@Tec,@Descripcion=@Diag,
         @CostoManoObraEstimado=@Costo,@IdDiagnostico=@IdDiag OUTPUT;

    IF @Target='CANCEL_ESP'
      EXEC dbo.sp_CambiarEstadoOrden @IdOrden,'CANCELADO',@Recep,'Cliente rechaza el presupuesto';
    ELSE IF @Target<>'ESPERANDO'
    BEGIN
      /* Reparacion + actividades + consumos */
      EXEC dbo.sp_IniciarReparacion @IdOrden=@IdOrden,@IdTecnico=@Tec,@Descripcion=@RepDesc,
           @CostoManoObra=@Costo,@IdReparacion=@IdRep OUTPUT;
      EXEC dbo.usp_RegistrarActividad @IdReparacion=@IdRep,@IdTecnico=@Tec,
           @Descripcion='Desarmado, inspeccion y medicion de componentes',@HorasInvertidas=1.50,@IdActividad=@IdAct OUTPUT;
      IF @Seq%2=1
        EXEC dbo.usp_RegistrarActividad @IdReparacion=@IdRep,@IdTecnico=@Tec,
             @Descripcion='Pruebas de funcionamiento y ajustes finales',@HorasInvertidas=1.00,@IdActividad=@IdAct OUTPUT;

      SET @NReps=@Seq%4; SET @p=1;               -- 0 a 3 repuestos por reparacion
      WHILE @p<=@NReps
      BEGIN
        SET @bod=CASE WHEN (@Seq+@p)%2=0 THEN @B1 ELSE @B2 END;
        SELECT @repu=x.IdRepuesto FROM (
          SELECT IdRepuesto,CONVERT(INT,ROW_NUMBER() OVER(ORDER BY Codigo)) AS rn
          FROM dbo.Repuesto WHERE Codigo NOT IN('REP-005','REP-009','REP-012','REP-020')) x   -- excluye los de escenario
        WHERE x.rn=((@Seq*7+@p*5)%26)+1;
        SET @cant=1+((@Seq+@p)%3);
        EXEC dbo.sp_AsignarRepuestoReparacion @IdReparacion=@IdRep,@IdBodega=@bod,@IdRepuesto=@repu,
             @Cantidad=@cant,@IdUsuario=@Tec,@IdRepuestoReparacion=@IdCons OUTPUT;
        SET @p+=1;
      END;

      IF @Seq=23   -- una orden con DOS reparaciones
        EXEC dbo.sp_IniciarReparacion @IdOrden=@IdOrden,@IdTecnico=@Tec,@Descripcion='Segunda intervencion complementaria',
             @CostoManoObra=75.00,@IdReparacion=@IdRep2 OUTPUT;

      IF @Target<>'REPARACION'
      BEGIN
        EXEC dbo.sp_FinalizarReparacion @IdReparacion=@IdRep,@IdUsuario=@Tec;
        IF @IdRep2 IS NOT NULL EXEC dbo.sp_FinalizarReparacion @IdReparacion=@IdRep2,@IdUsuario=@Tec;

        /* Facturacion, pagos y entrega */
        IF @Target IN('FACT','PARCIAL','ENTREGADO')
        BEGIN
          EXEC dbo.sp_GenerarFactura @IdOrden=@IdOrden,@IdUsuario=@Caja,@IdFactura=@IdFac OUTPUT;
          SELECT @Total=Total FROM dbo.Factura WHERE IdFactura=@IdFac;
          SELECT @Metodo=IdMetodoPago FROM dbo.MetodoPago
           WHERE Codigo=CHOOSE(@Seq%5+1,'EFECTIVO','TARJETA','TRANSFERENCIA','CHEQUE','DEPOSITO');
          SET @Ref=CASE WHEN @Seq%5=0 THEN NULL ELSE CONCAT('REF-',@Seq) END;

          IF @Target='PARCIAL'
          BEGIN
            SET @Mon=CONVERT(DECIMAL(12,2),ROUND(@Total*0.40,2));
            EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@Mon,@IdUsuario=@Caja,@Referencia=@Ref,@IdPago=@IdPago OUTPUT;
            IF @Seq=22   -- un pago anulado y vuelto a registrar
            BEGIN
              EXEC dbo.sp_AnularPago @IdPago=@IdPago,@IdUsuario=@Caja,@Motivo='Pago registrado con monto equivocado';
              EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@Mon,@IdUsuario=@Caja,@Referencia=@Ref,@IdPago=@IdPago OUTPUT;
            END;
            IF @Seq IN(27,47)   -- segundo pago parcial; sigue con saldo
            BEGIN
              SET @Mon=CONVERT(DECIMAL(12,2),ROUND(@Total*0.25,2));
              EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@Mon,@IdUsuario=@Caja,@Referencia=@Ref,@IdPago=@IdPago OUTPUT;
            END;
          END
          ELSE IF @Target='ENTREGADO'
          BEGIN
            IF @Seq%2=0   -- dos pagos: 50% y el saldo exacto
            BEGIN
              SET @Mon=CONVERT(DECIMAL(12,2),ROUND(@Total*0.50,2));
              EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@Mon,@IdUsuario=@Caja,@Referencia=@Ref,@IdPago=@IdPago OUTPUT;
              SET @Saldo=dbo.fn_SaldoFactura(@IdFac);
              EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@Saldo,@IdUsuario=@Caja,@Referencia=@Ref,@IdPago=@IdPago OUTPUT;
            END
            ELSE
              EXEC dbo.sp_RegistrarPago @IdFactura=@IdFac,@IdMetodoPago=@Metodo,@Monto=@Total,@IdUsuario=@Caja,@Referencia=@Ref,@IdPago=@IdPago OUTPUT;

            SET @Entrega=CASE WHEN @Seq%3=0 THEN @Caja ELSE @Recep END;
            SELECT @Nombre=NombreMostrar FROM dbo.Cliente WHERE IdCliente=@IdCliente;
            SET @Doc=CONCAT('DOC-TEST-',RIGHT(CONCAT('000',@Seq),3));
            EXEC dbo.sp_EntregarOrden @IdOrden=@IdOrden,@IdUsuarioEntrega=@Entrega,@NombreRecibe=@Nombre,
                 @DocumentoRecibe=@Doc,@Observaciones='Entrega conforme (dato de prueba)';
          END;
        END;
      END;
    END;
  END;

  IF @Seq%10=0 PRINT CONCAT('Ordenes procesadas: ',@Seq,' de ',@Max);
  SET @Seq+=1;
END;

DROP TABLE #Plan;

SELECT eo.Codigo AS EstadoOrden,COUNT(*) AS Ordenes
FROM dbo.OrdenServicio o JOIN dbo.EstadoOrden eo ON eo.IdEstadoOrden=o.IdEstadoOrden
GROUP BY eo.Codigo,eo.Orden ORDER BY eo.Orden;
GO
