import { Module } from "@nestjs/common";
import { SystemController } from "./system.controller";
import { SystemService } from "./system.service";
import { ConfigurationController } from "./configuration.controller";

@Module({
  controllers: [SystemController, ConfigurationController],
  providers: [SystemService],
})
export class SystemModule {}
