import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { envPaths, validateEnvironment } from './common/config';
import { DatabaseModule } from './database/database.module';
import { AccessGuard } from './modules/auth/access';
import { AuthModule } from './modules/auth/auth.module';
import { MastersModule } from './modules/masters/masters.module';
import { ServiceModule } from './modules/service/service.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StatusModule } from './modules/status/status.module';
import { DownloadsModule } from './modules/downloads/downloads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envPaths,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AuthModule,
    MastersModule,
    ServiceModule,
    InventoryModule,
    PurchasingModule,
    BillingModule,
    ReportsModule,
    DownloadsModule,
    StatusModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AccessGuard }],
})
export class AppModule {}
