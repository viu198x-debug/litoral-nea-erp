import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { CsrfService } from "./csrf.service";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    config: ConfigService,
    private readonly csrf: CsrfService,
  ) {
    this.allowedOrigins = new Set(
      config
        .get<string>("FRONTEND_URL", "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim()),
    );
  }

  canActivate(context: ExecutionContext) {
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    if (request.get("sec-fetch-site") === "cross-site") {
      throw new ForbiddenException({ code: "CSRF_INVALID", message: "Solicitud cruzada bloqueada" });
    }
    const origin = request.get("origin");
    if (origin && !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException({ code: "CSRF_INVALID", message: "Origen no autorizado" });
    }

    const names = this.csrf.cookieNames;
    const authorization = request.get("authorization");
    if (
      !request.cookies?.[names.access] &&
      authorization &&
      /^Bearer\s+[A-Za-z0-9._~-]+$/i.test(authorization)
    ) {
      return true;
    }
    const binding = request.cookies?.[names.binding] as string | undefined;
    const cookieToken = request.cookies?.[names.csrf] as string | undefined;
    const headerToken = request.get("x-csrf-token");
    if (
      !binding ||
      !cookieToken ||
      !headerToken ||
      !this.csrf.matches(cookieToken, headerToken) ||
      !this.csrf.verify(binding, headerToken)
    ) {
      throw new ForbiddenException({ code: "CSRF_INVALID", message: "Token CSRF no válido" });
    }
    return true;
  }
}
