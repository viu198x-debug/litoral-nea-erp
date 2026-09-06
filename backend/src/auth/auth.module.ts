import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { OAuthController } from "./oauth.controller";
import { OAuthService } from "./oauth.service";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({}),
  ],
  controllers: [AuthController, OAuthController],
  providers: [AuthService, JwtStrategy, OAuthService],
  exports: [AuthService],
})
export class AuthModule {}
