import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import {
  TreasuryAccountType,
  TreasuryChequeKind,
  TreasuryChequeStatus,
  TreasuryMovementType,
} from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const ENTITY_ID = /^c[a-z0-9]{20,32}$/;

export class CreateTreasuryAccountDto {
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{2,30}$/)
  code: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsEnum(TreasuryAccountType)
  type: TreasuryAccountType;

  @IsString() @MaxLength(120) @IsOptional() institution?: string;
  @IsString() @MaxLength(80) @IsOptional() accountNumber?: string;
  @IsString() @Matches(/^\d{22}$/) @IsOptional() cbu?: string;
  @IsString() @MaxLength(80) @IsOptional() alias?: string;
  @IsString() @MaxLength(120) @IsOptional() holderName?: string;
  @IsString() @MaxLength(20) @IsOptional() holderTaxId?: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  currency?: string;

  @IsNumber() @IsOptional() openingBalance?: number;
  @IsNumber() @Min(0) @IsOptional() overdraftLimit?: number;
  @IsString() @Matches(ENTITY_ID) @IsOptional() treasurerId?: string;
  @IsBoolean() @IsOptional() includeInCashPosition?: boolean;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class UpdateTreasuryAccountDto extends PartialType(CreateTreasuryAccountDto) {}

export class CreateTreasuryMovementDto {
  @IsString() @Matches(ENTITY_ID) @IsOptional() workId?: string;
  @IsString() @Matches(ENTITY_ID) @IsOptional() sourceAccountId?: string;
  @IsString() @Matches(ENTITY_ID) @IsOptional() destinationAccountId?: string;
  @IsString() @Matches(ENTITY_ID) @IsOptional() chequeId?: string;

  @IsEnum(TreasuryMovementType)
  type: TreasuryMovementType;

  @IsString() @MaxLength(180) concept: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsString() @Matches(/^[A-Z]{3}$/) @IsOptional() currency?: string;
  @IsDateString() @IsOptional() occurredAt?: string;
  @IsDateString() @IsOptional() valueDate?: string;
  @IsString() @MaxLength(50) @IsOptional() counterpartyType?: string;
  @IsString() @MaxLength(160) @IsOptional() counterparty?: string;
  @IsString() @MaxLength(60) @IsOptional() paymentMethod?: string;
  @IsString() @MaxLength(100) @IsOptional() reference?: string;
  @IsString() @MaxLength(100) @IsOptional() receiptNumber?: string;
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}

export class MovementDecisionDto {
  @IsString() @MaxLength(1000) @IsOptional() comments?: string;
}

export class VoidMovementDto {
  @IsString() @MaxLength(1000) reason: string;
}

export class CreateTreasuryChequeDto {
  @IsString() @Matches(ENTITY_ID) @IsOptional() accountId?: string;
  @IsString() @Matches(ENTITY_ID) @IsOptional() workId?: string;
  @IsEnum(TreasuryChequeKind) kind: TreasuryChequeKind;
  @IsEnum(TreasuryChequeStatus) @IsOptional() status?: TreasuryChequeStatus;
  @IsString() @MaxLength(40) number: string;
  @IsString() @MaxLength(120) bankName: string;
  @IsString() @MaxLength(80) @IsOptional() branch?: string;
  @IsString() @MaxLength(80) @IsOptional() accountNumber?: string;
  @IsString() @MaxLength(160) issuerName: string;
  @IsString() @MaxLength(20) @IsOptional() issuerTaxId?: string;
  @IsString() @MaxLength(160) @IsOptional() beneficiary?: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsDateString() issueDate: string;
  @IsDateString() dueDate: string;
  @IsDateString() @IsOptional() receivedAt?: string;
  @IsArray() @ArrayMaxSize(20) @IsOptional() endorsementChain?: Array<Record<string, unknown>>;
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}

export class UpdateChequeStatusDto {
  @IsEnum(TreasuryChequeStatus) status: TreasuryChequeStatus;
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}

export class ReconciliationItemDto {
  @IsString() @Matches(ENTITY_ID) @IsOptional() movementId?: string;
  @IsDateString() occurredAt: string;
  @IsString() @MaxLength(180) description: string;
  @IsNumber() statementAmount: number;
  @IsNumber() bookAmount: number;
  @IsBoolean() @IsOptional() matched?: boolean;
  @IsString() @MaxLength(500) @IsOptional() notes?: string;
}

export class CreateReconciliationDto {
  @IsString() @Matches(ENTITY_ID) accountId: string;
  @IsDateString() periodFrom: string;
  @IsDateString() periodTo: string;
  @IsNumber() statementOpening: number;
  @IsNumber() statementClosing: number;
  @IsNumber() bookOpening: number;
  @IsNumber() bookClosing: number;
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => ReconciliationItemDto)
  items: ReconciliationItemDto[];
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}

export class CreateCashCountDto {
  @IsString() @Matches(ENTITY_ID) accountId: string;
  @IsNumber() @Min(0) countedBalance: number;
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => CashDenominationDto)
  denominations: CashDenominationDto[];
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}

export class CashDenominationDto {
  @IsNumber() @Min(0.01) denomination: number;
  @IsNumber() @Min(0) quantity: number;
  @IsNumber() @Min(0) subtotal: number;
}

export class CreateDailyCloseDto {
  @IsDateString() closedDate: string;
  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
}
