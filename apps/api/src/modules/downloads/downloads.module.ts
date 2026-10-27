import { Module } from '@nestjs/common';
import { ReportsRepository } from '../reports/reports.repository';
import { DownloadsController, FinancialExportGuard } from './downloads.controller';
import { DownloadsService } from './downloads.service';

@Module({
  controllers: [DownloadsController],
  providers: [ReportsRepository, DownloadsService, FinancialExportGuard],
})
export class DownloadsModule {}
