# Guía de pruebas manuales del backend TechCare

Referencia: rutas de `analisis/06-endpoints.md`, reportes de `analisis/16-reportes.md`, DTO implementados en `apps/api/src/modules` y SQL de `database/fases`. La autenticación acordada es JWT en **cookie HttpOnly**, sustituyendo la propuesta antigua de Bearer. Esta guía describe qué ejecutar tú; no es evidencia de pruebas realizadas contra SQL.

## 1. Qué SQL ejecutar

Ejecuta la instalación con tu cuenta administradora de SQL Server desde tu equipo. Docker Compose solo ejecuta NestJS: **no crea ni importa SQL Server**.

### Caso A: todavía no existe TechCareDB

Desde la raíz del repositorio:

```powershell
sqlcmd -S localhost -E -b -i database/TechCare_Local.sql
```

[TechCare_Local.sql](../../database/TechCare_Local.sql) hace todo esto: conecta a `master`, crea `TechCareDB`, cambia a esa base e instala las fases 01–11. No ejecutes después `TechCare_Master.sql` ni las fases otra vez.

`-E` usa tu autenticación de Windows para instalar; `-b` detiene la ejecución si hay un error. Sustituye `localhost` por tu instancia real, por ejemplo `localhost\SQLEXPRESS`. Si tu cliente local rechaza el certificado autofirmado, puedes agregar `-C` **solo para esta conexión local**.

### Caso B: ya creaste la base, pero está vacía

```powershell
sqlcmd -S localhost -E -b -d TechCareDB -i database/TechCare_Master.sql
```

[TechCare_Master.sql](../../database/TechCare_Master.sql) instala las mismas fases dentro de una base ya creada y vacía. No crea la base ni cambia su nombre. Si tu base se llama de otra manera, cambia `-d` y `DB_NAME` en el `.env`.

### Caso C: la base ya tiene tablas o datos

No vuelvas a ejecutar ninguno de los dos instaladores completos. No son migraciones ni reinicios de datos. Confirma con Angela/Wilson qué fases están aplicadas; los scripts de instalación inicial no sirven para actualizar una base existente.

### Alternativa en SSMS

Abre el instalador que corresponda. Activa **Consulta → Modo SQLCMD** y agrega al principio, en esa ventana:

```sql
:ON ERROR EXIT
```

Ejecuta el archivo completo. Para `TechCare_Master.sql`, selecciona previamente la base vacía correcta. Detenerse al primer error importa porque los archivos contienen varios bloques separados por `GO`.

### Qué contiene cada fase

Los maestros anteriores ya incluyen las fases; esta tabla sirve para entenderlas. Solo si eliges instalarlas por separado, ejecútalas una vez, en este orden y dentro de una base vacía:

| Fase | Archivo | Contenido |
| --- | --- | --- |
| 01 | `database/fases/01_tablas.sql` | Las 33 tablas y sus restricciones básicas. |
| 02 | `database/fases/02_relaciones.sql` | Claves foráneas. |
| 03 | `database/fases/03_indices_secuencias_tipos.sql` | Índices, secuencias y TVP de compras. |
| 04 | `database/fases/04_funciones.sql` | Permisos, saldos, totales e historial. |
| 05 | `database/fases/05_vistas.sql` | Lecturas consumidas por la API. |
| 06 | `database/fases/06_catalogos.sql` | Roles, permisos, estados, prioridades, marcas, tipos, categorías y métodos de pago. |
| 07 | `database/fases/07_procedimientos.sql` | Procesos transaccionales. |
| 08 | `database/fases/08_triggers.sql` | Protecciones de integridad y auditoría. |
| 09 | `database/fases/09_reportes.sql` | Los doce reportes. |
| 10 | `database/fases/10_permisos.sql` | Roles SQL `tc_runtime` y `tc_lectura`; no crea logins ni usuarios. |
| 11 | `database/fases/11_verificacion.sql` | Verificación estructural; no prueba endpoints ni crea datos de negocio. |

`database/00_preparacion/00_crear_bd_local.sql` solo crea la base local; ya está incluido en `TechCare_Local.sql`. No lo ejecutes antes del instalador local completo, porque este último espera que la base aún no exista.

Al terminar tendrás catálogos, pero **ningún usuario de aplicación, cliente, equipo, bodega, repuesto, orden o compra**. Los prepararemos a continuación.

## 2. Preparar acceso SQL y primer usuario de aplicación

Hay dos credenciales diferentes:

| Credencial | Para qué sirve | Dónde se configura |
| --- | --- | --- |
| Login SQL, por ejemplo `techcare_api_local` | NestJS se conecta al motor de BD. | `DB_USER` y `DB_PASSWORD` en `.env`. |
| Usuario de aplicación, por ejemplo `admin.local` | Iniciar sesión por `/auth/login`. | Tabla `dbo.Usuario`, con hash Argon2id y roles de aplicación. |

### 2.1 Cuenta SQL de la API

Si Angela/Wilson ya la prepararon, usa esa cuenta. Si no, un administrador puede crear un **login de autenticación SQL** desde SSMS → Seguridad → Inicios de sesión. Debe tener un usuario asociado en `TechCareDB` y pertenecer al rol de base `tc_runtime`; no necesita `db_owner`.

Si el login `techcare_api_local` ya existe en el servidor pero aún no está asociado a la base, estos son los comandos de asociación para el administrador:

```sql
USE TechCareDB;
GO
CREATE USER [techcare_api_local] FOR LOGIN [techcare_api_local];
ALTER ROLE [tc_runtime] ADD MEMBER [techcare_api_local];
GO
```

No repitas `CREATE USER` si el usuario ya existe. Si haces la asociación mediante la pantalla de SSMS, no necesitas ejecutar ese bloque. La fase 10 hace que `tc_runtime` herede también los accesos de reportes de `tc_lectura`.

La API usa usuario/contraseña SQL, no la sesión de Windows. Para entrar desde Docker, habilita TCP/IP, configura un puerto TCP fijo —el ejemplo usa `1433`— y comprueba que el servidor permite autenticación SQL. Si cambias estas opciones, puede ser necesario reiniciar el servicio de SQL Server. La instancia nombrada usada por SSMS se traduce a **host y puerto TCP** en `.env`.

### 2.2 Generar el hash de la contraseña del administrador

Con Node 24 y las dependencias instaladas, desde la raíz:

```powershell
pnpm --filter @techcare/api password:hash
```

Escribe una contraseña propia de 12–128 caracteres. La entrada está oculta. Copia el hash que comienza con `$argon2id$`; conserva la contraseña para el login. Este comando no conecta a SQL ni crea usuarios.

### 2.3 Crear el primer administrador

Este bloque es una **preparación manual inicial**, para que lo ejecute quien administra tu BD local. Si ya tienes un administrador, no lo necesitas. Sustituye únicamente el marcador del hash; no pegues la contraseña en claro.

