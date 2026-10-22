# 02 · DTO y contrato de datos

Complementos: [rutas y respuestas](03-endpoints-bd.md), [errores/sesión](04-errores-seguridad.md). Los campos públicos son camelCase; DTO/componentes PascalCase, archivos kebab-case y códigos de estado/rol UPPER_SNAKE_CASE.

## Reglas comunes

- IDs: enteros positivos de SQL INT. Cantidades: enteros positivos; stock mínimo permite 0. Booleanos reales, no "true"/"false".
- Money: string decimal de dos posiciones, sin símbolo/separador, p. ej. `"125.50"`; escala/rango del DECIMAL SQL correspondiente. Horas son decimal positivo y porcentaje va de 0.00 a 100.00.
- Eventos: ISO UTC, p. ej. `2026-10-21T16:30:00Z`; UI muestra America/Guatemala. Fecha civil: YYYY-MM-DD, sin conversión de zona accidental.
- Obligatorios de texto: trim/no vacío y máximo de SQL. Opcionales vacíos se normalizan a null solo si la columna lo permite. **No recortar ni normalizar passwords.**
- En PATCH, omitir significa conservar; null solo limpia un campo nullable. Rechazar campos desconocidos y cantidades/precios inválidos antes del SP.
- Actor, técnico de diagnóstico/inicio, recepción/caja/entrega y fechas automáticas salen de sesión/servidor, nunca del body.

## Respuestas

```json
{"data":{"idOrden":1,"numeroOrden":"OS-2026-000001","estado":"RECIBIDO"}}
```

POST de maestros, orden, diagnóstico, reparación, actividad, consumo, compra, factura y pago: 201. Consultar/editar y otras acciones (login/logout, ajuste, finalizar/recibir/anular/entregar): 200. Sin DELETE físico. Listas vacías: 200, no 404.

```json
{"data":[],"meta":{"page":1,"pageSize":20,"total":0,"totalPages":0}}
```

Query común: page=1, pageSize=20 (máximo 100), search; filtros de negocio en documento 03. Orden estable con ID como desempate. Catálogos pequeños: arrays sin meta. En lectura: arrays sin elementos son [], relación singular inexistente es null.

## DTO de entrada de mantenimientos

Notación: `s(n)` string de máximo n; `?` opcional, sujeto a nullabilidad; Money definido arriba. Son nombres de contrato, no archivos ya generados.

- **ClienteInput:** tipoCliente INDIVIDUAL/EMPRESARIAL, nit s(20), telefono s(20), nombres? s(100), apellidos? s(100), razonSocial? s(150), nombreContacto? s(120), email? s(120), direccion? s(250), estado? ACTIVO/INACTIVO. Individual exige nombres/apellidos; empresa razón social; consumidor final usa CF.
- **EquipoInput:** idCliente, idTipoEquipo, idMarca, modelo s(80), numeroSerie s(60), descripcion s(300), estado? ACTIVO/INACTIVO/BAJA. No transferir propietario si tiene órdenes.
- **RepuestoInput:** idCategoria, codigo s(30), nombre s(120), descripcion? s(300), precioCompraReferencia Money, precioVenta Money, estado? ACTIVO/INACTIVO.
- **ProveedorInput:** nit s(20), nombre s(150), telefono s(20), nombreContacto? s(120), email? s(120), direccion? s(250), estado? ACTIVO/INACTIVO.
- **BodegaInput:** codigo s(20), nombre s(80), ubicacion? s(200), estado? ACTIVA/INACTIVA.
- **UsuarioInput:** nombreUsuario s(50), nombreCompleto s(150), email s(120), telefono? s(20), password obligatoria al crear/opcional al cambiar, activo? boolean, roles: RoleCode[]. Solo roles existentes; nunca password ni PasswordHash en una respuesta.
- **CatalogoInput:** marca/tipo de equipo: nombre s(60); categoría: nombre s(80), descripcion? s(200); método de pago: codigo s(20), nombre s(60), activo? boolean. No editor genérico de tablas/roles/transiciones.

