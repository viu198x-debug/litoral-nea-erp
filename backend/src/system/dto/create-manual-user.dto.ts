import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from "class-validator";
import { UserStatus } from "@prisma/client";

export class CreateManualUserDto {
  @IsEmail()
  @Length(5, 160)
  email!: string;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username?: string;

  @IsString()
  @Length(2, 80)
  firstName!: string;

  @IsString()
  @Length(2, 80)
  lastName!: string;

  @IsString()
  @Length(3, 80)
  roleCode!: string;

  @IsString()
  @Length(10, 72)
  password!: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