Se asignan `ADMINISTRADOR` y `TECNICO` al usuario de laboratorio para recorrer todos los procesos con una sola sesión. `ADMINISTRADOR` por sí solo no puede diagnosticar ni iniciar reparaciones: el SQL exige además `TECNICO`.

```sql
USE TechCareDB;
GO
SET XACT_ABORT ON;
DECLARE @Hash VARCHAR(255) = '<PEGAR_HASH_ARGON2ID_GENERADO>';

IF @Hash NOT LIKE '$argon2id$%' OR LEN(@Hash) < 40
    THROW 50000, N'Reemplazar el marcador por un hash Argon2id valido.', 1;
IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE NombreUsuario = 'admin.local')
    THROW 50000, N'El usuario ya existe. Usar el usuario existente.', 1;
IF (SELECT COUNT(*) FROM dbo.Rol WHERE Codigo IN ('ADMINISTRADOR','TECNICO') AND Activo = 1) <> 2
    THROW 50000, N'Faltan los roles activos de la fase 06.', 1;

BEGIN TRY
    BEGIN TRANSACTION;
    INSERT dbo.Usuario (NombreUsuario,PasswordHash,NombreCompleto,Email,Activo)
    VALUES ('admin.local',@Hash,'Administrador Local','admin.local@example.test',1);

    DECLARE @IdUsuario INT = CONVERT(INT,SCOPE_IDENTITY());
    INSERT dbo.UsuarioRol (IdUsuario,IdRol)
    SELECT @IdUsuario,IdRol FROM dbo.Rol
    WHERE Codigo IN ('ADMINISTRADOR','TECNICO') AND Activo = 1;

    COMMIT TRANSACTION;
    SELECT IdUsuario,NombreUsuario,NombreCompleto,Activo
    FROM dbo.Usuario WHERE IdUsuario = @IdUsuario;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
```

El resto de usuarios se puede crear mediante `POST /usuarios`. No hay registro público.

## 3. Configurar y levantar la API

Completa [apps/api/.env.example](../../apps/api/.env.example) en el archivo local `apps/api/.env`. Si el `.env` ya existe, conserva sus valores y completa los faltantes.

```dotenv
NODE_ENV=development
API_PORT=3000
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:3000
DB_SERVER=host.docker.internal
DB_PORT=1433
DB_NAME=TechCareDB
DB_USER=techcare_api_local
DB_PASSWORD=<TU_PASSWORD_SQL_LOCAL>
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
JWT_SECRET=<SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES>
JWT_EXPIRES_IN=1h
```

Los valores entre `<...>` son marcadores: debes reemplazarlos. Puedes generar tú mismo el secreto con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

No compartas el `.env`. Si una contraseña contiene `$` o `#`, utiliza comillas simples en su valor de `.env` para conservarla literalmente al cargarla con Compose.

Con Docker Desktop activo, desde la raíz:

```powershell
cd apps/api
docker compose up --build
```

URLs predeterminadas:

| Uso | URL |
| --- | --- |
| Base de endpoints | `http://localhost:3000/api/v1` |
| Swagger | `http://localhost:3000/docs` |
| OpenAPI JSON | `http://localhost:3000/docs-json` |

Para ver errores de arranque: `docker compose logs -f api`, desde `apps/api`. Después de cambiar `.env`, vuelve a ejecutar `docker compose up -d --force-recreate`; un simple `restart` no recarga las variables del contenedor.

Si ejecutas NestJS fuera de Docker: usa Node 24, `pnpm install` y `pnpm dev:api` desde la raíz; cambia `DB_SERVER=localhost` y configura el puerto TCP real. Si cambias `API_PORT` de Compose, ajusta las URLs y el origen de Swagger en `FRONTEND_ORIGIN`.

Azure no se usa en este recorrido. Cuando se configure, cambiarán servidor/credenciales y `DB_TRUST_SERVER_CERTIFICATE=false`; `DB_ENCRYPT` seguirá en `true`.

## 4. Cómo enviar peticiones

### Postman

1. Crea un entorno local y define las variables de la tabla siguiente. No compartas valores de contraseñas.
2. En Authorization selecciona **No Auth**. No envíes Bearer.
3. En cada POST/PATCH elige Body → raw → JSON y añade estos headers:

```http
Content-Type: application/json
Origin: http://localhost:5173
```

4. Opcionalmente envía `Accept: application/json` y `X-Request-Id` con 8–80 letras, números, `_` o `-`.
5. Inicia sesión. Postman debe conservar la cookie `techcare_session` y enviarla en las siguientes peticiones al mismo host. Usa siempre `localhost`, sin alternar con `127.0.0.1`.
6. Los GET no llevan body. Sus filtros se agregan en Params o en la URL.

| Variable | Valor / de dónde obtenerlo |
| --- | --- |
| `baseUrl` | `http://localhost:3000/api/v1` |
| `passwordAdmin` | Contraseña que usaste para generar el hash inicial. |
| `passwordTecnico` | Contraseña nueva propia de 12–128 caracteres, para el usuario secundario. |
| `idTecnico` | `data.idUsuario` de `/auth/me` para el administrador-técnico de este recorrido. |
| `idTipoEquipo`, `idMarca`, `idPrioridad`, `idCategoria`, `idMetodoPago` | IDs de `GET /catalogos`; elige Laptop, una marca, NORMAL, Almacenamiento y EFECTIVO. |
| `idCliente`, `idEquipo`, `idBodega`, `idRepuesto`, `idProveedor` | Copia el ID de la respuesta de cada POST de mantenimiento. |
| `idCompra`, `idOrden`, `idReparacion`, `idFactura`, `idPago` | Copia el ID de la respuesta de la acción correspondiente. |
| `idUsuarioNuevo` | ID del usuario secundario creado por `/usuarios`. |
| `idTipoNuevo`, `idMarcaNueva`, `idCategoriaNueva`, `idMetodoNuevo` | IDs de los catálogos adicionales que crees para probar sus PATCH. |
| `idOrdenCancelacion` | ID de una segunda orden destinada a probar cancelación. |
| `fechaDesde`, `fechaHasta` | Días que cubran tus operaciones, por ejemplo `2000-01-01` y `2099-12-31` para este laboratorio pequeño. |

`{{variable}}` es sintaxis de Postman. Los IDs están **sin comillas** en los bodies porque deben ser números después de sustituir la variable. Configura las variables antes de enviar; no asumas que todos los IDs son 1.

### Swagger

También puedes usar Try it out. Abre Swagger en `localhost:3000`, autoriza ese origen en `.env`, ejecuta login y conserva la cookie del navegador. No necesitas pegar el JWT en Authorize. En los ejemplos sustituye las variables `{{...}}` manualmente por valores reales: Swagger no interpola variables de Postman.

### Reglas de datos

