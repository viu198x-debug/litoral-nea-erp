import { RecordStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateRecordDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  code: string;

  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  @IsOptional()
  @Matches(/^c[a-z0-9]{20,32}$/)
  workId?: string;

  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}
