import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class WorkflowStepDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{2,60}$/)
  role: string;

  @IsString()
  @MaxLength(100)
  label: string;
}

export class CreateWorkflowDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9-]{2,60}$/)
  code: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,48}$/)
  module: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[];

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  version?: number;
}

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {}