- Envía dinero y horas como **strings** con dos decimales: `"100.00"`, `"1.50"`. El IVA es `"12.00"`.
- IDs y cantidades son enteros JSON positivos; stock mínimo permite 0. Booleanos del body son `true`/`false`, sin comillas.
- En query usa `activo=true`, `bajoMinimo=true`, etc.; no `1`, `yes` ni valores vacíos.
- No envíes `idUsuario`, `idTecnico`, precios de consumo, fechas automáticas o totales calculados en los bodies. El actor se toma de la sesión.
- En PATCH, omitir un campo conserva su valor; `null` solo limpia campos nullable. No envíes `{}` para un PATCH.
- Los textos obligatorios no admiten espacios vacíos. Las contraseñas no se recortan ni normalizan.
- Los filtros de fecha son días inclusivos de Guatemala, `YYYY-MM-DD`. Los eventos devueltos son instantes ISO UTC.
- Códigos, NIT, serie, username y correo de los ejemplos deben ser únicos cuando corresponda. Si repites el recorrido, usa un sufijo nuevo.

### Respuestas generales

```json
{"data":{"idCliente":1}}
```

Las listas devuelven `data: []` y `meta`. Todas aceptan `page` (default 1), `pageSize` (default 20, máximo 100) y `search` cuando se indica. Ejemplo:

```json
{"data":[],"meta":{"page":1,"pageSize":20,"total":0,"totalPages":0}}
```

Las colecciones pequeñas de catálogos no llevan paginación. Los históricos y la trazabilidad son objetos completos, no listas paginadas.

## 5. Disponibilidad y sesión

| Método y ruta | Qué enviar | Resultado esperado |
| --- | --- | --- |
| `GET {{baseUrl}}/health` | Sin body ni cookie. | 200, `data.status = "ok"`; no consulta SQL. |
| `POST {{baseUrl}}/auth/login` | JSON siguiente, Origin y Content-Type. | 200, cookie + usuario y permisos. |
| `GET {{baseUrl}}/auth/me` | Cookie de login; sin body. | 200, usuario actual sin contraseña ni hash. |
| `GET {{baseUrl}}/ready` | Cookie; sin body. | 200 si puede consultar SQL; 503 si no está disponible. |
| `POST {{baseUrl}}/auth/logout` | JSON `{}`, Origin y Content-Type. | 200, borra cookie; permite cerrar una sesión expirada. |

Body de login:

```json
{"nombreUsuario":"admin.local","password":"{{passwordAdmin}}"}
```

Respuesta de login: `data = {usuario, expiresIn: 3600}`. El JWT no aparece en JSON. Guarda `usuario.idUsuario` como `idTecnico` si estás usando el administrador-técnico del laboratorio.

Haz logout al terminar el recorrido. Si lo pruebas ahora, vuelve a iniciar sesión antes de continuar. Tras logout, `/auth/me` debe devolver 401. La cookie dura una hora; si expira durante las pruebas, inicia sesión otra vez.

## 6. Catálogos y usuarios

### 6.1 Consultar los catálogos iniciales

```http
GET {{baseUrl}}/catalogos
```

Requiere sesión. Devuelve `tiposEquipo`, `marcas`, `prioridades`, `estadosOrden`, `categoriasRepuesto`, `metodosPago`, `tiposMovimiento`, `roles` y `tecnicos` dentro de `data`.

Cada elemento usa `id`, no `idMarca` o `idCategoria`. Selecciona los IDs para las variables indicadas en la sección 4. Un técnico del catálogo debe ser usuario activo con rol TECNICO activo.

### 6.2 Mantenimiento de los cuatro catálogos

Estas rutas requieren ADMINISTRADOR. No existen endpoints para editar roles, permisos, prioridades o transiciones.

| Recurso | Lista | Crear | Actualizar |
| --- | --- | --- | --- |
| Tipos de equipo | `GET /catalogos/tipos-equipo` | `POST /catalogos/tipos-equipo` | `PATCH /catalogos/tipos-equipo/{{idTipoNuevo}}` |
| Marcas | `GET /catalogos/marcas` | `POST /catalogos/marcas` | `PATCH /catalogos/marcas/{{idMarcaNueva}}` |
| Categorías | `GET /catalogos/categorias-repuesto` | `POST /catalogos/categorias-repuesto` | `PATCH /catalogos/categorias-repuesto/{{idCategoriaNueva}}` |
| Métodos de pago | `GET /catalogos/metodos-pago` | `POST /catalogos/metodos-pago` | `PATCH /catalogos/metodos-pago/{{idMetodoNuevo}}` |

Todas las rutas de la tabla se agregan a `{{baseUrl}}`. Los GET no llevan body. POST devuelve 201 con el catálogo creado y su `id`; PATCH devuelve 200 con el actualizado.

Bodies para los POST, respectivamente:

```json
{"nombre":"Equipo laboratorio QA"}
```

```json
{"nombre":"Marca laboratorio QA"}
```

```json
{"nombre":"Categoría laboratorio QA","descripcion":"Datos sintéticos de pruebas manuales"}
```

```json
{"codigo":"PAGO_QA","nombre":"Pago laboratorio QA","activo":true}
```

Bodies para sus PATCH, respectivamente:

```json
{"nombre":"Equipo laboratorio QA actualizado"}
```

```json
{"nombre":"Marca laboratorio QA actualizada"}
```

```json
{"descripcion":"Descripción actualizada"}
```

```json
{"nombre":"Pago QA actualizado","activo":false}
```

Tipo/marca admiten solo `nombre`, máximo 60 caracteres. Categoría admite `nombre` (80) y `descripcion` opcional/nullable (200). Método admite `codigo` (20), `nombre` (60) y `activo` opcional. No uses el método desactivado para los pagos del recorrido: usa EFECTIVO del seed.

### 6.3 Usuarios

Solo ADMINISTRADOR. La contraseña nunca se devuelve.

| Método y ruta | Qué enviar / resultado |
| --- | --- |
| `GET {{baseUrl}}/usuarios?page=1&pageSize=20&search=qa&activo=true` | Sin body; 200 con lista y meta. Filtros adicionales: `activo`. |
| `GET {{baseUrl}}/usuarios/{{idUsuarioNuevo}}` | Sin body; 200 con datos públicos y roles. |
| `POST {{baseUrl}}/usuarios` | Body de creación siguiente; 201. Guarda `idUsuario`. |
| `PATCH {{baseUrl}}/usuarios/{{idUsuarioNuevo}}` | Body parcial siguiente; 200. |

Crear usuario secundario:

```json
{"nombreUsuario":"tecnico.qa","nombreCompleto":"Técnico QA","email":"tecnico.qa@example.test","telefono":"55550101","password":"{{passwordTecnico}}","activo":true,"roles":["TECNICO"]}
```

Editar:

```json
{"nombreCompleto":"Técnico QA actualizado","telefono":null,"roles":["TECNICO","BODEGA"]}
```

