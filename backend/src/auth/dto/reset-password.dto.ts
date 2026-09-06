import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  token: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: "La contraseña debe incluir mayúscula, minúscula, número y símbolo",
  })
  newPassword: string;
}
