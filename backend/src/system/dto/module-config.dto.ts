import { PartialType } from "@nestjs/mapped-types";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export const MODULE_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "datetime",
  "select",
  "boolean",
  "email",
  "tax-id",
  "file",
] as const;

export class CreateModuleDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,48}$/)
  slug: string;

  @IsString()
  @MaxLength(80)
  label: string;

  @IsString()
  @MaxLength(60)
  groupName: string;

  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9]{1,48}$/)
  @IsOptional()
  icon?: string;

  @IsString()
  @MaxLength(300)
  summary: string;

  @IsBoolean()
  @IsOptional()
  requiresWork?: boolean;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}

export class CreateModuleFieldDto {
  @IsString()
  @Matches(/^[a-z][A-Za-z0-9]{1,48}$/)
  fieldKey: string;

  @IsString()
  @MaxLength(100)
  label: string;

  @IsIn(MODULE_FIELD_TYPES)
  fieldType: (typeof MODULE_FIELD_TYPES)[number];

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsArray()
  @IsOptional()
  options?: string[];

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateModuleFieldDto extends PartialType(CreateModuleFieldDto) {}

export class SetRoleModulePermissionDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{2,60}$/)
  roleCode: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,48}$/)
  module: string;

  @IsString()
  @IsIn(["view", "create", "modify", "approve", "void", "download", "export", "admin"])
  action: string;

  @IsBoolean()
  allowed: boolean;
}
