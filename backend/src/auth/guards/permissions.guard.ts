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
      workId = await this.resolveRecordWorkId(module, params.id);
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
    if (
      user.roleCodes.includes("GERENTE_EMPRESA") &&
      module === "system" &&
      required.action === "admin"
    ) {
      return true;
    }

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

  private async resolveRecordWorkId(module: string, id: string): Promise<string | null> {
    switch (module) {
      case "budgets":
        return (await this.prisma.budget.findFirst({ where: { id, deletedAt: null }, select: { workId: true } }))?.workId ?? null;
      case "progress":
        return (await this.prisma.dailyReport.findFirst({ where: { id, deletedAt: null }, select: { workId: true } }))?.workId ?? null;
      case "certificates":
        return (await this.prisma.certificate.findFirst({ where: { id, deletedAt: null }, select: { workId: true } }))?.workId ?? null;
      case "dossiers":
        return (await this.prisma.dossier.findFirst({ where: { id, deletedAt: null }, select: { workId: true } }))?.workId ?? null;
      case "purchases":
        return (await this.prisma.purchaseOrder.findFirst({ where: { id, deletedAt: null }, select: { workId: true } }))?.workId ?? null;
      case "cash":
      case "banks":
      case "payments":
        return (await this.prisma.financialMovement.findFirst({ where: { id, deletedAt: null }, select: { workId: true } }))?.workId ?? null;
      case "fleet":
        return (await this.prisma.vehicle.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "fuel":
        return (await this.prisma.fuelLog.findFirst({ where: { id, voidedAt: null }, select: { workId: true } }))?.workId ?? null;
      case "machinery":
        return (await this.prisma.machine.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "maintenance":
        return (await this.prisma.maintenanceOrder.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "fuel-estimates":
        return (await this.prisma.fuelEstimate.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "insurance":
        return (await this.prisma.insurancePolicy.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "unexpected-tasks":
        return (await this.prisma.unexpectedTask.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "technical-workspace":
        return (await this.prisma.technicalTask.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "personnel-control":
        return (await this.prisma.attendanceRecord.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "safety": {
        const incident = await this.prisma.safetyIncident.findUnique({ where: { id }, select: { workId: true } });
        if (incident) return incident.workId;
        return (await this.prisma.safetyInspection.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      }
      case "assets":
        return (await this.prisma.generalAsset.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "stakeholders":
        return (await this.prisma.organizationStakeholderRole.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "payroll":
        return (await this.prisma.payroll.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "per-diems":
        return (await this.prisma.perDiem.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "lodging":
        return (await this.prisma.lodging.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      case "concrete":
        return (await this.prisma.concreteOrder.findUnique({ where: { id }, select: { workId: true } }))?.workId ?? null;
      default:
        return (
          await this.prisma.genericRecord.findFirst({
            where: { id, module, deletedAt: null },
            select: { workId: true },
          })
        )?.workId ?? null;
    }
  }
}
