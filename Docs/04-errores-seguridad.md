# 04 · Errores, sesión y seguridad mínima

Contrato de construcción aprobado: formato actual de errores y JWT de una hora en **cookie HttpOnly**, mediante proxy Vercel. No usar sessionStorage/localStorage ni devolver el JWT en JSON. Sin refresh tokens ni almacén adicional de sesiones.

## Cookie y viabilidad del despliegue

- NestJS emite `__Host-techcare_session`: HttpOnly, Secure, SameSite=Lax, Path=/, **sin Domain**, Max-Age=3600 s (maxAge de Express: 3600000 ms). Verifica firma/expiración del JWT, no solo presencia de cookie.
- Cookie compartida entre pestañas del mismo sitio, no sesión independiente por pestaña. UI consulta `/auth/me` al cargar; no intenta leer Set-Cookie/document.cookie.
- Frontend llama a su mismo origen `/api/v1` con `credentials: 'include'`. Vercel reenvía a Render; no llamar directamente a onrender.com desde el navegador para esta sesión.
- Preparar el rewrite antes de desplegar, **solo cuando exista el host real aprobado**. Desde la raiz, PowerShell:

```powershell
$env:TECHCARE_BACKEND_ORIGIN = '<ORIGEN_HTTPS_REAL_DEL_BACKEND>'
pnpm deploy:configure-web
pnpm deploy:check
```

- El script configura `apps/web/vercel.json`, conserva preferencias existentes y coloca `/api/:path*` antes del fallback SPA. Rechaza HTTP, rutas, credenciales y placeholders. El marcador del ejemplo de PowerShell debe sustituirse por el origen real antes de ejecutar. `deploy:check` falla mientras no se configure el destino; no es una certificacion de conectividad ni crea servicios. Revisar el diff y mantener `VITE_API_URL` omitida o relativa `/api/v1`. `FRONTEND_ORIGIN` del backend debe ser el origen HTTPS exacto del frontend, sin ruta ni barra final. Configurar Vercel con Root Directory `apps/web` y acceso al workspace de la raiz, segun documento 01.

- API responde `Cache-Control: private, no-store`; no cachear sesión, datos protegidos ni Set-Cookie en CDN. No añadir otra VM o función intermediaria.
- Local: Vite proxy `/api` → API:3000, cookie `techcare_session` con HttpOnly/Lax/Path=/, sin Domain y Secure=false **solo en desarrollo HTTP**. Usar siempre el mismo hostname, no mezclar localhost/127.0.0.1.
- Login devuelve LoginResult + cookie; logout borra la cookie con mismos nombre/path/atributos y limpia caché/usuario web. Puede cerrar una sesión expirada; no revoca una copia del JWT antes de su expiración.
- NestJS necesita cookie-parser y extractor JWT desde cookie. El usuario debe seguir activo y con permisos actuales; no autorizar con un menú ni con roles viejos del token.

**Validación obligatoria del primer deploy:** login → me → recargar → operación protegida → logout → me=401, también bloqueando cookies de terceros. Verificar rechazo desde otro Origin y que dos sesiones no comparten caché. Viabilidad documental, no prueba realizada contra URLs reales; no cambiar a almacenamiento web silenciosamente si falla.

