import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiError } from '../../common/api-error';
import { IdPipe } from '../../common/id.pipe';
import { AuthRequest, Permissions, Roles } from '../auth/access';
import { ReportExportQuery } from './downloads.dto';
import { Download, DownloadsService } from './downloads.service';
import { reports } from '../reports/reports.repository';

@Injectable()
export class FinancialExportGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (
      ['facturas-saldo', 'ingresos', 'compras-proveedor'].includes(String(request.params.slug)) &&
      !request.user.roles.some((role) => ['ADMINISTRADOR', 'CAJA'].includes(role))
    )
      throw new ApiError(403, 'PERMISO_DENEGADO', 'No tienes permiso para esta acción.');
    return true;
  }
}

function sendDownload(response: Response, download: Download): void {
  response.setHeader('Content-Type', download.contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${download.filename}"`);
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.send(download.buffer);
}

@ApiTags('descargas')
@ApiCookieAuth('session')
@Controller()
export class DownloadsController {
  constructor(private readonly service: DownloadsService) {}

  @Get('reportes/:slug/exportar')
  @Permissions('REPORTES_VER')
  @UseGuards(FinancialExportGuard)
  @ApiParam({ name: 'slug', enum: Object.keys(reports) })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({
    summary: 'Exporta todos los resultados filtrados (máximo total 10000 filas)',
    description: 'CSV requiere conjunto (1 a N); XLSX incluye una hoja por resultset. page/pageSize no limitan la descarga. facturas-saldo, ingresos y compras-proveedor requieren además ADMINISTRADOR o CAJA.',
  })
  async report(
    @Param('slug') slug: string,
    @Query() query: ReportExportQuery,
    @Res() response: Response,
  ): Promise<void> {
    sendDownload(response, await this.service.report(slug, query));
  }

  @Get('facturas/:id/pdf')
  @Roles('ADMINISTRADOR', 'CAJA')
  @Permissions('FACTURAR', 'PAGOS_REGISTRAR', 'REPORTES_VER')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Descarga la factura persistida, simulada y sin validez fiscal' })
  async invoice(
    @Param('id', IdPipe) id: number,
    @Res() response: Response,
  ): Promise<void> {
    sendDownload(response, await this.service.invoice(id));
  }
}
