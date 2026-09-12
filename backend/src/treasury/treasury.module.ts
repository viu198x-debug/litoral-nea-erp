import { Module } from "@nestjs/common";
import { TreasuryController } from "./treasury.controller";
import { TreasuryRecordsController } from "./treasury-records.controller";
import { TreasuryService } from "./treasury.service";

@Module({
  controllers: [TreasuryRecordsController, TreasuryController],
  providers: [TreasuryService],
})
export class TreasuryModule {}