Obligatorios al crear: `nombreUsuario` (50), `nombreCompleto` (150), `email` válido (120), `password` (12–128), `roles` como array no vacío de códigos existentes y activos. Opcionales: `telefono` nullable (20), `activo` boolean. En PATCH todos son opcionales; si envías `roles`, reemplazas el conjunto completo. Si envías `password`, se genera un hash nuevo.

Los roles admitidos son ADMINISTRADOR, RECEPCION, TECNICO, BODEGA y CAJA. Para verificar 403, puedes iniciar sesión con el usuario secundario y consultar `/usuarios`; después vuelve a iniciar sesión como administrador. Cada login reemplaza la cookie de ese cliente.

## 7. Clientes, equipos y abastecimiento inicial

### 7.1 Clientes

Escritura: CLIENTES_GESTIONAR. Lectura también para perfiles autorizados de servicio/caja/reportes.

| Método y ruta | Qué enviar / resultado |
| --- | --- |
| `GET {{baseUrl}}/clientes?page=1&pageSize=20&search=Ana&estado=ACTIVO` | Sin body; 200 con lista. Filtro adicional: `estado`. |
| `GET {{baseUrl}}/clientes/{{idCliente}}` | Sin body; 200 con cliente. |
| `POST {{baseUrl}}/clientes` | Body siguiente; 201. Guarda `idCliente`. |
| `PATCH {{baseUrl}}/clientes/{{idCliente}}` | Body parcial siguiente; 200. |

Crear individual:

```json
{"tipoCliente":"INDIVIDUAL","nit":"CF","nombres":"Ana","apellidos":"Prueba","telefono":"55551001","email":"ana.qa@example.test","direccion":"Zona 1, Guatemala","estado":"ACTIVO"}
```

Alternativa empresarial, para un cliente adicional:

```json
{"tipoCliente":"EMPRESARIAL","nit":"QA-EMP-001","razonSocial":"Empresa de prueba QA","nombreContacto":"Contacto QA","telefono":"55551002","email":"empresa.qa@example.test","direccion":null}
```

Editar:

```json
{"telefono":"55551003","email":null,"direccion":"Zona 2, Guatemala"}
```

Obligatorios: `tipoCliente`, `nit` (20), `telefono` (20); individual requiere `nombres` y `apellidos` (100 cada uno), empresa `razonSocial` (150). Opcionales nullable: `nombreContacto` (120), `email` válido (120), `direccion` (250) y los campos de identidad según tipo. Estado opcional ACTIVO/INACTIVO. `CF` permite varios consumidores finales; otro NIT debe ser único.

### 7.2 Equipos

Escritura: EQUIPOS_GESTIONAR. Usa cliente activo y los IDs reales de tipo/marca.

| Método y ruta | Qué enviar / resultado |
| --- | --- |
| `GET {{baseUrl}}/equipos?page=1&pageSize=20&idCliente={{idCliente}}&search=QA&estado=ACTIVO` | Sin body; filtros adicionales `idCliente`, `estado`. |
| `GET {{baseUrl}}/equipos/{{idEquipo}}` | Sin body; detalle. |
| `POST {{baseUrl}}/equipos` | Body siguiente; 201. Guarda `idEquipo`. |
| `PATCH {{baseUrl}}/equipos/{{idEquipo}}` | Body parcial siguiente; 200. |

```json
{"idCliente":{{idCliente}},"idTipoEquipo":{{idTipoEquipo}},"idMarca":{{idMarca}},"modelo":"Laptop QA","numeroSerie":"QA-SERIE-001","descripcion":"Equipo sintético para pruebas","estado":"ACTIVO"}
```

PATCH:

```json
{"modelo":"Laptop QA revisada","descripcion":"Equipo con cargador"}
```

Obligatorios: IDs de cliente/tipo/marca, `modelo` (80), `numeroSerie` única (60), `descripcion` (300). Estado opcional ACTIVO/INACTIVO/BAJA. No cambies el propietario cuando el equipo ya tiene órdenes.

### 7.3 Bodegas

Escritura: BODEGA o ADMINISTRADOR.

| Método y ruta | Qué enviar / resultado |
| --- | --- |
| `GET {{baseUrl}}/bodegas?page=1&pageSize=20&search=QA&estado=ACTIVA` | Sin body; filtro adicional `estado`. |
| `GET {{baseUrl}}/bodegas/{{idBodega}}` | Sin body; detalle. |
| `POST {{baseUrl}}/bodegas` | Body siguiente; 201. Guarda `idBodega`. |
| `PATCH {{baseUrl}}/bodegas/{{idBodega}}` | Body parcial siguiente; 200. |

```json
{"codigo":"BOD-QA-01","nombre":"Bodega QA","ubicacion":"Laboratorio local","estado":"ACTIVA"}
```

PATCH:

```json
{"ubicacion":"Estante A"}
```

Obligatorios: `codigo` único (20), `nombre` (80). Opcionales: `ubicacion` nullable (200), `estado` ACTIVA/INACTIVA. El estado usa ACTIVA, no ACTIVO.

### 7.4 Repuestos

Escritura: BODEGA o ADMINISTRADOR. Lectura también para consumo/compras/reportes autorizados.

| Método y ruta | Qué enviar / resultado |
| --- | --- |
| `GET {{baseUrl}}/repuestos?page=1&pageSize=20&idCategoria={{idCategoria}}&estado=ACTIVO&search=QA` | Sin body; filtros adicionales `idCategoria`, `estado`. |
| `GET {{baseUrl}}/repuestos/{{idRepuesto}}` | Sin body; detalle. |
| `POST {{baseUrl}}/repuestos` | Body siguiente; 201. Guarda `idRepuesto`. |
| `PATCH {{baseUrl}}/repuestos/{{idRepuesto}}` | Body parcial siguiente; 200. |

```json
{"idCategoria":{{idCategoria}},"codigo":"SSD-QA-001","nombre":"SSD de prueba QA","descripcion":"Repuesto sintético","precioCompraReferencia":"150.00","precioVenta":"200.00","estado":"ACTIVO"}
```

PATCH del nombre sin alterar el importe del recorrido:

```json
{"nombre":"SSD QA actualizado","descripcion":null}
```

Para probar actualización de precios y su auditoría, puedes usar:

```json
{"precioCompraReferencia":"150.00","precioVenta":"200.00"}
```

Si cambias el precio de venta a otro importe, cambia también el total esperado del ejemplo financiero. El consumo copia el precio vigente en ese momento; modificarlo después no cambia los históricos.

Obligatorios: `idCategoria`, `codigo` único (30), `nombre` (120), ambos precios. Opcionales: `descripcion` nullable (300), `estado` ACTIVO/INACTIVO. El código del repuesto no se puede cambiar por PATCH con los permisos SQL actuales; no incluyas un código nuevo.

