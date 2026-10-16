import { Module } from "@nestjs/common";
import { SystemController } from "./system.controller";
import { SystemService } from "./system.service";
import { ConfigurationController } from "./configuration.controller";
import { DataReadinessController } from "./data-readiness.controller";
import { DataReadinessService } from "./data-readiness.service";

@Module({
  controllers: [SystemController, ConfigurationController, DataReadinessController],
  providers: [SystemService, DataReadinessService],
})
export class SystemModule {}
