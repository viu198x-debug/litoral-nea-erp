import { UserStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ApproveRegistrationDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  roleCode?: string;
}

export class RejectRegistrationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class SetUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
