import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import { Public } from "../common/public.decorator";
import { CsrfService } from "../security/csrf.service";
import { OAuthService, type OAuthProviderSlug } from "./oauth.service";

@Controller("auth/oauth")
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly csrf: CsrfService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get(":provider/start")
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  start(
    @Param("provider") rawProvider: string,
    @Res() response: Response,
  ) {
    const provider = this.provider(rawProvider);
    const authorization = this.oauth.createAuthorization(provider);
    response.cookie(this.stateCookieName(), authorization.sealedState, {
      ...this.stateCookieOptions(),
      maxAge: 10 * 60_000,
    });
    return response.redirect(302, authorization.url);
  }

  @Public()
  @Get(":provider/callback")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async callback(
    @Param("provider") rawProvider: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const provider = this.provider(rawProvider);
    const sealedState = request.cookies?.[this.stateCookieName()] as string | undefined;
    response.clearCookie(this.stateCookieName(), this.stateCookieOptions());
    if (error || !code || !state || !sealedState) {
      return response.redirect(303, this.frontendRedirect("error", provider));
    }
    try {
      const result = await this.oauth.complete(
        provider,
        code.slice(0, 4096),
        state.slice(0, 256),
        sealedState,
        { ip: request.ip, userAgent: request.get("user-agent") },
      );
      if (result.status === "pending") {
        return response.redirect(303, this.frontendRedirect("pending", provider));
      }
      const names = this.csrf.cookieNames;
      response.cookie(
        names.access,
        result.session.accessToken,
        this.csrf.sessionCookieOptions(15 * 60_000),
      );
      response.cookie(
        names.refresh,
        result.session.refreshToken,
        this.csrf.sessionCookieOptions(7 * 86_400_000),
      );
      this.csrf.issue(response, result.session.sessionId);
      return response.redirect(303, this.frontendRedirect("success", provider));
    } catch {
      return response.redirect(303, this.frontendRedirect("error", provider));
    }
  }

  private provider(value: string): OAuthProviderSlug {
    if (value !== "google" && value !== "microsoft") {
      throw new BadRequestException("Proveedor OAuth no válido");
    }
    return value;
  }

  private stateCookieName() {
    return `${this.config.get("COOKIE_SECURE", "false") === "true" ? "__Host-" : ""}lnea_oauth_state`;
  }

  private stateCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get("COOKIE_SECURE", "false") === "true",
      sameSite: "lax",
      path: "/",
      priority: "high",
    };
  }

  private frontendRedirect(status: "success" | "pending" | "error", provider: OAuthProviderSlug) {
    const origin = this.config
      .get<string>("FRONTEND_URL", "http://localhost:3000")
      .split(",")[0]
      .trim();
    const url = new URL(origin);
    url.searchParams.set("oauth", status);
    url.searchParams.set("provider", provider);
    return url.toString();
  }
}
