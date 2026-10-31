# Bitácora · Wilson

Usar [plantilla](../plantillas/bitacora.md). Rol: PM, arquitectura, PR, Azure y administración/SQL.

Sin actividades personales registradas todavía. La preparación del kit por el agente no significa que Wilson ya ejecutó recursos o scripts.

## 26/10/2026 · Integración en devWilson, pendiente de revisión local

- Separadas pruebas web/API de `src`; configuración HTTP productiva compartida sin mocks ni fixtures en el producto. CI comprueba esta separación.
- Login por usuario/correo, JWT en cookie HttpOnly, recuperación/cierre de sesión y limpieza de caché. Administración de usuarios y protección del último administrador activo.
- Identidad seleccionada: propuesta A «Continuidad», monograma T/C, aplicada a login, navegación, favicon y factura. Paleta teal/azul oscuro conservada.
- Conectados formularios y consultas HTTP de clientes/equipos, servicio, compras/inventario, caja y reportes. Descargas CSV/XLSX y factura PDF simulada Carta, sin recalcular importes oficiales.
- Reportes `facturas-saldo`, `ingresos` y `compras-proveedor`: solo ADMINISTRADOR/CAJA, además de REPORTES_VER. BODEGA conserva las operaciones de compras e inventario.
- Preparado `database/bootstrap/01_admin_inicial.sql`, independiente del maestro y con placeholders. No se ejecutó este script ni se conectó Azure durante esta implementación. Los tests usan dobles de prueba.
- Revisión visual de login en escritorio/móvil y de dashboard/usuarios con peticiones interceptadas en un navegador aislado. No demuestra conexión, datos ni autenticación reales de Azure.
- Pendientes: provisión manual autorizada del primer usuario, configuración privada y recorrido real contra Azure; URLs y proxy de despliegue; revisión de avisos transitivos de MSAL/uuid antes de publicar.
- Cambios locales sin nuevos commits ni push; no se desplegaron servicios ni se crearon recursos Azure.
