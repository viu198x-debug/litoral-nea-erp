import { Module } from "@nestjs/common";
import { TreasuryController } from "./treasury.controller";
import { TreasuryOverviewRecordsController } from "./treasury-overview-records.controller";
import { TreasuryRecordsController } from "./treasury-records.controller";
import { TreasuryService } from "./treasury.service";
import { TreasuryControlController } from "./treasury-control.controller";
import { TreasuryControlService } from "./treasury-control.service";

@Module({
  controllers: [TreasuryOverviewRecordsController, TreasuryRecordsController, TreasuryController, TreasuryControlController],
  providers: [TreasuryService, TreasuryControlService],
})
export class TreasuryModule {}
