# 01 · Arquitectura y flujo de construcción

Estándar v1 · 21/10/2026. Leer después: [contratos](02-contratos-dtos.md), [endpoints](03-endpoints-bd.md), [seguridad/errores](04-errores-seguridad.md) y [pantallas/diseño](05-frontend-diseno.md).

## Estado y alcance

Las bases frontend, backend y SQL estan integradas en devWilson. La integracion funcional se valida por recorridos; la presencia de un formulario no certifica persistencia ni una prueba con mocks certifica Azure. Entrega: 31/10/2026.

Guias operativas versionables: [despliegue Vercel/Render nativo](../seguimiento/guias/despliegue-vercel-render.md)
y [usuarios y recorrido ficticio RL26](../seguimiento/guias/recorrido-realista.md).
RL26 es una carga manual adicional, sin usuarios/passwords en SQL ni reemplazo de SEM26.

Tres capas y un backend modular, sin microservicios, Redis, crédito, integración SAT ni refresh tokens. Guías operativas y configuración privada permanecen en la carpeta compartida; estos cinco documentos técnicos sí se versionan.

## Tecnologías y responsabilidades

- **Cristian — apps/web:** React, TypeScript, Vite, Tailwind 4, shadcn/ui/Radix, Sonner, Lucide, React Router, TanStack Query, React Hook Form y Zod. Construye pantallas y consume JSON; no accede a SQL ni calcula importes oficiales.
- **Axel — apps/api:** NestJS 11, TypeScript, mssql/Tedious, class-validator/class-transformer, Swagger, Argon2id, JWT y cookie-parser. Valida, autentica, autoriza y adapta DTO↔SQL; no construye interfaz.
- **Angela + Wilson — database:** SQL Server mediante Azure SQL Database, esquema único dbo. Restricciones, transacciones, SP, vistas, reportes y datos sintéticos. Wilson administra accesos y coordina aplicación de scripts; Angela colabora y valida.
- **Entorno:** Node 24 LTS y pnpm 10.34.7; versiones reproducibles en pnpm-lock.yaml. Sin gestores/lockfiles alternativos ni actualizaciones mayores unilaterales.

## Separación de código

- Web: `app` (router/providers/layout), `features/<dominio>` (pages/components/api/hooks/schemas), `components/ui`, `components/shared`, `lib` y `types`.
- API: `modules/<dominio>` con controller → service → repository y dto; `common` para guards/filtros y `database` para un pool reutilizable.
- Módulos: auth/usuarios, clientes/equipos, órdenes/diagnóstico/reparación, inventario, compras/proveedores, facturación/pagos/entrega y reportes/dashboard.
- Todos los objetos SQL usan **dbo**; los módulos son agrupaciones lógicas, no esquemas ni servicios separados.
- No importar clases de Nest en React ni módulos del frontend en Nest. Comparten un contrato HTTP, no su ejecución.
- Diagrama ER como codigo: [techcare-er.mmd](../seguimiento/diseno/techcare-er.mmd), generado desde tablas, FK e indices reales con `pnpm er:build`; validar con `pnpm er:check`. Incluye 33 tablas y 52 FK; PK/UK compuestas y UNIQUE filtrados se documentan como grupos, sin inventar unicidad global ni relaciones derivadas. No interpreta reglas de triggers como cardinalidades estructurales.
- `pnpm test:scripts` verifica generadores, salvaguardas de semilla y configuracion del proxy sin SQL. La semilla manual esta en `database/semillas/01_datos_demostracion.sql`; no forma parte del maestro ni del inicio. Sus cuentas y operaciones son de demostracion, nunca carga automatica de produccion.

```mermaid
flowchart LR
  W[React / navegador] -->|HTTPS /api/v1 y cookie| P[Vercel /api: proxy]
  P --> A[NestJS / Render]
  A -->|mssql cifrado| D[(Azure SQL / dbo)]
```

El proxy mantiene un único origen para el navegador; no mueve NestJS a Vercel. En local, Vite debe enviar `/api` a localhost:3000. Configuración y prueba de cookie: documento 04.

## Despliegue previsto: Vercel + Render Node nativo + Azure SQL

La configuracion esta preparada, sin crear recursos ni ejecutar despliegues. `render.yaml` en la raiz describe solamente la API; Azure SQL existente sigue siendo la base. Docker no forma parte de esta ruta: su Dockerfile queda como alternativa opcional y una prueba de arranque Docker no es un requisito del plan actual.

