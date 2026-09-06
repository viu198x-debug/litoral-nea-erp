import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @MaxLength(254)
  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
