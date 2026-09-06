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
  @Length(12, 72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: "La contraseña debe incluir mayúscula, minúscula, número y símbolo",
  })
  password!: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
