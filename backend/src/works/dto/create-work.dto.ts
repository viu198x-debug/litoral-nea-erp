import { OrganizationType, WorkStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from "class-validator";

export class CreateWorkDto {
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  code: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(WorkStatus)
  @IsOptional()
  status?: WorkStatus;

  @IsString()
  @IsOptional()
  @Matches(/^c[a-z0-9]{20,32}$/)
  clientId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  clientName?: string;

  @IsEnum(OrganizationType)
  @IsOptional()
  organizationType?: OrganizationType;

  @IsString()
  @MaxLength(80)
  costCenter: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  agency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  ministry?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  municipality?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  contractNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  dossierNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  city?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  contractualEndDate?: string;

  @IsNumber()
  @Min(0)
  contractAmount: number;

  @IsNumber()
  @Min(0)
  targetBudget: number;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  responsibleName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