Fuentes técnicas: [rewrites externos Vercel](https://vercel.com/docs/routing/rewrites), [atributos Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie), [restricciones entre sitios](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).

## Protección sin infraestructura extra

- HttpOnly reduce exposición del token, pero **no basta contra CSRF**: POST/PATCH/PUT/DELETE (incluidos login/logout) exigen JSON y Origin exacto autorizado (FRONTEND_ORIGIN por entorno y previews aprobadas explícitamente). Rechazar ausente/null/no permitido; pruebas HTTP deben enviar el origen autorizado. GET no modifica negocio.
- CORS no sustituye esa validación. Si se accede directamente en desarrollo, origen explícito + credentials=true; nunca `*` con cookies. Autorizar URLs de preview individualmente, no todos los dominios vercel.app.
- Argon2id para passwords; JWT_SECRET y conexión SQL solo en entorno backend. No registrar passwords, hashes, tokens o Cookie; React escapa texto y no inserta HTML de mensajes.
- DTO con whitelist; consultas tipadas/parametrizadas, SP para procesos y usuario SQL tc_runtime, no administrador. Actor sale de sesión; los permisos se verifican en cada endpoint.
- Login admite usuario o correo y rechaza identidades ambiguas. Limite basico en memoria: 20 intentos por identificador cada cinco minutos, mapa acotado y sin confiar en X-Forwarded-For. No sustituye proteccion perimetral frente a ataques distribuidos.
- Administracion de usuarios: conservar al menos un ADMINISTRADOR activo mediante comprobacion y bloqueo en la misma transaccion. Solo protege operaciones realizadas por esta API; las cuentas SQL de desarrollo siguen siendo cuentas de confianza.
- Primer administrador: script manual independiente `database/bootstrap/01_admin_inicial.sql`, con hash Argon2id generado localmente. No se ejecuta al iniciar el backend ni forma parte del maestro. Nunca versionar valores privados ni volver a aplicar el maestro a la BD instalada.
- Revisar dependencias antes de desplegar. Overrides acotados: multer, js-yaml, `exceljs>uuid=11.1.1` (CommonJS/v4) y `@azure/identity>@azure/msal-node=7.1.0`. Se comprueba carga real del driver/Identity/MSAL sin conexiones, rechazo de buffers pequenos de uuid y las exportaciones con ExcelJS. Auditoria productiva local sin avisos al revisar el 28/10/2026; no equivale a una auditoria general de seguridad. El login SQL actual no usa auth_code; cualquier adopcion de autenticacion Entra necesita pruebas especificas, no solo estos smoke tests.

## Envelope único de error

```json
{"error":{"code":"VALIDACION","message":"Revisa los campos indicados.","details":{"telefono":["El teléfono es obligatorio."]}},"requestId":"id-de-correlacion"}
```

`details` es opcional y siempre campo → array de mensajes, p. ej. items.0.cantidad; no stack ni objeto Error crudo. `requestId` se genera/valida en API y también sale en X-Request-Id. Un filtro global adapta validación, HttpException y errores SQL; no dejar el formato Nest por defecto en unas rutas y otro en el resto.

## HTTP → comportamiento de interfaz

- **400 VALIDACION:** conservar formulario y asignar details a campos; resumen breve si hay varios.
- **401 CREDENCIALES_INVALIDAS/SESION_INVALIDA:** login genérico «Usuario o contraseña incorrectos»; si expiró, limpiar estado/caché y pedir iniciar sesión de nuevo.
- **403 PERMISO_DENEGADO:** «No tienes permiso para esta acción», sin reintento. ORIGEN_NO_PERMITIDO: «No se pudo verificar la petición; entra desde la dirección autorizada». Si USUARIO_INACTIVO, cerrar sesión y contactar administración.
- **404 NO_ENCONTRADO:** «El registro no existe o ya no está disponible»; ofrecer volver/actualizar.
- **409 código de negocio:** Alert contextual con mensaje seguro; refrescar saldo/stock cuando corresponda, no fingir éxito.
- **500 ERROR_INTERNO:** mensaje genérico + requestId; detalles solo en log seguro.
- **503 SERVICIO_NO_DISPONIBLE** o respuesta no JSON de proveedor: explicar inicio/indisponibilidad y permitir reintento de lectura. Sin respuesta de red no hay HTTP 0: es error local RESPUESTA_NO_CONFIRMADA.
- Un fallo transitorio al revalidar `/auth/me` conserva el contenido y los borradores en memoria de la pagina. Las escrituras se bloquean durante la verificacion o su fallo, tambien en el transporte HTTP, sin reenviarlas al recuperarse. Un 401/inactivo limpia datos privados; cambio de identidad/roles/permisos remonta el contenido para no exponer un borrador de otra identidad. No persistir borradores sensibles en almacenamiento web.

## Diagnostico y recuperacion SQL

- Logs `SQL`: `operation`, `durationMs`, `driverCode` enumerado, `sqlNumber` numerico, `category` y `requestId` cuando hay peticion. No incluir mensaje/stack SQL, parametros, cuerpo, host, usuario, password ni cadena de conexion. Eventos del pool no se atribuyen a la peticion que lo creo.
- Categorias utiles: 40615 firewall; 18456/4060 autenticacion/base SQL; 40613/40197/40501/10928/10929 indisponibilidad o limites; ETIMEOUT timeout; ESOCKET/ECONNRESET transporte. Son pistas tecnicas, no permiso para exponer mensajes del motor al navegador. El cliente sigue recibiendo 503 generico.
- Un solo intento de apertura concurrente; un pool cerrado se reemplaza en la siguiente peticion. Un timeout de consulta no destruye un pool conectado y un evento aislado no cancela otras transacciones. Nunca repetir automaticamente la operacion fallida; en especial no pagos, consumos, compras ni commits con respuesta perdida.
- `DB_CONNECTION_TIMEOUT_MS` y `DB_REQUEST_TIMEOUT_MS`: enteros 1000–120000, valores predeterminados 60000. Medir y coordinar ambos presupuestos con proxy/navegador; el timeout del cliente no prueba rollback. No aumentar tiempos indefinidamente para esconder un firewall incorrecto. Mantener TLS y certificado verificado.
- `/health` es liveness publica sin SQL. `/ready` comprueba SQL y requiere sesion: no configurarlo como sondeo anonimo del proveedor ni quitar su proteccion por conveniencia. Nest iniciado no significa que SQL este disponible.
- Autorizar la IP de salida del backend, no las IP de visitantes web. En desarrollo puede cambiar por ISP/VPN/NAT. En Render revisar todos los rangos de salida del servicio/region o una salida dedicada. No abrir todo Internet ni usar “Permitir servicios Azure” como solucion general. Para serverless, comprobar tambien auto-pausa/reanudacion con el administrador.
- El plan actual usa Render **Node nativo**, sin Docker. La construccion/prueba de arranque Docker no aplica como pendiente de este plan. Dockerfile y `.dockerignore` quedan como alternativa opcional; las suites aisladas no certifican el runtime Linux ni Azure.

## Entorno de Render nativo

- `render.yaml` solicita con `sync: false` los valores de `JWT_SECRET`, `DB_PASSWORD`, `FRONTEND_ORIGIN`, `DB_SERVER`, `DB_NAME` y `DB_USER`. Se introducen en el entorno privado del servicio al crear el Blueprint; posteriores cambios de estos valores se gestionan en Render. No copiarlos a Vercel, al YAML ni al frontend. Generar un JWT_SECRET aleatorio de al menos 32 caracteres; nunca devolver el JWT en el body.
- La referencia publica actual de `apps/api/.env.example` es `DB_SERVER=sql-techcare-solutions-2026.database.windows.net`, `DB_NAME=TechCareDB`, `DB_USER=app_techcare`. Confirmar esos datos con el administrador para el entorno elegido; usar la cuenta tecnica con permisos `tc_runtime`, no credenciales administrativas. La password no se versiona.
- Defaults del Blueprint: `NODE_ENV=production`, `JWT_EXPIRES_IN=1h`, `DB_PORT=1433`, `DB_ENCRYPT=true`, `DB_TRUST_SERVER_CERTIFICATE=false` y ambos timeouts SQL en `60000`. `PORT` lo proporciona Render. No cargar un `.env` local como configuracion productiva.
- `FRONTEND_ORIGIN` debe contener el origen HTTPS real autorizado del frontend; no hay un host Vercel/Render productivo inventado en el Blueprint. El proxy conserva el mismo origen para el navegador y la cookie HttpOnly/Secure/SameSite=Lax; no cambiarla a almacenamiento web ni apuntar `VITE_API_URL` directamente a Render.
- En el primer deploy comprobar instalacion/carga de Argon2 nativo, inicio de Nest, `/api/v1/health`, firewall de salida hacia Azure, `/api/v1/ready` autenticado y el recorrido de cookie indicado arriba. No ejecutar maestro SQL, bootstrap ni semillas desde build/start. Hasta disponer de hosts y credenciales reales estas validaciones quedan pendientes; Docker no las bloquea.

## Traducción SQL prioritaria

- 50607 → 409 STOCK_INSUFICIENTE: «No hay suficientes unidades en la bodega seleccionada».
- 51710 → 413 EXPORTACION_DEMASIADO_GRANDE: ningun archivo parcial ni truncamiento; ajustar filtros. La actualizacion de reportes se aplica mediante la migracion independiente del documento 03, nunca ejecutando otra vez el maestro.
- 51105/52002 → 409 PAGO_EXCEDE_SALDO; 50109 → 409 ORDEN_CON_SALDO; 50103/52021 → 409 TRANSICION_INVALIDA.
- 50113 → 409 ORDEN_FACTURADA; 50206 → 409 ORDEN_ABIERTA; 51003 → 409 FACTURA_EXISTENTE.
- 2601/2627 → 409 DUPLICADO; 547 → 409 CONFLICTO_INTEGRIDAD, sin nombre de constraint ni mensaje nativo.
- Errores propios de recurso inexistente → 404; autorización → 403; parámetros inválidos → 400; restantes estados incompatibles → 409. No convertir todos los 50xxx a 409.
- 1205 → 409 CONFLICTO_CONCURRENCIA: transacción revertida; refrescar antes de repetir. Una respuesta perdida de pago/compra/consumo/entrega exige consultar antes de reenviar.
- Inconsistencias internas (p. ej. 51006, cabecera/detalle incoherentes) → 500 ERROR_INTERNO, no un conflicto atribuible al formulario. Mantener una lista explícita por operación; códigos no reconocidos no se exponen como texto SQL.

Sonner para éxito breve o fallo puntual; Alert para conflicto persistente, estado no confirmado o error de página. No mostrar el mismo fallo en múltiples toasts. Mensajes de negocio salen de una traducción controlada, no del texto SQL sin filtrar.
