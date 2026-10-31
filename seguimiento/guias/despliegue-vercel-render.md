# Despliegue · Vercel + Render Node nativo + Azure SQL

Guia manual. No aprovisiona servicios ni ejecuta SQL. **No se usa Docker.**
Los ejemplos con marcadores deben completarse con valores reales del panel de
cada proveedor. No inventar hosts ni publicar el entorno hasta validar la sesion.

## 1. Condiciones previas

- Node **24** y pnpm **10.34.7**, segun `.node-version` y `package.json`.
- Cambios revisados, commit y push de la version elegida. No publicar copias SQL
  privadas con hashes, `.env`, backups ni credenciales. La implementacion no hace
  commit/push automaticamente: el servidor solo recibe lo subido a Git.
- Azure SQL accesible con TLS y cuenta tecnica `app_techcare`/`tc_runtime`.
- Administrador de la aplicacion existente y probado; una cuenta SQL no sustituye
  a un usuario de la tabla Usuario.
- En la BD ya instalada, migracion `database/migraciones/02_reportes_paginados.sql`
  aplicada y comprobada. Si ya se aplico esta version, no repetir por rutina.
  **Nunca ejecutar el maestro sobre una BD con datos.**
- Respaldo y recorridos reales documentados. Para mas casos ficticios ver
  [recorrido RL26](recorrido-realista.md). Semillas solo para demostracion, nunca
  desde build/start. Antes de una publicacion, revisar/desactivar cuentas de prueba
  innecesarias; no exponer usuarios con una clave compartida conocida.

Desde la raiz ejecutar:

```powershell
pnpm install --frozen-lockfile
pnpm check:structure
pnpm sql:check
pnpm sql:reports:check
pnpm er:check
pnpm test:scripts
pnpm lint
pnpm typecheck
pnpm --filter @techcare/web test --maxWorkers=2
pnpm --filter @techcare/api test
pnpm --filter @techcare/api test:e2e --runInBand
pnpm audit --prod --audit-level=moderate
pnpm build
```

Estas comprobaciones son locales/aisladas. No sustituyen una prueba real de Azure,
del runtime Linux de Render, del proxy ni de las cookies HTTPS.

## 2. Identificar los dos origenes reales

Necesitaras el origen HTTPS del frontend y el del backend, sin rutas ni barra
final. Obtenlos de los paneles de Vercel y Render, no a partir de nombres supuestos.
Si aun no existe el proyecto de Vercel, se puede crear primero para obtener su URL;
ese primer frontend no estara operativo hasta completar el proxy y el backend.
No anunciarlo como listo. Configurar Render cuando se conozca el origen autorizado
del frontend; ajustar y redesplegar al cambiar de dominio.

## 3. Backend en Render, entorno Node

Opcion manual: **New → Web Service**, conectar el repositorio y seleccionar la
rama con la version validada (actualmente `devWilson`, salvo decision distinta).
No seleccionar Docker ni mover ramas automaticamente.

- Runtime: **Node**.
- Root Directory: **vacio/raiz del repositorio**, no `apps/api`.
- Node: **24**.
- Build Command:

```sh
corepack enable && corepack prepare pnpm@10.34.7 --activate && pnpm install --frozen-lockfile --prod=false && pnpm --filter @techcare/api build
```

- Start Command:

```sh
node apps/api/dist/main.js
```

- Health Check Path: `/api/v1/health`.
- Despliegues automaticos: desactivados inicialmente.
- Elegir el plan conscientemente. `render.yaml` propone **free**; confirmar limites
  y condiciones actuales del proveedor antes de crear. El plan gratuito puede
  suspenderse por inactividad y tardar en reanudar. No confundir eso con fallo SQL.

Tambien se puede importar el Blueprint `render.yaml`: **esa accion crea el servicio
y su primer despliegue**. No hacerlo sin revisar rama, valores y costo. Se puede
usar solo como referencia y crear el servicio manualmente.

### Variables privadas del backend

Configurar en el panel de Render, nunca en archivos versionados:

```dotenv
NODE_VERSION=24
NODE_ENV=production
FRONTEND_ORIGIN=<ORIGEN_HTTPS_REAL_DE_VERCEL>
DB_SERVER=sql-techcare-solutions-2026.database.windows.net
DB_PORT=1433
DB_NAME=TechCareDB
DB_USER=app_techcare
DB_PASSWORD=<CONTRASEÑA_SQL_PRIVADA>
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false
DB_CONNECTION_TIMEOUT_MS=60000
DB_REQUEST_TIMEOUT_MS=60000
JWT_SECRET=<SECRETO_ALEATORIO_PRIVADO>
JWT_EXPIRES_IN=1h
```

Render proporciona `PORT`; no fijarlo manualmente a 3000. Nest ya escucha en
`0.0.0.0`. Para generar JWT_SECRET en una terminal privada:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

No compartir el resultado. `FRONTEND_ORIGIN` admite varios origenes exactos
separados por coma solo si se han aprobado; no usar `*` ni todos los previews.

## 4. Firewall de Azure

1. En el servicio de Render abrir **Connect → Outbound** y copiar todos los rangos
   de salida que indique para la region/servicio. No usar la IP DNS de entrada del
   host de la API ni la IP de cada visitante de Vercel.
2. En Azure Portal abrir el servidor SQL → **Networking / Redes**.
3. Agregar solo los rangos de salida necesarios. Si Render muestra CIDR y Azure
   solicita inicio/fin, convertir el rango correctamente; no ampliar por comodidad.
