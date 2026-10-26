// Lista blanca interna. Ningún identificador SQL viene del body o de la URL.
export const masters = {
  clientes: {
    table: 'Cliente',
    id: 'IdCliente',
    columns:
      'IdCliente,TipoCliente,NIT,Nombres,Apellidos,RazonSocial,NombreContacto,NombreMostrar,Telefono,Email,Direccion,Estado,FechaRegistro',
    search: ['NombreMostrar', 'NIT', 'Telefono'],
    fields: {
      tipoCliente: ['TipoCliente', 12],
      nit: ['NIT', 20],
      nombres: ['Nombres', 100],
      apellidos: ['Apellidos', 100],
      razonSocial: ['RazonSocial', 150],
      nombreContacto: ['NombreContacto', 120],
      telefono: ['Telefono', 20],
      email: ['Email', 120],
      direccion: ['Direccion', 250],
      estado: ['Estado', 10],
    },
  },
  equipos: {
    table: 'Equipo',
    id: 'IdEquipo',
    columns:
      'IdEquipo,IdCliente,IdTipoEquipo,IdMarca,Modelo,NumeroSerie,Descripcion,Estado,FechaRegistro',
    search: ['NumeroSerie', 'Modelo'],
    fields: {
      idCliente: ['IdCliente', 0],
      idTipoEquipo: ['IdTipoEquipo', 0],
      idMarca: ['IdMarca', 0],
      modelo: ['Modelo', 80],
      numeroSerie: ['NumeroSerie', 60],
      descripcion: ['Descripcion', 300],
      estado: ['Estado', 10],
    },
  },
  repuestos: {
    table: 'Repuesto',
    id: 'IdRepuesto',
    columns:
      'IdRepuesto,IdCategoria,Codigo,Nombre,Descripcion,PrecioCompraReferencia,PrecioVenta,Estado',
    search: ['Codigo', 'Nombre'],
    fields: {
      idCategoria: ['IdCategoria', 0],
      codigo: ['Codigo', 30],
      nombre: ['Nombre', 120],
      descripcion: ['Descripcion', 300],
      precioCompraReferencia: ['PrecioCompraReferencia', -1],
      precioVenta: ['PrecioVenta', -1],
      estado: ['Estado', 10],
    },
  },
  proveedores: {
    table: 'Proveedor',
    id: 'IdProveedor',
    columns:
      'IdProveedor,NIT,Nombre,NombreContacto,Telefono,Email,Direccion,Estado',
    search: ['NIT', 'Nombre'],
    fields: {
      nit: ['NIT', 20],
      nombre: ['Nombre', 150],
      nombreContacto: ['NombreContacto', 120],
      telefono: ['Telefono', 20],
      email: ['Email', 120],
      direccion: ['Direccion', 250],
      estado: ['Estado', 10],
    },
  },
  bodegas: {
    table: 'Bodega',
    id: 'IdBodega',
    columns: 'IdBodega,Codigo,Nombre,Ubicacion,Estado',
    search: ['Codigo', 'Nombre'],
    fields: {
      codigo: ['Codigo', 20],
      nombre: ['Nombre', 80],
      ubicacion: ['Ubicacion', 200],
      estado: ['Estado', 10],
    },
  },
  usuarios: {
    table: 'Usuario',
    id: 'IdUsuario',
    columns:
      'IdUsuario,NombreUsuario,NombreCompleto,Email,Telefono,Activo,FechaCreacion,UltimoAcceso',
    search: ['NombreUsuario', 'NombreCompleto', 'Email'],
    fields: {
      nombreUsuario: ['NombreUsuario', 50],
      nombreCompleto: ['NombreCompleto', 150],
      email: ['Email', 120],
      telefono: ['Telefono', 20],
      activo: ['Activo', -2],
      passwordHash: ['PasswordHash', 255],
    },
  },
} as const;
export type MasterName = keyof typeof masters;
export const catalogs = {
  'tipos-equipo': {
    table: 'TipoEquipo',
    id: 'IdTipoEquipo',
    columns: 'IdTipoEquipo AS Id,Nombre',
    fields: { nombre: ['Nombre', 60] },
  },
  marcas: {
    table: 'Marca',
    id: 'IdMarca',
    columns: 'IdMarca AS Id,Nombre',
    fields: { nombre: ['Nombre', 60] },
  },
  'categorias-repuesto': {
    table: 'CategoriaRepuesto',
    id: 'IdCategoria',
    columns: 'IdCategoria AS Id,Nombre,Descripcion',
    fields: { nombre: ['Nombre', 80], descripcion: ['Descripcion', 200] },
  },
  'metodos-pago': {
    table: 'MetodoPago',
    id: 'IdMetodoPago',
    columns: 'IdMetodoPago AS Id,Codigo,Nombre,Activo',
    fields: {
      codigo: ['Codigo', 20],
      nombre: ['Nombre', 60],
      activo: ['Activo', -2],
    },
  },
} as const;
export type FieldMap = Readonly<Record<string, readonly [string, number]>>;