### 7.5 Proveedores

Escritura: PROVEEDORES_GESTIONAR; lectura también para compras/reportes autorizados.

| Método y ruta | Qué enviar / resultado |
| --- | --- |
| `GET {{baseUrl}}/proveedores?page=1&pageSize=20&search=QA&estado=ACTIVO` | Sin body; filtro adicional `estado`. |
| `GET {{baseUrl}}/proveedores/{{idProveedor}}` | Sin body; detalle. |
| `POST {{baseUrl}}/proveedores` | Body siguiente; 201. Guarda `idProveedor`. |
| `PATCH {{baseUrl}}/proveedores/{{idProveedor}}` | Body parcial siguiente; 200. |

```json
{"nit":"QA-PROV-001","nombre":"Proveedor de prueba QA","telefono":"55552001","nombreContacto":"Contacto proveedor","email":"proveedor.qa@example.test","direccion":"Guatemala","estado":"ACTIVO"}
```

PATCH:

```json
{"telefono":"55552002","nombreContacto":null}
```

Obligatorios: `nit` único (20), `nombre` (150), `telefono` (20). Opcionales nullable: `nombreContacto` (120), `email` válido (120), `direccion` (250). Estado ACTIVO/INACTIVO.

## 8. Compras y recepción

Requiere COMPRAS_GESTIONAR. El proveedor, la bodega y el repuesto deben estar activos.

### POST /compras

```http
POST {{baseUrl}}/compras
```

```json
{"idProveedor":{{idProveedor}},"idBodegaDestino":{{idBodega}},"numeroDocumentoProveedor":"FAC-QA-001","observaciones":"Compra de laboratorio","items":[{"idRepuesto":{{idRepuesto}},"cantidad":5,"costoUnitario":"150.00"}]}
```

201: `data = {idCompra, numeroCompra, estado: "PENDIENTE"}`. Guarda `idCompra`. La compra pendiente no aumenta stock. Son obligatorios proveedor, bodega y 1–500 items; cada item requiere repuesto, cantidad entera positiva y costo decimal no negativo. No repitas un repuesto dentro de items. Documento opcional/nullable (40), observaciones opcionales/nullable (500).

### Consultar lista y detalle

```http
GET {{baseUrl}}/compras?page=1&pageSize=20&idProveedor={{idProveedor}}&idBodegaDestino={{idBodega}}&estado=PENDIENTE
GET {{baseUrl}}/compras/{{idCompra}}
```

Sin body. 200. Lista admite también `search`, `fechaDesde`, `fechaHasta`; estados PENDIENTE/RECIBIDA/ANULADA. El detalle incluye `items` y `total` calculado en SQL. Esta compra suma `"750.00"`.

### POST /compras/:id/recibir

```http
POST {{baseUrl}}/compras/{{idCompra}}/recibir
```

```json
{}
```

200: `{idCompra, estado: "RECIBIDA"}` dentro de data. Recibe toda la compra una sola vez. Consulta inventario: si no había existencias previas, tendrá 5 unidades. Repetir esta recepción debe dar 409 y conservar el stock.

## 9. Orden, diagnóstico y reparación

### 9.1 Crear y consultar orden

```http
POST {{baseUrl}}/ordenes
```

```json
{"idCliente":{{idCliente}},"idEquipo":{{idEquipo}},"idPrioridad":{{idPrioridad}},"problemaReportado":"Equipo no enciende","fechaEstimada":null,"observaciones":"Ingreso de prueba con cargador"}
```

Requiere ORDENES_CREAR. 201: `{idOrden, numeroOrden, estado: "RECIBIDO"}`. Guarda `idOrden`. Cliente y equipo deben corresponderse y estar activos; el equipo no puede tener otra orden abierta. `problemaReportado` máximo 1000; observaciones opcionales/nullable máximo 500. Fecha estimada opcional/nullable: si la envías, debe ser un día actual o futuro de Guatemala; `null` evita que el ejemplo caduque.

```http
GET {{baseUrl}}/ordenes?page=1&pageSize=20&idCliente={{idCliente}}&idEquipo={{idEquipo}}&estado=RECIBIDO&idPrioridad={{idPrioridad}}
GET {{baseUrl}}/ordenes/{{idOrden}}
```

Sin body. 200. Lista admite además `search`, `idTecnico`, `fechaDesde`, `fechaHasta`. `idTecnico` busca participación en diagnóstico/reparación. El detalle contiene historial, diagnósticos, reparaciones con actividades/repuestos, factura y entrega; las relaciones sin registros son `[]` o `null` según corresponda.

### 9.2 Cambiar estado a DIAGNOSTICO

```http
POST {{baseUrl}}/ordenes/{{idOrden}}/estado
```

```json
{"estado":"DIAGNOSTICO","observacion":"Equipo asignado para revisión"}
```

RECEPCION, TECNICO o ADMINISTRADOR, con las comprobaciones SQL correspondientes. 200: `{idOrden, estado: "DIAGNOSTICO"}`. La observación es obligatoria y máximo 500.

### 9.3 Registrar diagnóstico

```http
POST {{baseUrl}}/ordenes/{{idOrden}}/diagnostico
```

```json
{"descripcion":"Unidad de almacenamiento defectuosa; requiere reemplazo","costoManoObraEstimado":"100.00"}
```

Requiere DIAGNOSTICO_REGISTRAR **y** rol TECNICO, incluso siendo administrador. No envíes `idTecnico`. 201: `{idDiagnostico, idOrden, estadoOrden: "ESPERANDO_AUTORIZACION"}`. Descripción obligatoria máximo 1000; costo estimado no negativo. Se permite desde RECIBIDO o DIAGNOSTICO y no debe existir otro diagnóstico activo. Si omites el paso 9.2, el SP registra también el paso inicial a DIAGNOSTICO.

### 9.4 Iniciar reparación

```http
POST {{baseUrl}}/ordenes/{{idOrden}}/reparaciones
```

```json
{"descripcion":"Cliente autoriza reemplazo del SSD y reinstalación","costoManoObra":"100.00"}
```

Requiere REPARACION_GESTIONAR y TECNICO. Debe existir diagnóstico activo y orden sin factura, en ESPERANDO_AUTORIZACION o REPARACION. 201: `{idReparacion, idOrden, estado: "EN_PROCESO", estadoOrden: "REPARACION"}`. Guarda `idReparacion`. Descripción obligatoria máximo 1000; costo no negativo. La autorización del cliente se describe en este texto; no hay endpoint adicional de aprobaciones.

### 9.5 Registrar actividad

```http
POST {{baseUrl}}/reparaciones/{{idReparacion}}/actividades
```

```json
{"descripcion":"Revisión, sustitución y verificación de arranque","horasInvertidas":"1.50"}
```

