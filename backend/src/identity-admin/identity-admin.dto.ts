import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from "class-validator";

export class UpdateManagedUserDto {
  @IsOptional() @IsEmail() @Length(5, 160) email?: string;
  @IsOptional() @IsString() @Length(3, 50) @Matches(/^[a-zA-Z0-9._-]+$/) username?: string;
  @IsOptional() @IsString() @Length(2, 80) firstName?: string;
  @IsOptional() @IsString() @Length(2, 80) lastName?: string;
}

export class ResetManagedPasswordDto {
  @IsOptional()
  @IsString()
  @Length(12, 72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: "La contraseña debe incluir mayúscula, minúscula, número y símbolo",
  })
  password?: string;

  @IsOptional() @IsBoolean() generate?: boolean;
}

export class RoleAssignmentDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{2,60}$/) roleCode!: string;
  @IsOptional() @IsString() workId?: string;
}

export class ReplaceUserRolesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentDto)
  roles!: RoleAssignmentDto[];
}

export class DirectPermissionDto {
  @IsString() @Matches(/^[a-z][a-z0-9-]{1,48}$/) module!: string;
  @IsString() @IsIn(["view", "create", "modify", "approve", "void", "download", "export", "admin"]) action!: string;
  @IsBoolean() allowed!: boolean;
  @IsOptional() @IsString() workId?: string;
}

export class ReplaceUserPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectPermissionDto)
  permissions!: DirectPermissionDto[];
}

export class CreateManagedRoleDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{2,60}$/) code!: string;
  @IsString() @Length(3, 100) name!: string;
  @IsOptional() @IsString() @Length(0, 300) description?: string;
}

export class UpdateManagedRoleDto {
  @IsOptional() @IsString() @Length(3, 100) name?: string;
  @IsOptional() @IsString() @Length(0, 300) description?: string;
}
