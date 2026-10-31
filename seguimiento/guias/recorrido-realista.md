# Recorrido realista de demostracion · RL26

Este conjunto es **ficticio**, adicional a SEM26. No representa clientes reales,
identidades fiscales ni documentos certificados. No contactar los telefonos ni
correos de prueba. No se ha ejecutado en Azure por la implementacion.

## 1. Preparar usuarios desde la aplicacion

Entra con tu administrador y abre **Usuarios y roles**. Crea estas cuentas con
contraseñas privadas, distintas y de al menos 12 caracteres. Si ya tienes cuentas
activas con estos roles, reutilizalas: no es necesario crear nuevas. Cambia las
cuatro variables de actores en una copia privada del SQL por sus nombres actuales.

- Lucía Morales: `lucia.morales`, rol **RECEPCION**.
- Diego Salazar: `diego.salazar`, rol **TECNICO**.
- Paola Castillo: `paola.castillo`, rol **BODEGA**.
- Andrés Fuentes: `andres.fuentes`, rol **CAJA**.

Usa correos de demostracion bajo `example.invalid`, por ejemplo
`lucia.morales@example.invalid`. No reutilices la contraseña del administrador.
No asignes ADMINISTRADOR a todos para evitar probar los permisos: cada perfil
debe conservar las acciones propias de su trabajo. El script no crea usuarios,
no solicita hashes ni cambia tu cuenta Wilson.

## 2. Cargar el conjunto adicional

1. Confirma el respaldo y coordina que no haya otras escrituras durante la carga.
2. Abre una copia privada de `database/semillas/02_escenarios_realistas.sql`.
3. Comprueba los cuatro nombres de usuario y cambia `@ConfirmarCarga` a `1`.
4. Conecta expresamente a **TechCareDB de pruebas**, usando una cuenta SQL de
   desarrollo autorizada, no `app_techcare` ni las credenciales del login web.
5. Comprueba `DB_NAME()`, `@@TRANCOUNT=0` y `XACT_STATE()=0`. Usa autocommit con
   transacciones implicitas desactivadas; no agregues otra transaccion exterior.
   Ejecuta el archivo completo.
6. Espera el resultado `RL26` y la lista de ordenes importadas. Ante un error o
   respuesta perdida, comprueba el resultado antes de repetir. La repeticion se
   rechaza; no borres filas ni deshabilites constraints para forzar la carga.

**No ejecutar nuevamente SEM26, el bootstrap ni los maestros.** RL26 usa sus
propios identificadores y conserva los registros existentes. La carga es una
transaccion; los saltos en IDs despues de un rollback son normales.

## 3. Que agrega y que deja pendiente

- 12 clientes con nombres personales y empresas ficticias; uno sin servicios.
- 24 equipos con marcas y modelos descriptivos, distribuidos entre clientes.
- 24 ordenes, 19 diagnosticos y 14 reparaciones en distintas etapas.
- 18 repuestos y 3 bodegas, con 54 combinaciones de existencias.
- 6 proveedores y 12 compras: 9 recibidas y 3 pendientes.
- 73 movimientos de entrada/salida, incluyendo una baja documentada.
- 8 facturas: 6 pagadas, una con abono parcial y una sin pagos; 13 pagos y 6 entregas.
- Dos ordenes **LISTO sin factura**: `RL26-OS-009` y `RL26-OS-010`.
- Reparaciones en proceso: ordenes `RL26-OS-011` a `RL26-OS-014`.
- Esperando autorizacion: `RL26-OS-015` a `RL26-OS-019`.
- En diagnostico sin diagnostico registrado: `RL26-OS-020` y `RL26-OS-021`.
- Recibidas: `RL26-OS-022` y `RL26-OS-023`; cancelada: `RL26-OS-024`.

Los ingresos se importan con fechas anteriores. Los demas procesos se registran
en la fecha real de carga, no se inventa historia financiera pasada. Para buscar
facturas, pagos o compras nuevas, incluye **la fecha de carga** en los filtros.
El stock cero pertenece a un lote de ventiladores ficticio; otras bodegas siguen
teniendo existencias. El SSD conserva su precio historico aunque el catalogo
muestre un precio posterior distinto.

