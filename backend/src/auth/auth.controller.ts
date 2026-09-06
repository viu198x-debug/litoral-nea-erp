import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { Public } from "../common/public.decorator";
import { CsrfService } from "../security/csrf.service";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
  ) {}

  private setSessionCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const names = this.csrf.cookieNames;
    response.cookie(
      names.access,
      tokens.accessToken,
      this.csrf.sessionCookieOptions(15 * 60_000),
    );
    response.cookie(
      names.refresh,
      tokens.refreshToken,
      this.csrf.sessionCookieOptions(7 * 86_400_000),
    );
  }

  @Public()
  @Get("csrf")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  csrfToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const binding = request.cookies?.[this.csrf.cookieNames.binding] as
      | string
      | undefined;
    return { csrfToken: this.csrf.issue(response, binding) };
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleCodes: user.roleCodes,
    };
  }

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto, {
      ip: request.ip,
      userAgent: request.get("user-agent"),
    });
    this.setSessionCookies(response, result);
    return {
      user: result.user,
      csrfToken: this.csrf.issue(response, result.sessionId),
    };
  }

  @Public()
  @Post("refresh")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[this.csrf.cookieNames.refresh] as
      | string
      | undefined;
    if (!token) throw new UnauthorizedException("Falta token de renovación");
    const result = await this.auth.refresh(token);
    this.setSessionCookies(response, result);
    return {
      refreshed: true,
      csrfToken: this.csrf.issue(response, result.sessionId),
    };
  }

  @Post("logout")
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(user.sessionId, user.id, {
      ip: request.ip,
      userAgent: request.get("user-agent"),
    });
    this.csrf.clear(response);
    return { loggedOut: true };
  }

  @Public()
  @Post("forgot-password")
  @Throttle({ default: { limit: 4, ttl: 900_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Public()
  @Post("reset-password")
  @Throttle({ default: { limit: 6, ttl: 900_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }
}
