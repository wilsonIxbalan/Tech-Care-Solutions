import { Transform } from 'class-transformer';
import { ValidateBy } from 'class-validator';
import { validNit } from '../../common/client-validation';
import { Decimal, Id, Text } from '../../common/validation';
export class InvoiceInput {
  @Text(20, true, true)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @ValidateBy({ name: 'validNit', validator: { validate: validNit, defaultMessage: () => 'Escribe un NIT válido con su dígito verificador (por ejemplo, 1234567-9) o CF para consumidor final.' } })
  nitFacturacion?: string | null;
  @Text(150, true, true) nombreFacturacion?: string | null;
  @Text(250, true, true) direccionFacturacion?: string | null;
  @Decimal(true, false, true) porcentajeImpuesto = '12.00';
}
export class BillingPreviewQuery {
  @Decimal(true, false, true) porcentajeImpuesto = '12.00';
}
export class PaymentInput {
  @Id() idMetodoPago!: number;
  @Decimal(false, true) monto!: string;
  @Text(60, true, true) referencia?: string | null;
}
export class CancelPaymentInput {
  @Text(300) motivo!: string;
}
