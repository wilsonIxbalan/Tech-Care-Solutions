/* OPCIONAL, SOLO SQL Server local, conectado a master. No ejecutar en Azure.
   No borra ni reutiliza una base existente. Requiere permiso de crear bases. */
IF CONVERT(INT,SERVERPROPERTY('EngineEdition'))=5
    THROW 50092,N'En Azure la base se crea por el portal, no con este archivo.',1;
IF DB_NAME()<>N'master' THROW 50093,N'Para este bootstrap local conectar a master.',1;
IF DB_ID(N'TechCareDB') IS NOT NULL THROW 50094,N'TechCareDB ya existe; no se modifico.',1;
CREATE DATABASE TechCareDB COLLATE Modern_Spanish_CI_AS;
GO