Requiere REPARACION_GESTIONAR y TECNICO; reparación abierta. 201: `{idActividad}`. Descripción obligatoria máximo 500; horas de `"0.01"` a `"999.99"`. No altera automáticamente el costo de mano de obra.

### 9.6 Consumir repuesto

```http
POST {{baseUrl}}/reparaciones/{{idReparacion}}/repuestos
```

```json
{"idBodega":{{idBodega}},"idRepuesto":{{idRepuesto}},"cantidad":1}
```

Requiere REPUESTOS_CONSUMIR; reparación y orden en proceso. 201: `{idRepuestoReparacion, existenciaResultante}`. Si recibiste 5 y no hiciste otros movimientos, queda 4. El precio de venta histórico será `"200.00"`; no lo envíes en el body. Stock, consumo y movimiento se registran atómicamente.

### 9.7 Finalizar reparación

```http
POST {{baseUrl}}/reparaciones/{{idReparacion}}/finalizar
```

```json
{"observacion":"Equipo probado y funcionando"}
```

Requiere REPARACION_GESTIONAR y ser técnico responsable o administrador autorizado. Observación opcional/nullable máximo 500; puedes enviar `{}`. 200: `{idReparacion, estado: "FINALIZADA", estadoOrden}`. Con una sola reparación queda LISTO. Si hay otras abiertas, puede seguir REPARACION: consulta el valor devuelto.

### 9.8 Probar retrabajo antes de facturar

Usa de nuevo `POST /ordenes/{{idOrden}}/estado`, esta vez desde LISTO:

```json
{"estado":"REPARACION","observacion":"Se solicita una revisión adicional antes de facturar"}
```

TECNICO o ADMINISTRADOR, sin factura. 200, estado REPARACION. Para volver a LISTO, crea otra reparación con el endpoint 9.4, pero con `costoManoObra: "0.00"` si deseas mantener el importe del ejemplo; guarda su nuevo ID y finalízala con el endpoint 9.7. No intentes mandar LISTO mediante `/estado`.

### 9.9 Cancelación en una orden separada

Cuando la primera orden ya esté entregada, crea una segunda orden para el mismo equipo y guarda su ID como `idOrdenCancelacion`. Alternativamente usa otro equipo sin orden abierta.

```http
POST {{baseUrl}}/ordenes/{{idOrdenCancelacion}}/estado
```

```json
{"estado":"CANCELADO","observacion":"Cliente cancela antes de iniciar los trabajos"}
```

RECEPCION o ADMINISTRADOR. 200, estado CANCELADO. Usa una orden sin consumo ni factura vigente. Los únicos destinos del endpoint genérico son DIAGNOSTICO, REPARACION para retrabajo y CANCELADO; LISTO/ENTREGADO/ESPERANDO_AUTORIZACION los generan los procesos.

## 10. Inventario y movimientos

### Consultas

```http
GET {{baseUrl}}/inventario?page=1&pageSize=20&idBodega={{idBodega}}&idCategoria={{idCategoria}}&idRepuesto={{idRepuesto}}
GET {{baseUrl}}/inventario/movimientos?page=1&pageSize=20&idBodega={{idBodega}}&idRepuesto={{idRepuesto}}
```

Sin body. 200; lectura para permisos de inventario, consumo, compras o reportes. Inventario admite también `search` y `bajoMinimo=true/false`. Movimientos admite `search`, `codigoTipoMovimiento`, `idUsuario`, `fechaDesde`, `fechaHasta`.

Ejemplo para consultar solo consumos:

```http
GET {{baseUrl}}/inventario/movimientos?codigoTipoMovimiento=CONSUMO_REPARACION&idRepuesto={{idRepuesto}}
```

Tipos válidos del catálogo: COMPRA_ENTRADA, CONSUMO_REPARACION, AJUSTE_ENTRADA y AJUSTE_SALIDA. La existencia resultante pertenece a cada movimiento histórico, no necesariamente al stock actual.

### Cambiar stock mínimo

```http
PATCH {{baseUrl}}/inventario/{{idBodega}}/{{idRepuesto}}/stock-minimo
```

```json
{"stockMinimo":4}
```

Requiere INVENTARIO_GESTIONAR. 200: `{idBodega, idRepuesto, stockMinimo: 4}`. No cambia existencias ni crea movimiento. Con existencia 4 y mínimo 4, `bajoMinimo=true` porque la comparación es **menor o igual**.

### Ajuste de entrada

```http
POST {{baseUrl}}/inventario/ajustes
```

```json
{"idBodega":{{idBodega}},"idRepuesto":{{idRepuesto}},"codigoTipoMovimiento":"AJUSTE_ENTRADA","cantidad":2,"observacion":"Diferencia positiva documentada en conteo de laboratorio"}
```

Requiere INVENTARIO_GESTIONAR. 200: `{idBodega, idRepuesto, existenciaResultante}`. Si había 4, queda 6.

### Ajuste de salida —mismo endpoint—

```json
{"idBodega":{{idBodega}},"idRepuesto":{{idRepuesto}},"codigoTipoMovimiento":"AJUSTE_SALIDA","cantidad":1,"observacion":"Diferencia negativa documentada en conteo de laboratorio"}
```

Si había 6, queda 5. Cantidad entera positiva; observación obligatoria máximo 300. No se permite stock negativo. Prueba estos ajustes después de confirmar las 4 unidades del recorrido principal; de otro modo cambiarán ese resultado esperado. No existe un PATCH libre de existencias.

## 11. Facturación, pagos y entrega

Antes de empezar: orden LISTO, sin factura, reparación finalizada. Con los importes anteriores: mano de obra `"100.00"`, un repuesto `"200.00"`, subtotal `"300.00"`, IVA 12 % `"36.00"`, total `"336.00"`. Si cambiaste cantidades o precios, usa siempre los importes devueltos por SQL.

### 11.1 Vista previa

```http
GET {{baseUrl}}/ordenes/{{idOrden}}/resumen-facturacion?porcentajeImpuesto=12.00
```

Requiere FACTURAR. Sin body. 200 con `subtotalManoObra`, `subtotalRepuestos`, `porcentajeImpuesto`, `impuesto`, `total`. El parámetro es opcional; default 12.00, rango 0.00–100.00. La vista previa no reserva un total: la emisión vuelve a calcularlo.

### 11.2 Emitir factura

```http
POST {{baseUrl}}/ordenes/{{idOrden}}/factura
```

```json
{"nitFacturacion":"CF","nombreFacturacion":"Ana Prueba","direccionFacturacion":"Guatemala","porcentajeImpuesto":"12.00"}
```

FACTURAR. 201: `{idFactura, numeroFactura, estado, subtotalManoObra, subtotalRepuestos, subtotal, impuesto, total, saldo}`. Guarda `idFactura`. Inicialmente EMITIDA y saldo `"336.00"`.

