/* Bootstrap MANUAL e independiente. No incluir en TechCare_Master/Local ni al iniciar API.
   Conectar expresamente a TechCareDB; ejecutar con cliente que se detenga al error.
   Sustituir placeholders SOLO localmente. Nunca guardar passwords ni hashes reales en git.
   Generar hash Argon2id: pnpm --filter @techcare/api password:hash (entrada oculta).
   No ejecutado por la implementación. No crea roles ni cambia permisos SQL. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

IF DB_NAME() <> N'TechCareDB'
    THROW 50090, N'Bootstrap permitido solamente conectado a TechCareDB.', 1;
IF @@TRANCOUNT <> 0
    THROW 50089, N'Finalizar la transacción existente antes de ejecutar este bootstrap.', 1;

DECLARE @Usuario VARCHAR(MAX) = '<USUARIO_INICIAL>';
DECLARE @Correo VARCHAR(MAX) = '<CORREO_INICIAL>';
DECLARE @Nombre VARCHAR(MAX) = '<NOMBRE_COMPLETO_INICIAL>';
DECLARE @Hash VARCHAR(MAX) = '<HASH_ARGON2ID_GENERADO_LOCALMENTE>';
-- Cambiar a 1 SOLO si la persona elige explícitamente también ser técnico.
DECLARE @AgregarTecnico BIT = 0;

IF @Usuario LIKE '%<%' OR @Correo LIKE '%<%' OR @Nombre LIKE '%<%' OR @Hash LIKE '%<%'
    THROW 50091, N'Sustituir todos los placeholders antes de ejecutar.', 1;
IF DATALENGTH(@Usuario) NOT BETWEEN 1 AND 50 OR @Usuario <> LTRIM(RTRIM(@Usuario))
   OR @Usuario LIKE '%[@ ' + CHAR(9) + CHAR(10) + CHAR(13) + ']%'
    THROW 50092, N'Usuario inválido: máximo 50 caracteres, sin arroba ni espacios.', 1;
IF DATALENGTH(@Correo) NOT BETWEEN 3 AND 120 OR @Correo NOT LIKE '%_@_%._%'
   OR @Correo LIKE '%@%@%' OR @Correo LIKE '%[ ' + CHAR(9) + CHAR(10) + CHAR(13) + ']%'
    THROW 50093, N'Proporcionar un correo válido de máximo 120 caracteres.', 1;
IF DATALENGTH(@Nombre) NOT BETWEEN 1 AND 150 OR LEN(LTRIM(RTRIM(@Nombre))) = 0
    THROW 50094, N'Proporcionar un nombre completo de máximo 150 caracteres.', 1;
IF DATALENGTH(@Hash) NOT BETWEEN 40 AND 255 OR @Hash NOT LIKE '$argon2id$v=19$m=%$%$%'
    THROW 50095, N'Proporcionar exclusivamente un hash Argon2id generado localmente.', 1;

SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @Admin INT, @Tecnico INT, @IdUsuario INT;
    -- Mismo mutex de las escrituras API, antes de leer usuarios/membresías.
    SELECT @Admin = IdRol FROM dbo.Rol WITH (UPDLOCK, HOLDLOCK)
        WHERE Codigo = 'ADMINISTRADOR' AND Activo = 1;
    IF @Admin IS NULL
        THROW 50096, N'El rol ADMINISTRADOR debe existir y estar activo.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Usuario u JOIN dbo.UsuarioRol ur ON ur.IdUsuario = u.IdUsuario
               WHERE u.Activo = 1 AND ur.IdRol = @Admin)
        THROW 50097, N'Ya existe un administrador activo. No se modifica ningún dato.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE NombreUsuario IN (@Usuario, @Correo) OR Email IN (@Usuario, @Correo))
        THROW 50098, N'El identificador o correo ya pertenece a una cuenta. Revisar manualmente.', 1;
    IF @AgregarTecnico = 1
    BEGIN
        SELECT @Tecnico = IdRol FROM dbo.Rol WHERE Codigo = 'TECNICO' AND Activo = 1;
        IF @Tecnico IS NULL
            THROW 50099, N'El rol TECNICO elegido debe existir y estar activo.', 1;
    END;

    INSERT dbo.Usuario (NombreUsuario, PasswordHash, NombreCompleto, Email, Activo)
        VALUES (@Usuario, @Hash, @Nombre, @Correo, 1);
    SET @IdUsuario = CONVERT(INT, SCOPE_IDENTITY());
    INSERT dbo.UsuarioRol (IdUsuario, IdRol) VALUES (@IdUsuario, @Admin);
    IF @AgregarTecnico = 1
        INSERT dbo.UsuarioRol (IdUsuario, IdRol) VALUES (@IdUsuario, @Tecnico);
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
