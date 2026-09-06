import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

@Injectable()
export class CsrfService {
  constructor(private readonly config: ConfigService) {}

  private get secure() {
    return this.config.get("COOKIE_SECURE", "false") === "true";
  }

  get cookieNames() {
    const prefix = this.secure ? "__Host-" : "";
    return {
      access: `${prefix}lnea_access`,
      refresh: `${prefix}lnea_refresh`,
      csrf: `${prefix}lnea_csrf`,
      binding: `${prefix}lnea_csrf_binding`,
    };
  }

  private cookieOptions(httpOnly: boolean): CookieOptions {
    return {
      httpOnly,
      secure: this.secure,
      sameSite: "strict",
      path: "/",
      priority: "high",
    };
  }

  issue(response: Response, binding = randomBytes(32).toString("hex")) {
    const nonce = randomBytes(32).toString("hex");
    const token = this.sign(binding, nonce);
    const names = this.cookieNames;
    response.cookie(names.binding, binding, {
      ...this.cookieOptions(true),
      maxAge: 7 * 86_400_000,
    });
    response.cookie(names.csrf, token, {
      ...this.cookieOptions(false),
      maxAge: 7 * 86_400_000,
    });
    return token;
  }

  verify(binding: string, token: string) {
    const [providedHmac, nonce, extra] = token.split(".");
    if (!providedHmac || !nonce || extra || !/^[a-f0-9]{64}$/i.test(nonce)) {
      return false;
    }
    const expected = this.sign(binding, nonce).split(".")[0];
    if (!/^[a-f0-9]{64}$/i.test(providedHmac)) return false;
    const providedBuffer = Buffer.from(providedHmac, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }

  matches(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  clear(response: Response) {
    const names = this.cookieNames;
    response.clearCookie(names.access, this.cookieOptions(true));
    response.clearCookie(names.refresh, this.cookieOptions(true));
    response.clearCookie(names.binding, this.cookieOptions(true));
    response.clearCookie(names.csrf, this.cookieOptions(false));
  }

  sessionCookieOptions(maxAge: number): CookieOptions {
    return { ...this.cookieOptions(true), maxAge };
  }

  private sign(binding: string, nonce: string) {
    const message = `${binding.length}!${binding}!${nonce.length}!${nonce}`;
    const hmac = createHmac(
      "sha256",
      this.config.getOrThrow<string>("CSRF_SECRET"),
    )
      .update(message)
      .digest("hex");
    return `${hmac}.${nonce}`;
  }
}