1. **Render:** al realizar el despliegue autorizado, seleccionar la rama acordada y el Blueprint `render.yaml`, runtime **Node**, Root Directory vacio (raiz del repositorio, no `apps/api`). Revisar la region antes de crear el servicio. `plan: free` evita seleccionar implicitamente un plan de pago; sus limites e inactividad pueden producir arranques en frio. `autoDeployTrigger: off` desactiva despliegues automaticos por commits, pero importar/sincronizar un Blueprint puede crear recursos y lanzar el primer deploy: no hacerlo como comprobacion local.
2. **Build desde la raiz:** `corepack enable && corepack prepare pnpm@10.34.7 --activate && pnpm install --frozen-lockfile --prod=false && pnpm --filter @techcare/api build`. `NODE_VERSION=24` acota la version mayor. Corepack selecciona el pnpm fijado tambien en `packageManager`; no depender de la version pnpm preinstalada del proveedor. `--prod=false` conserva herramientas de compilacion aun con `NODE_ENV=production`. Mantener las dependencias de ejecucion y los scripts autorizados por `onlyBuiltDependencies`, incluido Argon2: su modulo nativo/prebuild debe instalarse para Linux en Render, nunca copiar `node_modules` de Windows ni instalar con `--ignore-scripts`.
3. **Start desde la raiz:** `node apps/api/dist/main.js`, conservando el directorio de trabajo para las rutas de configuracion. Render proporciona `PORT`; no fijar `PORT` ni `API_PORT` en produccion. Sondeo publico: `/api/v1/health` (liveness sin SQL). Completar entorno y firewall segun documento 04 antes de validar readiness con sesion.
4. **Vercel:** un proyecto para `apps/web`, preset **Vite**, Node **24.x**, Root Directory **apps/web** y acceso a archivos fuera del Root Directory habilitado para el workspace/lockfile de la raiz. Install Command: `cd ../.. && corepack enable && corepack prepare pnpm@10.34.7 --activate && pnpm install --frozen-lockfile --prod=false`. Build Command: `pnpm --filter @techcare/web build`; Output Directory: `dist` (relativo a `apps/web`). La configuracion de rutas es `apps/web/vercel.json`. No usar `apps/api` como raiz de Render ni la raiz del repositorio como proyecto Vite.
5. Cuando existan los origenes HTTPS reales, configurar el proxy `/api/:path*` antes del fallback SPA mediante `pnpm deploy:configure-web` y verificar `pnpm deploy:check` (documento 04). El navegador usa `/api/v1`; el destino Render pertenece al rewrite, nunca a un `VITE_API_URL` absoluto. Completar `FRONTEND_ORIGIN` con el origen exacto de Vercel/dominio propio, no un placeholder.

Comprobacion local estatica: `node --test scripts/test/render-native.test.mjs` (tambien incluida en `pnpm test:scripts`). No acredita instalacion Linux de Argon2, disponibilidad Render, conexion Azure ni cookies en produccion; esas comprobaciones corresponden al primer despliegue real.

Referencias: [Blueprint Render](https://render.com/docs/blueprint-spec), [Node en Render](https://render.com/docs/node-version), [runtime nativo](https://render.com/docs/native-runtimes), [monorepos Vercel](https://vercel.com/docs/monorepos).

## Flujo de una acción

Formulario validado → petición HTTP → guard de sesión/permisos → DTO validado → service → repository parametrizado → SP transaccional → respuesta uniforme → invalidación de consultas de la web.

SQL realiza consumo/recepción/pagos/entrega de forma atómica. El backend no los reconstruye como varios UPDATE independientes. Al fallar, rollback; la interfaz no anuncia éxito sin respuesta confirmada.

Flujo principal: cliente → equipo → orden RECIBIDO → diagnóstico → ESPERANDO_AUTORIZACION → reparación → LISTO → factura → pagos → entrega ENTREGADO.
Abastecimiento: proveedor → compra PENDIENTE → recepción RECIBIDA → inventario/movimientos → consumo en reparación.

## Roles de aplicación

- ADMINISTRADOR: usuarios, catálogos y procesos autorizados; diagnóstico/inicio técnico requieren además TECNICO, como exige el SQL actual.
- RECEPCION: clientes, equipos, ingreso y entrega.
- TECNICO: diagnóstico, reparación, actividades y consumo.
- BODEGA: repuestos, proveedores, bodegas, compras y ajustes.
- CAJA: factura, pagos y entrega. REPORTES_VER permite consultar reportes a los perfiles configurados.

Los permisos reales proceden de UsuarioRol/RolPermiso activos. Ocultar menús no sustituye el guard. Roles SQL del equipo y cuenta técnica de API no son estos perfiles de negocio. Los reportes financieros requieren ADMINISTRADOR o CAJA; los roles restantes conservan las consultas operativas autorizadas. No existe un rol analitico nuevo.

## Secuencia de desarrollo y aceptación

1. Publicar DTO/endpoint en Swagger y su lectura/SP SQL; construir la pantalla contra ese contrato.
2. Integrar primero sesión → clientes/equipos → orden; después servicio/inventario/compras; finalmente finanzas/entrega/reportes.
3. Cada módulo aporta éxito, validación, rechazo por permiso, conflicto de negocio y estados de carga/vacío/error.
4. BD entrega lecturas sin duplicar cabeceras, rollback y escenarios incompletos; se ejecutan T01–T14 y concurrencia con evidencia.
5. Cambio de campo/ruta/error: coordinar Wilson/Axel/Cristian, actualizar Docs, tipos, Swagger y pruebas en el mismo PR; registrar el resumen en seguimiento. No reinterpretar el contrato por separado.
