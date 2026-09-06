import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthUser } from "../../common/current-user.decorator";
import {
  PERMISSIONS_KEY,
  type RequiredPermission,
} from "../../common/permissions.decorator";
import { IS_PUBLIC_KEY } from "../../common/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { ERP_MODULES } from "../../common/validation.pipes";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    const user = request.user;
    if (!user) return false;

    const params = request.params as Record<string, string>;
    const body = request.body as { workId?: string } | undefined;
    const query = request.query as { workId?: string } | undefined;
    const module = required.module.startsWith(":")
      ? params[required.module.slice(1)]
      : required.module;
    if (!ERP_MODULES.has(module)) {
      throw new ForbiddenException("Módulo no autorizado");
    }

    let workId: string | null =
      params.workId ??
      params.idWork ??
      body?.workId ??
      query?.workId ??
      (module === "works" ? params.id : undefined) ??
      null;
    const path = request.originalUrl.split("?")[0];
    if (!workId && params.id && path.includes("/documents/")) {
      workId =
        (
          await this.prisma.document.findFirst({
            where: { id: params.id, deletedAt: null },
            select: { workId: true },
          })
        )?.workId ?? null;
    }
    if (!workId && params.id && path.includes("/records/")) {
      workId =
        (
          await this.prisma.genericRecord.findFirst({
            where: { id: params.id, module, deletedAt: null },
            select: { workId: true },
          })
        )?.workId ?? null;
    }
    if (!workId && params.id && path.includes("/approvals/")) {
      workId =
        (
          await this.prisma.approvalInstance.findFirst({
            where: { id: params.id },
            select: { workId: true },
          })
        )?.workId ?? null;
    }
    if (workId) {
      const belongsToCompany = await this.prisma.work.findFirst({
        where: { id: workId, companyId: user.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!belongsToCompany) throw new ForbiddenException("Obra no autorizada");
      if (user.roleCodes.some((code) => code.startsWith("TEC_"))) {
        const membership = await this.prisma.workMember.findFirst({
          where: { workId, userId: user.id, endDate: null },
          select: { id: true },
        });
        if (!membership) {
          throw new ForbiddenException("El técnico no está asignado a esta obra");
        }
      }
    }

    if (user.roleCodes.includes("ADMIN_GENERAL")) return true;

    const direct = await this.prisma.userPermission.findFirst({
      where: {
        userId: user.id,
        OR: workId ? [{ workId: null }, { workId }] : [{ workId: null }],
        permission: {
          module: { in: [module, "*"] },
          action: { in: [required.action, "*"] },
        },
      },
      orderBy: { allowed: "asc" },
    });
    if (direct) {
      if (!direct.allowed) throw new ForbiddenException("Permiso denegado");
      return true;
    }

    const rolePermission = await this.prisma.userRole.findFirst({
      where: {
        userId: user.id,
        OR: workId ? [{ workId: null }, { workId }] : [{ workId: null }],
        role: {
          permissions: {
            some: {
              allowed: true,
              permission: {
                module: { in: [module, "*"] },
                action: { in: [required.action, "*"] },
              },
            },
          },
        },
      },
    });
    if (!rolePermission) {
      throw new ForbiddenException(
        `Sin permiso ${required.action} en ${module}`,
      );
    }
    return true;
  }
}