## DTO de acciones

- **OrdenInput:** idCliente, idEquipo, idPrioridad, problemaReportado s(1000), fechaEstimada? fecha civil, observaciones? s(500).
- **DiagnosticoInput:** descripcion s(1000), costoManoObraEstimado Money.
- **ReparacionInput:** descripcion s(1000), costoManoObra Money. **FinalizarInput:** observacion? s(500).
- **ActividadInput:** descripcion s(500), horasInvertidas decimal string positivo, escala/rango DECIMAL(5,2).
- **ConsumoInput:** idBodega, idRepuesto, cantidad. No aceptar precios enviados por UI.
- **EstadoInput:** estado DIAGNOSTICO/REPARACION/CANCELADO, observacion s(500). Destinos/roles en documento 03.
- **CompraInput:** idProveedor, idBodegaDestino, numeroDocumentoProveedor? s(40), observaciones? s(500), items: [{idRepuesto,cantidad,costoUnitario Money}]. Mínimo un ítem, sin repuesto repetido. Recibir usa body {}.
- **AjusteInput:** idBodega, idRepuesto, codigoTipoMovimiento AJUSTE_ENTRADA/AJUSTE_SALIDA, cantidad, observacion s(300) obligatoria. **MinimoInput:** stockMinimo entero >= 0.
- **FacturaInput:** nitFacturacion? s(20), nombreFacturacion? s(150), direccionFacturacion? s(250), porcentajeImpuesto? decimal string (default "12.00"). Validar también valores heredados del cliente antes de llamar al SP.
- **PagoInput:** idMetodoPago, monto Money > 0, referencia? s(60). **AnularPagoInput:** motivo s(300) obligatorio.
- **EntregaInput:** nombreRecibe s(150), documentoRecibe? s(30), observaciones? s(500).

## DTO de lectura

Las formas completas de ClienteDto, EquipoDto, OrdenDetalleDto, ReparacionDto, ConsumoDto, CompraDetalleDto, FacturaDetalleDto, PagoDto, EntregaDto, InventarioDto, MovimientoDto y DashboardDto están en [domain.ts](../apps/web/src/types/domain.ts). Los tipos comunes están en [api.ts](../apps/web/src/types/api.ts); no son entidades SQL expuestas directamente.

Usuario público: {idUsuario,nombreUsuario,nombreCompleto,email,telefono,activo,roles,fechaCreacion,ultimoAcceso}; sin secretos. Otros maestros devuelven sus campos públicos + idRepuesto/idProveedor/idBodega, nunca un spread indiscriminado del body. CatalogoDto usa {id,codigo?,nombre,descripcion?,activo?} según recurso.

- OrdenDetalleDto: cabecera + historial[], diagnosticos[], reparaciones[] (cada una con actividades[]/repuestos[]), factura y entrega opcionales.
- FacturaDetalleDto: cabecera fiscal + detalles[] + pagos[] + saldo SQL. CompraDetalleDto: cabecera + items[].
- IdCliente de orden e IdOrden de reparación se derivan por JOIN y siguen en el DTO. No duplicarlos otra vez en tablas por comodidad.
- Totales/precios históricos/saldo/existencia vienen de SQL; la UI solo los formatea. El backend convierte PascalCase del driver a camelCase y Money a string.

## Contrato de sesión aprobado

LoginInput = {nombreUsuario,password}. LoginResult = {usuario: SessionUser, expiresIn: 3600}; se envía dentro de data y la cookie llega por Set-Cookie. Me devuelve data = SessionUser; Logout devuelve data = {message:"Sesión cerrada."}.

SessionUser = {idUsuario,nombreUsuario,nombreCompleto,roles: RoleCode[],permisos: string[]}. **No accessToken/tokenType en JSON ni token en almacenamiento web.** El LoginResponse anterior del kit aún debe ajustarse a este contrato al implementar sesión.
