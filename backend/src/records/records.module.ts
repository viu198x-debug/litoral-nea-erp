import { Module } from "@nestjs/common";
import { RecordsController } from "./records.controller";
import { RecordsService } from "./records.service";
import { OperationalRecordsService } from "./operational-records.service";

@Module({
  controllers: [RecordsController],
  providers: [RecordsService, OperationalRecordsService],
})
export class RecordsModule {}
