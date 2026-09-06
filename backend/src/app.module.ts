import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "./auth/guards/permissions.guard";
import { AuditInterceptor } from "./common/audit.interceptor";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DocumentsModule } from "./documents/documents.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RecordsModule } from "./records/records.module";
import { SystemModule } from "./system/system.module";
import { WorksModule } from "./works/works.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { validateEnvironment } from "./config/environment";
import { CsrfGuard } from "./security/csrf.guard";
import { SecurityModule } from "./security/security.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>("RATE_LIMIT_TTL_MS", 60_000),
          limit: config.get<number>("RATE_LIMIT_MAX", 120),
        },
      ],
    }),
    PrismaModule,
    SecurityModule,
    AuthModule,
    HealthModule,
    DashboardModule,
    WorksModule,
    DocumentsModule,
    RecordsModule,
    SystemModule,
    ApprovalsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
