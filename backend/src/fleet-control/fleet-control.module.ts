import { Module } from "@nestjs/common";
import { FleetControlController } from "./fleet-control.controller";
import { FleetControlService } from "./fleet-control.service";

@Module({
  controllers: [FleetControlController],
  providers: [FleetControlService],
})
export class FleetControlModule {}
