import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientInput, ClientPatch, EquipmentInput, PartInput, SupplierInput, WarehouseInput, UserInput } from '../../src/modules/masters/masters.dto';
import { OrderInput, DiagnosisInput, RepairInput, ActivityInput, StateInput, DeliveryInput } from '../../src/modules/service/service.dto';
import { PurchaseInput } from '../../src/modules/purchasing/purchasing.dto';
import { InvoiceInput, PaymentInput, CancelPaymentInput } from '../../src/modules/billing/billing.dto';
import { AdjustmentInput } from '../../src/modules/inventory/inventory.dto';
import { LoginDto } from '../../src/modules/auth/auth.dto';

const boundaries: Array<[new () => object, string, number]> = [
  [ClientInput, 'nombres', 100], [ClientInput, 'apellidos', 100], [ClientInput, 'razonSocial', 150],
  [ClientInput, 'nombreContacto', 120], [ClientInput, 'direccion', 250],
  [EquipmentInput, 'modelo', 80], [EquipmentInput, 'numeroSerie', 60], [EquipmentInput, 'descripcion', 300],
  [PartInput, 'codigo', 30], [PartInput, 'nombre', 120], [PartInput, 'descripcion', 300],
  [SupplierInput, 'nombre', 150], [SupplierInput, 'nombreContacto', 120], [SupplierInput, 'direccion', 250],
  [WarehouseInput, 'codigo', 20], [WarehouseInput, 'nombre', 80], [WarehouseInput, 'ubicacion', 200],
  [UserInput, 'nombreUsuario', 50], [UserInput, 'nombreCompleto', 150],
  [OrderInput, 'problemaReportado', 1000], [OrderInput, 'observaciones', 500],
  [DiagnosisInput, 'descripcion', 1000], [RepairInput, 'descripcion', 1000], [ActivityInput, 'descripcion', 500],
  [StateInput, 'observacion', 500], [DeliveryInput, 'nombreRecibe', 150], [DeliveryInput, 'documentoRecibe', 30],
  [DeliveryInput, 'observaciones', 500], [PurchaseInput, 'numeroDocumentoProveedor', 40], [PurchaseInput, 'observaciones', 500],
  [InvoiceInput, 'nitFacturacion', 20], [InvoiceInput, 'nombreFacturacion', 150], [InvoiceInput, 'direccionFacturacion', 250],
  [PaymentInput, 'referencia', 60], [CancelPaymentInput, 'motivo', 300], [AdjustmentInput, 'observacion', 300],
];
describe('Formularios: limites del servidor y mensajes en español (sin SQL)', () => {
  it.each([ClientInput, ClientPatch])('valida NIT y teléfono también en edición: %p', async Type => {
    for (const nit of ['CF', '1234567-9', '1000002-K']) {
      const errors = await validate(plainToInstance(Type, { nit, telefono: '+502 2222-3333' }));
      expect(errors.filter(error => ['nit', 'telefono'].includes(error.property))).toEqual([]);
    }
    for (const nit of ['1234567-5', '000000-0', 'NIT', null]) {
      expect((await validate(plainToInstance(Type, { nit }))).some(error => error.property === 'nit')).toBe(true);
    }
    for (const telefono of ['telefono', '12345678', '2222333', '222233333', '+50322223333', null]) {
      expect((await validate(plainToInstance(Type, { telefono }))).some(error => error.property === 'telefono')).toBe(true);
    }
    expect(plainToInstance(Type, { nit: ' cf ' }).nit).toBe('CF');
  });
  it.each(boundaries)('%p.%s acepta su limite %i y rechaza un caracter adicional', async (Type, field, max) => {
    const accepted = await validate(plainToInstance(Type, { [field]: 'a'.repeat(max) }));
    expect(accepted.find(error => error.property === field)).toBeUndefined();
    const rejected = await validate(plainToInstance(Type, { [field]: 'a'.repeat(max + 1) }));
    expect(rejected.find(error => error.property === field)?.constraints).toMatchObject({ maxLength: `Usa como máximo ${max} caracteres.` });
  });
  it.each(['Ana Lucía O’Connor', "María-José D'Ávila", 'Estudio Arce Diseño S.A.', 'C++ y Redes 24/7'])('no inventa restricciones alfabeticas para %s', async value => {
    const errors = await validate(plainToInstance(SupplierInput, { nombre: value }));
    expect(errors.find(error => error.property === 'nombre')).toBeUndefined();
  });
  it.each(['ab\u0000cd', 'ab\u0007cd', 'ab\u007fcd', 'ab\u0085cd'])('rechaza controles invisibles %j', async value => {
    const errors = await validate(plainToInstance(ClientInput, { nombres: value }));
    expect(errors.find(error => error.property === 'nombres')?.constraints).toMatchObject({ safeText: 'El texto contiene caracteres de control no permitidos.' });
  });
  it('conserva saltos de linea de descripciones, limpia espacios y permite vaciar opcionales', async () => {
    const client = plainToInstance(ClientInput, { nombres: '  Ana Lucía  ', direccion: '   ' });
    expect(client.nombres).toBe('Ana Lucía'); expect(client.direccion).toBeNull();
    expect((await validate(client)).some(error => ['nombres', 'direccion'].includes(error.property))).toBe(false);
    const repair = plainToInstance(RepairInput, { descripcion: 'Diagnóstico inicial\nPrueba de alimentación', costoManoObra: '10.00' });
    expect(await validate(repair)).toEqual([]);
  });
  it('texto requerido vacio y correos invalidos tienen mensajes accionables', async () => {
    const errors = await validate(plainToInstance(UserInput, { nombreCompleto: '  ', email: 'no-es-correo' }));
    expect(errors.find(error => error.property === 'nombreCompleto')?.constraints?.minLength).toBe('Este campo no puede quedar vacío.');
    expect(errors.find(error => error.property === 'email')?.constraints?.isEmail).toBe('Escribe un correo electrónico válido.');
  });
  it('no recorta passwords ni acepta passwords nuevos que exceden el limite', async () => {
    const value = '  contraseña de prueba  ';
    const input = plainToInstance(UserInput, { password: value });
    expect(input.password).toBe(value);
    expect((await validate(input)).find(error => error.property === 'password')).toBeUndefined();
    const rejected = await validate(plainToInstance(UserInput, { password: 'x'.repeat(129) }));
    expect(rejected.find(error => error.property === 'password')?.constraints?.maxLength).toContain('128');
    expect(plainToInstance(LoginDto, { password: value }).password).toBe(value);
  });
});