4. Guardar y esperar propagacion. Cambios de firewall pueden tardar varios minutos.
5. Mantener cifrado y verificacion de certificado. No activar todo Internet ni
   “Permitir servicios Azure” como arreglo general: Render no es un servicio Azure.

Los rangos gratuitos pueden ser compartidos por otros clientes de Render; no son
identidad exclusiva. La autenticacion SQL y sus permisos siguen siendo obligatorios.
Un endpoint privado requiere conectividad privada explicita; no se configura aqui.

## 5. Proxy de Vercel

Cuando el backend tenga su URL real, desde la raiz del proyecto:

```powershell
$env:TECHCARE_BACKEND_ORIGIN = '<ORIGEN_HTTPS_REAL_DEL_BACKEND>'
pnpm deploy:configure-web
pnpm deploy:check
```

Revisar el diff de `apps/web/vercel.json`. Debe enviar `/api/:path*` al backend
antes del fallback de la SPA. Subir ese cambio mediante commit/push antes del
despliegue final. La URL del backend no es una contraseña, pero debe ser correcta.

`deploy:check` falla intencionalmente sin un destino real. No arreglarlo usando un
host inventado. El chequeo no prueba conectividad ni inicia un despliegue.

## 6. Frontend en Vercel

Importar el mismo repositorio y la rama validada:

- Framework: **Vite**.
- Root Directory: **`apps/web`**.
- Habilitar acceso a archivos fuera de Root Directory para el workspace pnpm.
- Node: **24**.
- Install Command:

```sh
cd ../.. && corepack enable && corepack prepare pnpm@10.34.7 --activate && pnpm install --frozen-lockfile --prod=false
```

- Build Command: `pnpm build` (ejecutado dentro de `apps/web`).
- Output Directory: **`dist`**.
- `VITE_API_URL`: **omitida** o `/api/v1`.

No copiar DB_PASSWORD/JWT_SECRET ni ninguna variable SQL a Vercel o a variables
`VITE_*`. El navegador debe llamar a su propio origen; no apuntarlo directamente
al dominio de Render. Confirmar que el origen de Vercel coincide exactamente con
`FRONTEND_ORIGIN` configurado en Render y volver a desplegar si cambias variables.

## 7. Verificacion obligatoria antes de anunciarlo

1. Revisar logs de Render: carga de Argon2 nativo y Nest iniciado sin excepciones.
2. Abrir el host real del backend con `/api/v1/health`: debe devolver JSON `ok`.
3. Abrir el host de Vercel con `/api/v1/health`: debe devolver JSON, **no index.html**.
4. Iniciar sesion en Vercel. Comprobar cookie `__Host-techcare_session`, HttpOnly,
   Secure, SameSite=Lax, Path=/ y sin Domain. No copiar su valor.
5. Consultar `/auth/me` a traves de `/api/v1`, recargar y entrar a una ruta interna
   directamente. La sesion y el fallback SPA deben funcionar.
6. Comprobar `/api/v1/ready` autenticado: `/health` solo prueba que la API vive,
   no que SQL esta disponible. No quitar autenticacion de readiness.
7. Probar roles separados, un flujo de compra/consumo/factura/pagos/entrega y las
   restricciones de stock/saldo. Revisar importes historicos y movimientos.
8. Cambiar a 5 filas, paginar y exportar. El archivo debe incluir todos los filtros,
   no solo la pagina. Probar CSV, XLSX y PDF a traves del proxy.
9. Probar foco/teclado, ayudas, errores de formulario, tablas plegadas y movil.
10. Cerrar sesion: `/auth/me` debe responder 401. Probar con cookies de terceros
    bloqueadas y confirmar que la sesion sigue usando el mismo origen.

No ejecutar scripts SQL negativos/transaccionales sobre la base compartida para
completar evidencia; requieren una copia QA autorizada. Si se pierde la respuesta
de una escritura, consultar el documento antes de repetir. Nunca declarar aprobado
solo porque build, mocks o `/health` funcionaron.

## 8. Diagnostico rapido y vuelta atras

- `401 /auth/me` antes del login o tras expirar: esperado.
- `403 ORIGEN_NO_PERMITIDO`: revisar el origen exacto y el proxy, no abrir CORS.
- `503`: correlacionar `requestId` con logs SQL seguros; distinguir 40615 firewall,
  18456/4060 acceso SQL, ETIMEOUT y transporte. Revisar tambien auto-pausa de Azure
  serverless y suspension del plan gratuito de Render.
- Error de firmas de reportes: comprobar la migracion, no ejecutar el maestro.
- Un 503 de sesion debe conservar el borrador y bloquear nuevas escrituras hasta
  verificar de nuevo; no equivale automaticamente a contraseña incorrecta.

Para revertir aplicacion, redesplegar la ultima version compatible desde el
proveedor. Eso **no revierte la BD**: restauraciones/migraciones se planifican por
separado con respaldo y autorizacion. No usar resets de Git ni DELETE de historial
para intentar deshacer operaciones de negocio.

Referencias: [Render Node](https://render.com/docs/deploy-node-express-app),
[salidas de Render](https://render.com/docs/outbound-ip-addresses),
[rewrites Vercel](https://vercel.com/docs/routing/rewrites),
[firewall Azure SQL](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql).
