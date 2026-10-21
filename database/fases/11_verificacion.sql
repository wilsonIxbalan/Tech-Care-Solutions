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
