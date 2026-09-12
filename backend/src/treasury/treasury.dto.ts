import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Length, Min } from "class-validator";

export class CreateTreasuryAccountDto {
  @IsIn(["BANK", "WALLET"])
  type!: "BANK" | "WALLET";

  @IsString()
  @Length(2, 120)
  institution!: string;

  @IsString()
  @Length(2, 120)
  accountName!: string;

  @IsString()
  @Length(3, 80)
  accountNumber!: string;

  @IsOptional()
  @IsString()
  cbuOrCvu?: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  openingBalance?: number;
}

export class UpdateTreasuryAccountDto {
  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  cbuOrCvu?: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateCashBoxDto {
  @IsString()
  @Length(2, 40)
  code!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  workId?: string;

  @IsOptional()
  @IsNumber()
  openingBalance?: number;
}

export class TreasuryTransferDto {
  @IsString()
  source!: string;

  @IsString()
  destination!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  concept?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  workId?: string;
}

export class ReconcileAccountDto {
  @IsNumber()
  statementBalance!: number;

  @IsOptional()
  @IsString()
  statementDate?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
