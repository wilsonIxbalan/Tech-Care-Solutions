import { Decimal, Id, Text } from '../../common/validation';
export class InvoiceInput {
  @Text(20, true, true) nitFacturacion?: string | null;
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
