import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from "class-validator";

export class MaterialTakeoffItemDto {
  @IsString()
  @Length(1, 80)
  code!: string;

  @IsString()
  @Length(2, 240)
  description!: string;

  @IsString()
  @Length(1, 30)
  unit!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;
}

export class CreateMaterialTakeoffDto {
  @IsString()
  @Length(20, 40)
  workId!: string;

  @IsString()
  @Length(3, 180)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  version!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => MaterialTakeoffItemDto)
  items!: MaterialTakeoffItemDto[];
}

export class MaterialRequestItemDto {
  @IsString()
  @Length(1, 80)
  takeoffItemCode!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateMaterialRequestDto {
  @IsString()
  @Length(20, 40)
  workId!: string;

  @IsString()
  @Length(20, 40)
  takeoffId!: string;

  @IsOptional()
  @IsDateString()
  requiredAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => MaterialRequestItemDto)
  items!: MaterialRequestItemDto[];

  @IsOptional()
  @IsString()
  @Length(0, 1200)
  overrunReason?: string;
}

export class ApproveMaterialRequestDto {
  @IsIn(["APPROVE", "REJECT"])
  decision!: "APPROVE" | "REJECT";

  @IsOptional()
  @IsString()
  @Length(0, 1200)
  comments?: string;
}

export class DeliveryNoteItemDto {
  @IsString()
  @Length(1, 80)
  takeoffItemCode!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;
}

export class CreateDeliveryNoteDto {
  @IsString()
  @Length(20, 40)
  requestId!: string;

  @IsOptional()
  @IsString()
  @Length(0, 30)
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  driver?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => DeliveryNoteItemDto)
  items!: DeliveryNoteItemDto[];
}