Todos los campos del body son opcionales: `{}` hereda NIT/nombre/dirección del cliente y usa IVA 12 %. NIT máximo 20, nombre máximo 150, dirección nullable máximo 250. Si el nombre heredado del cliente supera 150, envía un nombre fiscal más corto. No puede existir otra factura para la misma orden.

### 11.3 Consultar facturas

```http
GET {{baseUrl}}/facturas?page=1&pageSize=20&idCliente={{idCliente}}&conSaldo=true&estado=EMITIDA
GET {{baseUrl}}/facturas/{{idFactura}}
```

Sin body. 200. Lectura para FACTURAR/PAGOS_REGISTRAR/ENTREGAR_ORDEN/REPORTES_VER. Lista admite también `search`, `fechaDesde`, `fechaHasta`; estados EMITIDA/PAGADA/ANULADA. `conSaldo=true` limita a saldo positivo; `false` no impone ese filtro. Detalle incluye `detalles`, `pagos`, `totalPagado` y `saldo` calculado en SQL.

### 11.4 Registrar primer pago parcial

```http
POST {{baseUrl}}/facturas/{{idFactura}}/pagos
```

```json
{"idMetodoPago":{{idMetodoPago}},"monto":"100.00","referencia":"PAGO-QA-001"}
```

PAGOS_REGISTRAR. Método activo, monto positivo y no mayor al saldo. Referencia opcional/nullable máximo 60. 201: `{idPago, idFactura, saldo: "236.00", estadoFactura: "EMITIDA"}`. Guarda `idPago` para probar su anulación antes de entregar.

### 11.5 Anular ese pago

```http
POST {{baseUrl}}/pagos/{{idPago}}/anular
```

```json
{"motivo":"Pago de laboratorio ingresado por error"}
```

PAGOS_REGISTRAR. Motivo obligatorio máximo 300. 200: `{idPago, estado: "ANULADO", saldo: "336.00", estadoFactura: "EMITIDA"}`. No lo borra. Solo se anula una vez y no puede hacerse después de entregar la orden.

### 11.6 Volver a pagar y liquidar

Usa el mismo endpoint `POST /facturas/{{idFactura}}/pagos` dos veces, con estos bodies:

```json
{"idMetodoPago":{{idMetodoPago}},"monto":"100.00","referencia":"PAGO-QA-002"}
```

```json
{"idMetodoPago":{{idMetodoPago}},"monto":"236.00","referencia":"PAGO-QA-003"}
```

Ambos devuelven 201 con IDs distintos. Después del último: saldo `"0.00"`, estadoFactura PAGADA. Si no anulaste el primer pago, no repitas los 100.00: paga solo el saldo actual. Consulta siempre la factura para saber cuánto falta.

### 11.7 Entregar orden

```http
POST {{baseUrl}}/ordenes/{{idOrden}}/entrega
```

```json
{"nombreRecibe":"Ana Prueba","documentoRecibe":"DOC-QA-001","observaciones":"Recibe equipo y cargador; funcionamiento verificado"}
```

ENTREGAR_ORDEN. Exige LISTO, factura vigente y saldo cero. Nombre obligatorio máximo 150; documento opcional/nullable máximo 30, observaciones opcionales/nullable máximo 500. 200: `{idEntrega, idOrden, estadoOrden: "ENTREGADO"}`.

Consulta el detalle de la orden: debe conservar historial, diagnósticos, reparaciones, consumos, factura, pagos —incluido el anulado— y entrega. No existe endpoint de anulación de factura, compra, consumo o entrega, ni DELETE físico.

## 12. Dashboard

```http
GET {{baseUrl}}/dashboard
```

Sin body. Requiere REPORTES_VER. 200 con seis contadores SQL y hasta diez eventos en `actividadReciente`. Los contadores dependen de toda la base, no solo de los datos de este recorrido. La orden ENTREGADO ya no cuenta como abierta y la factura pagada ya no cuenta como factura con saldo.

## 13. Los doce reportes

Todos son **GET sin body**, requieren REPORTES_VER y devuelven 200 cuando los filtros son válidos. Usa los IDs reales guardados. No envíes filtros de otro reporte: la API los rechaza.

| Ruta completa de ejemplo | Filtros de negocio admitidos | Resultado |
| --- | --- | --- |
| `{{baseUrl}}/reportes/ordenes-activas?estado=REPARACION&idPrioridad={{idPrioridad}}&fechaDesde={{fechaDesde}}&fechaHasta={{fechaHasta}}` | `estado`, `idPrioridad`, `idTecnico`, fechas; todos opcionales. | Lista por orden activa; conserva órdenes sin técnico. Una orden ya entregada no aparece. |
| `{{baseUrl}}/reportes/historial-cliente?idCliente={{idCliente}}&fechaDesde={{fechaDesde}}&fechaHasta={{fechaHasta}}` | **`idCliente` obligatorio**; fechas opcionales. | `{cliente, ordenes: []}`; conserva cliente sin órdenes, sin duplicarlas por diagnósticos. |
| `{{baseUrl}}/reportes/historial-equipo?numeroSerie=QA-SERIE-001` | **`numeroSerie` obligatorio**; no acepta filtros de fecha. | `{equipo, ordenes: []}`; conserva equipo sin órdenes. Usa la serie real si la cambiaste. |
| `{{baseUrl}}/reportes/actividad-tecnico?idTecnico={{idTecnico}}&fechaDesde={{fechaDesde}}&fechaHasta={{fechaHasta}}` | **`idTecnico` y ambas fechas obligatorios**. | Lista con discriminador `tipo: DIAGNOSTICO/REPARACION`, fecha, descripción, costo y estado. |
| `{{baseUrl}}/reportes/repuestos-utilizados?idOrden={{idOrden}}&idBodega={{idBodega}}` | `idOrden`, `idTecnico`, `idBodega`, fechas; opcionales. | Lista por consumo con precios históricos. |
| `{{baseUrl}}/reportes/inventario?idBodega={{idBodega}}&idCategoria={{idCategoria}}&idRepuesto={{idRepuesto}}` | `idBodega`, `idCategoria`, `idRepuesto`; opcionales. | Lista por combinación bodega/repuesto, incluidas existencias cero registradas. |
| `{{baseUrl}}/reportes/bajo-minimo?idBodega={{idBodega}}&idCategoria={{idCategoria}}` | `idBodega`, `idCategoria`; opcionales. | Lista donde existencia <= mínimo. |
| `{{baseUrl}}/reportes/compras-proveedor?idProveedor={{idProveedor}}&idBodega={{idBodega}}&estado=RECIBIDA` | `idProveedor`, **`idBodega`**, `estado`, fechas; opcionales. | Lista por línea de compra, no por cabecera. Aquí se usa idBodega, no idBodegaDestino. |
| `{{baseUrl}}/reportes/movimientos?idBodega={{idBodega}}&idRepuesto={{idRepuesto}}&codigoTipoMovimiento=CONSUMO_REPARACION` | `idBodega`, `idRepuesto`, `codigoTipoMovimiento`, `idUsuario`, fechas; opcionales. | Lista por movimiento y documento de origen. |
| `{{baseUrl}}/reportes/facturas-saldo?idCliente={{idCliente}}&conSaldo=false` | `idCliente`, `conSaldo`, `estado`, fechas; opcionales. | Lista de facturas con pagos asociados. En este reporte, conSaldo tiene default **true**; false permite ver las pagadas. |
| `{{baseUrl}}/reportes/ingresos?idCliente={{idCliente}}&fechaDesde={{fechaDesde}}&fechaHasta={{fechaHasta}}` | `idCliente`, fechas; opcionales. | Lista mensual con conteo y totales financieros; excluye facturas anuladas. Es facturación del SQL actual, no suma de recibos de caja. |
| `{{baseUrl}}/reportes/trazabilidad?idOrden={{idOrden}}` | **`idOrden` obligatorio**. | `{orden,historial,diagnosticos,reparaciones,movimientos,factura,pagos,entrega}`. |

