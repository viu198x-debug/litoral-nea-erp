import { Module } from "@nestjs/common";
import { TreasuryController } from "./treasury.controller";
import { TreasuryOverviewRecordsController } from "./treasury-overview-records.controller";
import { TreasuryRecordsController } from "./treasury-records.controller";
import { TreasuryService } from "./treasury.service";

@Module({
  controllers: [TreasuryOverviewRecordsController, TreasuryRecordsController, TreasuryController],
  providers: [TreasuryService],
})
export class TreasuryModule {}
