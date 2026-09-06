import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import type { Request } from "express";
import { Observable, mergeMap } from "rxjs";
import type { AuthUser } from "./current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

const actionByMethod: Record<string, AuditAction | undefined> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.SOFT_DELETE,
};

const secretKeys = new Set([
  "password",
  "newpassword",
  "refreshtoken",
  "mfacode",
  "mfasecret",
  "token",
  "secret",
  "authorization",
  "cookie",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[MAX_DEPTH]";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.slice(0, 5_000);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redact(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const withJson = value as { toJSON?: () => unknown };
  if (typeof withJson.toJSON === "function") {
    return redact(withJson.toJSON(), depth + 1);
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    sanitized[key] = secretKeys.has(key.toLowerCase())
      ? "[REDACTED]"
      : redact(item, depth + 1);
  }
  return sanitized;
}

function sanitizedBody(body: unknown): object | undefined {
  const sanitized = redact(body);
  return sanitized && typeof sanitized === "object"
    ? (sanitized as object)
    : undefined;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType() !== "http") return next.handle();
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; requestId?: string }>();
    const action = actionByMethod[request.method];
    const parts = request.path.split("/").filter(Boolean);
    const root = parts.find((part) =>
      ["auth", "dashboard", "works", "documents", "records", "system", "approvals", "health"].includes(part),
    );
    const params = request.params as Record<string, string> | undefined;
    const module = root === "records" ? params?.module ?? "records" : root ?? "system";
    const before =
      action === AuditAction.UPDATE || action === AuditAction.SOFT_DELETE
        ? await this.snapshot(root, params?.id, module, request.user)
        : undefined;

    return next.handle().pipe(
      mergeMap(async (result) => {
        if (!action || !request.user) return result;
        const entityId =
          (result as { id?: string } | undefined)?.id ??
          params?.id;
        await this.prisma.auditLog.create({
          data: {
            userId: request.user.id,
            action,
            module,
            entityType: root,
            entityId,
            workId:
              params?.workId ??
              (request.body as { workId?: string } | undefined)?.workId,
            before,
            after: sanitizedBody(result) ?? sanitizedBody(request.body),
            ipAddress: request.ip,
            userAgent: request.get("user-agent")?.slice(0, 500),
            requestId: request.get("x-request-id"),
          },
        });
        return result;
      }),
    );
  }

  private async snapshot(
    root: string | undefined,
    id: string | undefined,
    module: string,
    user: AuthUser | undefined,
  ) {
    if (!id || !user) return undefined;
    let value: unknown;
    if (root === "works") {
      value = await this.prisma.work.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      });
    } else if (root === "records") {
      value = await this.prisma.genericRecord.findFirst({
        where: {
          id,
          module,
          deletedAt: null,
          OR: [{ workId: null }, { work: { companyId: user.companyId } }],
        },
      });
    } else if (root === "documents") {
      value = await this.prisma.document.findFirst({
        where: {
          id,
          deletedAt: null,
          OR: [{ workId: null }, { work: { companyId: user.companyId } }],
        },
      });
    } else if (root === "system") {
      value = await this.prisma.user.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          mfaEnabled: true,
        },
      });
    }
    return sanitizedBody(value);
  }
}
