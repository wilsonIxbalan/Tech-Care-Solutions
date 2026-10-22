# 05 · Pantallas, diseño y entrega frontend

Responsable: Cristian. Usar la base existente de apps/web y [tecnologías acordadas](01-arquitectura-flujos.md); no reinicializar Vite ni introducir otra librería visual. [Inputs/DTO](02-contratos-dtos.md), [rutas](03-endpoints-bd.md) y [errores/sesión](04-errores-seguridad.md) definen qué enviar/mostrar.

## Pantallas que se construyen

1. **Login `/login`:** nombreUsuario/password → POST auth/login; después cargar usuario/permisos. Logout por POST, no borrar un token desde JavaScript.
2. **Inicio `/dashboard`:** GET dashboard; seis indicadores y actividad reciente calculados en SQL. Nada de cifras de ejemplo en la aplicación final.
3. **Clientes `/clientes`:** lista/búsqueda y formulario ClienteInput; alternar persona/empresa y sus campos requeridos. GET/POST/PATCH clientes.
4. **Equipos `/equipos`:** EquipoInput; cliente, tipo/marca de catálogos, modelo, serie, descripción y estado. GET/POST/PATCH equipos; desde serie abrir historial.
5. **Órdenes `/ordenes`, `/ordenes/nueva`:** filtros + OrdenInput; seleccionar equipo del cliente, problema, prioridad, fecha estimada y observaciones. POST orden y abrir su detalle.
6. **Detalle `/ordenes/:id`:** GET orden; cabecera y secciones historial/diagnóstico/reparaciones/repuestos/factura/pagos/entrega. DiagnosticoInput, ReparacionInput, ActividadInput y ConsumoInput según permiso/estado; técnico sale de sesión.
7. **Inventario `/inventario`:** GET inventario/movimientos; filtros bodega/categoría/repuesto/bajo mínimo, tabla de existencias, MinimoInput y AjusteInput con motivo. No celda editable de stock.
8. **Compras `/compras`, `/compras/:id`:** CompraInput, filas de items/cantidad/costo histórico; consultar detalle y confirmar recepción pendiente una sola vez.
9. **Caja `/facturas`, `/facturas/:id`:** preview SQL y FacturaInput desde orden LISTO; mostrar subtotal/impuesto/total/pagado/saldo. PagoInput permite parciales; AnularPagoInput exige motivo.
10. **Entrega en detalle de orden:** EntregaInput, registro de quién recibe; confirmación solo con servicio LISTO y factura vigente sin saldo.
11. **Mantenimientos:** repuestos, proveedores y bodegas con sus Input; catálogos indispensables con CatalogoInput. Formularios reutilizables, sin CRUD genérico de transacciones.
12. **Usuarios `/usuarios`:** solo admin; UsuarioInput + asignación de roles existentes, activar/desactivar. Password nunca se muestra ni se precarga con el hash.
13. **Reportes `/reportes`:** selector de los doce slugs del documento 03 y filtros correspondientes; historial cliente/equipo y trazabilidad preservan relaciones vacías. Una sección reutilizable, no doce diseños distintos.

La organización de secciones puede reutilizar páginas/modal/drawer de la base; no hace falta una ruta nueva para cada POST. Tras finalizar una reparación consultar estadoOrden, no asumir que toda la orden quedó LISTO.

## Patrones de implementación

- React Router para rutas; sesión/permisos y guards de página. El menú oculta opciones no autorizadas, pero no reemplaza al guard backend.
- React Hook Form + Zod: etiquetas visibles, reglas DTO y máximos SQL; details del servidor se aplica con setError y aria-invalid/aria-describedby.
- TanStack Query para estado remoto; fetch por lib/api-client, no en cada botón. Invalidar orden/inventario/compra/factura/dashboard afectados después de una mutación confirmada.
- No polling de pocos segundos ni reintentos automáticos de mutaciones. Al perder una respuesta financiera, indicar «Consulta el resultado antes de repetir».
- Fechas civiles no cambian de día por UTC; horas de eventos en Guatemala; dinero con formatMoney/GTQ. La UI no recalcula saldo, IVA oficial o inventario.
- Para cada lista/detalle: LoadingState/Skeleton, EmptyState con siguiente paso, ErrorState con reintento de lectura. Espera inicial explicada; no spinner indefinido.

## Diseño acordado

- Tokens en [styles.css](../apps/web/src/styles.css): primario #0F766E, sidebar #0B1628, fondo #F4F7FB, texto #0F172A, peligro #B91C1C. Usar clases semánticas, no HEX repetidos por pantalla.
- Inter local, cuerpo 14–16 px, títulos 24–36 px; contraste suficiente, espaciado de 4 px y contenido legible en laptop/ancho pequeño.
- Una acción principal por sección; Button outline/secondary para alternativas; destructive solo para una anulación/cancelación explícita. Confirmar recepción, facturación, anulación y entrega.
- Reutilizar Card/Input/Label/NativeSelect/Checkbox/Table/Tabs/Dialog/Sheet y componentes shared. Sin window.alert/confirm ni cambios de tema por pantalla.
- Lucide: un mismo icono para una misma acción; tamaño consistente, texto junto a acciones importantes y aria-label en botones de solo icono. Estado con texto/icono, nunca solo color.
- Sonner success tras respuesta confirmada; error breve una vez. Alert inline para campos/global persistente, 409, permisos o resultado no confirmado. Conservar entradas al fallar.
- Foco visible y teclado en formularios/diálogos; submit deshabilitado mientras procesa. Campos readonly para números/fechas generados y totales del servidor.

## Ajustes pendientes del kit antes de integrar sesión

- Cambiar LoginResponse al LoginResult del documento 02; retirar accessToken/tokenType y almacenamiento de JWT.
- Adaptar apiFetch a credentials=include, sin Authorization Bearer; usar VITE_API_URL=/api/v1.
- Configurar proxy local en vite.config.ts y rewrite /api antes de index.html en vercel.json, con host Render real aprobado; no están aplicados por esta documentación.
- Ajustar manejo de sesión y ConfirmDialog para mostrar mensajes de negocio conocidos sin convertir todo rechazo en resultado desconocido; reservar ese aviso para fallos ambiguos de red/servidor.
- Actualizar tests de transporte/login; la galería actual y sus pruebas no certifican la autenticación ni los procesos finales.

## Aceptación de una pantalla

Consume endpoint real con el DTO acordado; respeta rol/estado y muestra éxito/validación/403/409/red caída. No pierde formulario ni duplica acciones. Captura legible desktop y ancho pequeño; lint, typecheck, tests y build; cambio registrado en seguimiento y coordinado si afecta contrato. El primer deploy debe superar el recorrido de cookie descrito en documento 04.