## 4. Probar el trabajo de cada perfil

Usa sesiones separadas en perfiles de navegador distintos o cierra sesion antes
de cambiar de cuenta; la cookie se comparte entre pestañas del mismo sitio.

### Recepcion

1. Entra como Lucia y consulta a Mariana Lopez y sus equipos.
2. Registra un nuevo cliente ficticio y dos equipos diferentes, con series unicas.
3. Crea una orden con prioridad y problema concreto. Verifica estado Recibido e
   historial inicial. Los numeros/actores/fechas oficiales los decide el servidor.
4. Prueba nombres vacios, textos mayores al limite y un correo invalido: no debe
   guardarse y el error debe identificar el campo. Los campos opcionales siguen
   siendo opcionales; no se impone un formato de NIT fiscal no acordado.

### Tecnico

1. Entra como Diego y registra el diagnostico de `RL26-OS-020`.
2. Comprueba la transicion a Esperando autorizacion y el tecnico responsable.
3. Tras confirmar la autorizacion del cliente ficticio, inicia la reparacion.
4. Agrega actividades y consume un repuesto desde una bodega con stock.
5. Comprueba detalle historico, descuento de existencia y movimiento de salida.
6. Intenta consumir mas unidades que las disponibles: debe rechazarse sin cambios
   parciales. No ajustes el inventario manualmente para esconder el rechazo.
7. Finaliza el trabajo. Si hay otra reparacion en proceso, la orden no debe quedar
   lista hasta cerrar todas. Se puede crear un segundo trabajo antes de facturar
   para probar una orden con varias reparaciones.

### Bodega

1. Entra como Paola y abre las compras pendientes del conjunto RL26. Los numeros
   de compra son generados por SQL; el documento del proveedor usa `RL26-COMP-`.
2. Confirma la recepcion de una compra y verifica existencia y movimientos por
   cada linea. Un segundo intento de recepcion debe ser rechazado.
3. Consulta las tres bodegas y los repuestos en cero/bajo minimo.
4. Cambia un minimo por su accion autorizada; no cambies existencia directamente.

### Caja

1. Entra como Andres y factura `RL26-OS-009`, que ya esta lista y no tiene factura.
2. Comprueba mano de obra, repuestos, impuesto y detalle; descarga el PDF simulado.
3. Registra dos pagos parciales y compara saldo pendiente con el servidor.
4. Intenta pagar mas del saldo: no debe registrarse un pago adicional.
5. Completa el saldo y entrega desde una cuenta con permiso de entrega. Una orden
   con saldo pendiente no debe entregarse. No hay credito en este alcance.

### Reportes y acceso

- Consulta el historial por cliente y por serie; las series RL26 estan visibles
  en los equipos. Prueba tambien a Esteban Paz, sin ordenes.
- Revisa trazabilidad antes y despues de facturar: no deben desaparecer relaciones
  opcionales ni multiplicarse los totales al tener varios pagos.
- Exporta CSV/Excel: deben incluir todos los filtros, no solo las 5 filas visibles.
- Comprueba que Tecnico/Bodega no acceden a los reportes financieros restringidos.
- Pliega/despliega las tablas: filtros y seleccion deben conservarse.
- Repite una validacion con teclado y abre las ayudas con foco/clic; Escape debe
  cerrarlas. Ninguna validacion importante depende solo del tooltip o del color.

## 5. Guardar evidencia

Anota caso, usuario/rol, identificador del documento, resultado esperado, resultado
observado y fecha. No captures passwords, hashes, cookies, tokens ni `.env`.
Un conjunto cargado no prueba por si solo que los recorridos funcionen: registrar
el resultado real antes de considerar el despliegue listo. Las pruebas SQL de
Angela requieren adaptacion a estos identificadores y una base aislada; no se
ejecutan automaticamente por esta guia.
