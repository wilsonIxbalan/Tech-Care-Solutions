# 04 · Errores, sesión y seguridad mínima

Contrato de construcción aprobado: formato actual de errores y JWT de una hora en **cookie HttpOnly**, mediante proxy Vercel. No usar sessionStorage/localStorage ni devolver el JWT en JSON. Sin refresh tokens ni almacén adicional de sesiones.

## Cookie y viabilidad del despliegue

- NestJS emite `__Host-techcare_session`: HttpOnly, Secure, SameSite=Lax, Path=/, **sin Domain**, Max-Age=3600 s (maxAge de Express: 3600000 ms). Verifica firma/expiración del JWT, no solo presencia de cookie.
- Cookie compartida entre pestañas del mismo sitio, no sesión independiente por pestaña. UI consulta `/auth/me` al cargar; no intenta leer Set-Cookie/document.cookie.
- Frontend llama a su mismo origen `/api/v1` con `credentials: 'include'`. Vercel reenvía a Render; no llamar directamente a onrender.com desde el navegador para esta sesión.
- Ejemplo de rewrite, **pendiente de sustituir API_RENDER por el host real aprobado**; va antes del fallback SPA:

```json
{"rewrites":[
  {"source":"/api/:path*","destination":"https://API_RENDER.onrender.com/api/:path*"},
  {"source":"/(.*)","destination":"/index.html"}
],"headers":[{"source":"/api/:path*","headers":[{"key":"x-vercel-enable-rewrite-caching","value":"0"}]}]}
```

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
- Revisar dependencias antes de desplegar. Tras parches transitivos de multer y js-yaml siguen pendientes avisos de MSAL (flujo authorization-code, distinto de SQL/password usado aqui) y uuid (v3/v5/v6 con buffers, distinto de v4 usado por ExcelJS). No se han eliminado esos avisos mediante actualizaciones mayores sin validar compatibilidad; no declarar la auditoria de paquetes limpia.

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

## Traducción SQL prioritaria

- 50607 → 409 STOCK_INSUFICIENTE: «No hay suficientes unidades en la bodega seleccionada».
- 51105/52002 → 409 PAGO_EXCEDE_SALDO; 50109 → 409 ORDEN_CON_SALDO; 50103/52021 → 409 TRANSICION_INVALIDA.
- 50113 → 409 ORDEN_FACTURADA; 50206 → 409 ORDEN_ABIERTA; 51003 → 409 FACTURA_EXISTENTE.
- 2601/2627 → 409 DUPLICADO; 547 → 409 CONFLICTO_INTEGRIDAD, sin nombre de constraint ni mensaje nativo.
- Errores propios de recurso inexistente → 404; autorización → 403; parámetros inválidos → 400; restantes estados incompatibles → 409. No convertir todos los 50xxx a 409.
- 1205 → 409 CONFLICTO_CONCURRENCIA: transacción revertida; refrescar antes de repetir. Una respuesta perdida de pago/compra/consumo/entrega exige consultar antes de reenviar.
- Inconsistencias internas (p. ej. 51006, cabecera/detalle incoherentes) → 500 ERROR_INTERNO, no un conflicto atribuible al formulario. Mantener una lista explícita por operación; códigos no reconocidos no se exponen como texto SQL.

Sonner para éxito breve o fallo puntual; Alert para conflicto persistente, estado no confirmado o error de página. No mostrar el mismo fallo en múltiples toasts. Mensajes de negocio salen de una traducción controlada, no del texto SQL sin filtrar.
