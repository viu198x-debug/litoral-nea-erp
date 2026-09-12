import { IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class UpdateAssetLiveStateDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  speedKmh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  headingDeg?: number;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  locationText?: string;

  @IsIn(["AVAILABLE", "IN_USE", "STOPPED", "MAINTENANCE", "OUT_OF_SERVICE", "REPAIR", "TRANSFER"])
  operationalStatus!: string;

  @IsIn(["MOBILE", "GPS", "MANUAL"])
  source!: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  deviceId?: string;
}

export class CreateVehicleFineDto {
  @IsString()
  @Length(2, 120)
  authority!: string;

  @IsString()
  @Length(2, 120)
  fineNumber!: string;

  @IsString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  location?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  driver?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  receiptReference?: string;
}

export class CreateAssetComplianceDto {
  @IsString()
  @Length(2, 100)
  documentType!: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  issuedAt?: string;

  @IsString()
  expiresAt!: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  issuer?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
