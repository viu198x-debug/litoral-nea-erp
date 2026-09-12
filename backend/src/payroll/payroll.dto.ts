import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class UpdateEmployeePaymentScheduleDto {
  @IsIn(["MONTHLY", "FORTNIGHTLY"])
  frequency!: "MONTHLY" | "FORTNIGHTLY";

  @IsOptional()
  @IsNumber()
  @Min(1)
  monthlyDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  firstFortnightDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  secondFortnightDay?: number;

  @IsOptional()
  @IsString()
  paymentNotes?: string;
}

export class CreatePayrollExtraDto {
  @IsString()
  employeeId!: string;

  @IsString()
  period!: string;

  @IsString()
  concept!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  workId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}

export class BatchPayrollLineDto {
  @IsString()
  payrollId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraIds?: string[];
}

export class PayPayrollBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchPayrollLineDto)
  lines!: BatchPayrollLineDto[];

  @IsDateString()
  paidAt!: string;

  @IsString()
  sourceType!: "BANK" | "CASH";

  @IsString()
  sourceId!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
