import { ArgumentMetadata, Injectable, ParseIntPipe } from '@nestjs/common';
import { invalid } from './api-error';
@Injectable()
export class IdPipe extends ParseIntPipe {
  async transform(value: string, metadata: ArgumentMetadata) {
    if (
      !/^\d+$/.test(value) ||
      !Number.isInteger(Number(value)) ||
      Number(value) < 1 ||
      Number(value) > 2147483647
    )
      throw invalid(
        metadata.data ?? 'id',
        'El ID debe ser un entero positivo de SQL INT.',
      );
    return Number(value);
  }
}