En la tabla, “fechas” significa `fechaDesde` y `fechaHasta`. Los tabulares admiten también `page`, `pageSize` y `search`; se paginan en el backend después de ejecutar el SP, porque los procedimientos actuales no reciben paginación. Ejemplo: agrega `&page=1&pageSize=20` a una URL que ya tiene filtros.

En históricos y trazabilidad omite page/pageSize/search: la implementación retorna el objeto completo y no recorta sus relaciones. Un historial de recurso inexistente devuelve 404; un recurso existente sin historial devuelve un objeto con arrays vacíos. En listados generales, no tener filas es 200 con `data: []`.

Para obtener resultados de órdenes activas, consulta ese reporte antes de entregar/cancelar, o crea una orden adicional y déjala abierta. Para bajo mínimo, configura el mínimo igual o mayor al stock actual; no esperes filas si todas las existencias superan sus mínimos.

## 14. Orden recomendado del recorrido completo

1. Instalar SQL, asociar cuenta SQL a tc_runtime y preparar el administrador-técnico.
2. Completar `.env`, levantar API, consultar health.
3. Login → me → ready → catalogos; guardar IDs de catálogos y del usuario técnico.
4. Crear y editar usuario secundario y catálogos adicionales; conservar la sesión de administrador para el recorrido.
5. Crear/editar cliente, equipo, bodega, repuesto y proveedor; consultar listas/detalles.
6. Crear compra de 5 unidades a 150.00 → consultar → recibir → verificar inventario 5.
7. Crear orden → cambiar a DIAGNOSTICO → registrar diagnóstico → iniciar reparación.
8. Registrar actividad → consumir 1 repuesto a precio de venta 200.00 → verificar existencia 4.
9. Finalizar reparación → LISTO. Si quieres probar retrabajo, hazlo ahora y vuelve a finalizar antes de facturar.
10. Vista previa → factura por 336.00 → pago 100.00 → anular ese pago → nuevo pago 100.00 → pago del saldo 236.00.
11. Entregar → verificar detalle y trazabilidad. Crear/cancelar una segunda orden si deseas probar esa transición.
12. Cambiar mínimo, probar ajustes de inventario, consultar dashboard y reportes con filtros adecuados.
13. Logout → me debe devolver 401.

Los importes/stock exactos indicados presuponen una base de laboratorio, los valores de esta guía y ninguna operación adicional. Consulta siempre la respuesta real de SQL antes de pagar o consumir.

## 15. Rechazos que conviene comprobar manualmente

Estas son expectativas para que las ejecutes tú; no son resultados ya comprobados contra tu BD.

| Caso | Resultado esperado |
| --- | --- |
| GET protegido sin cookie / después de logout | 401 SESION_INVALIDA. |
| Login con password incorrecta o usuario inactivo | 401 CREDENCIALES_INVALIDAS, sin revelar cuál dato falló. |
| POST/PATCH sin Origin o con uno no autorizado | 403 ORIGEN_NO_PERMITIDO. |
| POST/PATCH sin Content-Type application/json | 400 VALIDACION. |
| Usuario TECNICO consulta `/usuarios` | 403 PERMISO_DENEGADO. |
| Administrador sin rol TECNICO registra diagnóstico/inicia reparación | 403 PERMISO_DENEGADO. |
| Body agrega idUsuario, un campo desconocido, dinero numérico o cantidad 0 | 400 VALIDACION. |
| PATCH `{}` o campo requerido con null | 400 VALIDACION. |
| Solicitar un ID positivo inexistente | 404 NO_ENCONTRADO. |
| Repetir número de serie, código único o username | 409 DUPLICADO. |
| Crear otra orden para un equipo con orden abierta | 409 ORDEN_ABIERTA. |
| Recibir una compra por segunda vez | 409 de negocio, sin duplicar stock. |
| Consumir más unidades que las existentes | 409 STOCK_INSUFICIENTE; sin consumo/movimiento parcial. |
| Pagar más que el saldo de una factura EMITIDA | 409 PAGO_EXCEDE_SALDO. Prueba antes de liquidarla. |
| Generar una segunda factura para la misma orden todavía LISTO | 409 FACTURA_EXISTENTE. |
| Entregar estando LISTO pero con saldo pendiente | 409 ORDEN_CON_SALDO. |
| Anular un pago aplicado después de entregar | 409 de negocio; no modifica saldo. |
| Reabrir a REPARACION una orden LISTO ya facturada | 409 ORDEN_FACTURADA. |
| SQL inaccesible o configuración SQL incompleta | 503 SERVICIO_NO_DISPONIBLE; health puede seguir en 200. |

Ejemplo de error:

```json
{"error":{"code":"VALIDACION","message":"Revisa los campos indicados.","details":{"monto":["El valor debe ser mayor que cero."]}},"requestId":"identificador-de-la-peticion"}
```

Después de un rechazo financiero o de stock, consulta factura/inventario/detalle para comprobar que no hubo cambios parciales. Si se pierde la respuesta o hay timeout en un pago, compra, consumo o entrega, consulta su resultado antes de reenviar: no hay una clave de idempotencia que haga seguro repetirlo a ciegas.

## 16. Qué conservar como evidencia y qué queda pendiente

Para cada operación guarda método/URL, body sin contraseñas, estado HTTP, respuesta pública y, si aplica, el registro/movimiento/saldo observado en SQL. No adjuntes Cookie, JWT, password, PasswordHash, secretos de `.env` ni credenciales SQL.

El esquema y los SP utilizados son los del proyecto; esta guía no modifica `database`, no importa datos ni crea migraciones. La ejecución manual y la revisión de resultados corresponden a Axel, con la preparación de BD/usuarios coordinada con Angela y Wilson. La conexión Azure y la adaptación del frontend a cookie HttpOnly siguen siendo tareas separadas.
