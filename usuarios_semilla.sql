/* Usuarios sinteticos de prueba. Hashes Argon2id; sin contrasenas. */
USE TechCareDB;
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('admin1','$argon2id$v=19$m=65536,p=4,t=3$A0I2M5BYMV40FdIqw+yvnw$qgjaqhkVL6TW6R1yu1i9PcvzoNn1eWg6sztyIa8BXxc','Admin Prueba Uno','admin1@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='ADMINISTRADOR'
 WHERE u.NombreUsuario='admin1';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('admintec','$argon2id$v=19$m=65536,p=4,t=3$qZP5M+uxR2UAPDVEOFRxmw$t4EeqAyd3lX1Ac2iWQNrpckHHMZ6ELjYYHeiPJso2/g','Admin Tecnico Prueba','admintec@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='ADMINISTRADOR'
 WHERE u.NombreUsuario='admintec';
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='TECNICO'
 WHERE u.NombreUsuario='admintec';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('recep1','$argon2id$v=19$m=65536,p=4,t=3$2K8gPobUZSWOYivMmlNUuw$22nFyxCyW8h2KPYx56m5Mp7foh5SsTKiaBcNB21cwLA','Recepcion Prueba Uno','recep1@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='RECEPCION'
 WHERE u.NombreUsuario='recep1';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('recep2','$argon2id$v=19$m=65536,p=4,t=3$S3o/ffuH9RKzZ5DPIsRbgg$FnnN1tXlLkocQOyuda3kKmskrc9AQKMATuMX6AzpAhA','Recepcion Prueba Dos','recep2@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='RECEPCION'
 WHERE u.NombreUsuario='recep2';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('tecnico1','$argon2id$v=19$m=65536,p=4,t=3$ibMjB4k2wPozqeNhLXXMIw$P3r+iI5x4PuHJXlQKnLSRCatZsD18Tx8w/nViewBPdc','Tecnico Prueba Uno','tecnico1@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='TECNICO'
 WHERE u.NombreUsuario='tecnico1';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('tecnico2','$argon2id$v=19$m=65536,p=4,t=3$ZXuPwSsk3ZN/dmI9vqlLKA$EyT0xNtzb8KsB2YFw4IR9TM6PL64u+5HprF12SSUXDg','Tecnico Prueba Dos','tecnico2@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='TECNICO'
 WHERE u.NombreUsuario='tecnico2';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('bodega1','$argon2id$v=19$m=65536,p=4,t=3$/HI2aWz69UG6vBXY5J1KIQ$FQviZUu2BCnf2EdS0wTI68wCPLohcKMmFEErYuIaF00','Bodega Prueba Uno','bodega1@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='BODEGA'
 WHERE u.NombreUsuario='bodega1';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('bodega2','$argon2id$v=19$m=65536,p=4,t=3$EqluzJLG8CWTpMLZdYjV0w$AdkJTvq53fIQrv8jGU9BkeqcCFWrWxQfbUJtrJ4ZbrY','Bodega Prueba Dos','bodega2@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='BODEGA'
 WHERE u.NombreUsuario='bodega2';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('caja1','$argon2id$v=19$m=65536,p=4,t=3$k1MPiN/sbc1r7APqASkPOw$G4SOpFBtxeZJ8aIF08PhcjjRvYT9ZjNEKo8D4/YgjUc','Caja Prueba Uno','caja1@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='CAJA'
 WHERE u.NombreUsuario='caja1';
INSERT dbo.Usuario(NombreUsuario,PasswordHash,NombreCompleto,Email)
 VALUES('caja2','$argon2id$v=19$m=65536,p=4,t=3$Eaa3Og5FdEh0YGTEpA5h9g$pg219lIDa7wD2cqau8ScpMyEXqUd/uG2vCzmCfDGi7U','Caja Prueba Dos','caja2@techcare.test');
INSERT dbo.UsuarioRol(IdUsuario,IdRol)
 SELECT u.IdUsuario,r.IdRol FROM dbo.Usuario u JOIN dbo.Rol r ON r.Codigo='CAJA'
 WHERE u.NombreUsuario='caja2';
COMMIT TRANSACTION;
GO
