import { Module } from "@nestjs/common";
import { RecordsController } from "./records.controller";
import { RecordsService } from "./records.service";
import { OperationalRecordsService } from "./operational-records.service";
import { BusinessRecordsService } from "./business-records.service";
import { ConstructionCoreRecordsService } from "./construction-core-records.service";

@Module({
  controllers: [RecordsController],
  providers: [RecordsService, OperationalRecordsService, BusinessRecordsService, ConstructionCoreRecordsService],
})
export class RecordsModule {}
