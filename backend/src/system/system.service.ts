import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RegistrationStatus, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/current-user.decorator";
import type {
  CreateModuleDto,
  CreateModuleFieldDto,
  SetRoleModulePermissionDto,
  UpdateModuleDto,
  UpdateModuleFieldDto,
} from "./dto/module-config.dto";
import type { CreateWorkflowDto, UpdateWorkflowDto } from "./dto/workflow-config.dto";

const permissionActions = [
  "view",
  "create",
  "modify",
  "approve",
  "void",
  "download",
  "export",
  "admin",
] as const;

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  users(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        roles: {
          select: {
            workId: true,
            role: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

  async setUserStatus(
    companyId: string,
    id: string,
    status: UserStatus,
    actorId: string,
  ) {
    if (id === actorId && status !== UserStatus.ACTIVE) {
      throw new BadRequestException("No puede bloquear o deshabilitar su propia cuenta");
    }
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          status,
          lockedUntil: status === UserStatus.LOCKED ? new Date("9999-12-31") : null,
          failedLoginAttempts: status === UserStatus.ACTIVE ? 0 : undefined,
        },
        select: { id: true, username: true, status: true },
      });
      if (status !== UserStatus.ACTIVE) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
  }

  roles() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  modules() {
    return this.prisma.moduleConfiguration.findMany({
      include: {
        fields: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ groupName: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
  }

  async availableModules(user: AuthUser) {
    const configurations = await this.prisma.moduleConfiguration.findMany({
      where: { active: true },
      include: {
        fields: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ groupName: "asc" }, { sortOrder: "asc" }],
    });
    if (user.roleCodes.includes("ADMIN_GENERAL")) {
      return configurations.map((module) => ({ ...module, actions: [...permissionActions] }));
    }
    const [rolePermissions, directPermissions] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where: {
          allowed: true,
          role: { users: { some: { userId: user.id } } },
        },
        include: { permission: true },
      }),
      this.prisma.userPermission.findMany({
        where: { userId: user.id, workId: null },
        include: { permission: true },
      }),
    ]);
    const actions = new Map<string, Set<string>>();
    for (const item of rolePermissions) {
      const current = actions.get(item.permission.module) ?? new Set<string>();
      current.add(item.permission.action);
      actions.set(item.permission.module, current);
    }
    for (const item of directPermissions) {
      const current = actions.get(item.permission.module) ?? new Set<string>();
      if (item.allowed) current.add(item.permission.action);
      else current.delete(item.permission.action);
      actions.set(item.permission.module, current);
    }
    return configurations
      .filter((module) => actions.get(module.slug)?.has("view"))
      .map((module) => ({ ...module, actions: [...(actions.get(module.slug) ?? [])] }));
  }

  async createModule(dto: CreateModuleDto, actorId: string) {
    const exists = await this.prisma.moduleConfiguration.findUnique({
      where: { slug: dto.slug },
    });
    if (exists) throw new BadRequestException("Ya existe un módulo con ese código");
    return this.prisma.$transaction(async (tx) => {
      const module = await tx.moduleConfiguration.create({
        data: { ...dto, isSystem: false },
      });
      await Promise.all(
        permissionActions.map((action) =>
          tx.permission.upsert({
            where: { module_action: { module: dto.slug, action } },
            create: { module: dto.slug, action },
            update: {},
          }),
        ),
      );
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: AuditAction.CREATE,
          module: "system",
          entityType: "module-configuration",
          entityId: module.id,
          after: dto as unknown as Prisma.InputJsonValue,
        },
      });
      return module;
    });
  }

  async updateModule(id: string, dto: UpdateModuleDto, actorId: string) {
    const current = await this.prisma.moduleConfiguration.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Módulo no encontrado");
    if (current.isSystem && dto.slug && dto.slug !== current.slug) {
      throw new BadRequestException("No se puede cambiar el código de un módulo del sistema");
    }
    const updated = await this.prisma.moduleConfiguration.update({
      where: { id },
      data: dto,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.UPDATE,
        module: "system",
        entityType: "module-configuration",
        entityId: id,
        before: current as unknown as Prisma.InputJsonValue,
        after: updated as unknown as Prisma.InputJsonValue,
      },
    });
    return updated;
  }

  async createModuleField(id: string, dto: CreateModuleFieldDto, actorId: string) {
    const module = await this.prisma.moduleConfiguration.findUnique({ where: { id } });
    if (!module) throw new NotFoundException("Módulo no encontrado");
    const field = await this.prisma.moduleFieldConfiguration.create({
      data: {
        ...dto,
        moduleId: id,
        options: (dto.options ?? []) as Prisma.InputJsonValue,
        settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.CREATE,
        module: "system",
        entityType: "module-field-configuration",
        entityId: field.id,
        after: { module: module.slug, ...dto } as Prisma.InputJsonValue,
      },
    });
    return field;
  }

  async updateModuleField(id: string, dto: UpdateModuleFieldDto, actorId: string) {
    const current = await this.prisma.moduleFieldConfiguration.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Campo no encontrado");
    const updated = await this.prisma.moduleFieldConfiguration.update({
      where: { id },
      data: {
        ...dto,
        options: dto.options as Prisma.InputJsonValue | undefined,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.UPDATE,
        module: "system",
        entityType: "module-field-configuration",
        entityId: id,
        before: current as unknown as Prisma.InputJsonValue,
        after: updated as unknown as Prisma.InputJsonValue,
      },
    });
    return updated;
  }

  async setRolePermission(dto: SetRoleModulePermissionDto, actorId: string) {
    const [role, permission] = await Promise.all([
      this.prisma.role.findUnique({ where: { code: dto.roleCode } }),
      this.prisma.permission.findUnique({
        where: { module_action: { module: dto.module, action: dto.action } },
      }),
    ]);
    if (!role) throw new NotFoundException("Rol no encontrado");
    if (!permission) throw new NotFoundException("Permiso no encontrado");
    const result = await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      create: { roleId: role.id, permissionId: permission.id, allowed: dto.allowed },
      update: { allowed: dto.allowed },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.UPDATE,
        module: "system",
        entityType: "role-permission",
        entityId: `${role.id}:${permission.id}`,
        after: dto as unknown as Prisma.InputJsonValue,
      },
    });
    return result;
  }

  workflows() {
    return this.prisma.workflowDefinition.findMany({
      orderBy: [{ module: "asc" }, { version: "desc" }, { name: "asc" }],
    });
  }

  async createWorkflow(dto: CreateWorkflowDto, actorId: string) {
    if (dto.maxAmount !== undefined && dto.minAmount !== undefined && dto.maxAmount < dto.minAmount) {
      throw new BadRequestException("El monto máximo no puede ser menor al mínimo");
    }
    const module = await this.prisma.moduleConfiguration.findUnique({ where: { slug: dto.module } });
    if (!module?.active) throw new NotFoundException("Módulo activo no encontrado");
    const created = await this.prisma.workflowDefinition.create({
      data: {
        ...dto,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        steps: dto.steps as unknown as Prisma.InputJsonValue,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.CREATE,
        module: "system",
        entityType: "workflow-definition",
        entityId: created.id,
        after: dto as unknown as Prisma.InputJsonValue,
      },
    });
    return created;
  }

  async updateWorkflow(id: string, dto: UpdateWorkflowDto, actorId: string) {
    const current = await this.prisma.workflowDefinition.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Flujo no encontrado");
    const minAmount = dto.minAmount ?? (current.minAmount ? Number(current.minAmount) : undefined);
    const maxAmount = dto.maxAmount ?? (current.maxAmount ? Number(current.maxAmount) : undefined);
    if (maxAmount !== undefined && minAmount !== undefined && maxAmount < minAmount) {
      throw new BadRequestException("El monto máximo no puede ser menor al mínimo");
    }
    const updated = await this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        ...dto,
        steps: dto.steps as unknown as Prisma.InputJsonValue | undefined,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.UPDATE,
        module: "system",
        entityType: "workflow-definition",
        entityId: id,
        before: current as unknown as Prisma.InputJsonValue,
        after: updated as unknown as Prisma.InputJsonValue,
      },
    });
    return updated;
  }

  registrationRequests(companyId: string, status?: RegistrationStatus) {
    return this.prisma.registrationRequest.findMany({
      where: { companyId, status: status ?? RegistrationStatus.PENDING },
      select: {
        id: true,
        provider: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        requestedAt: true,
        reviewedAt: true,
        rejectionReason: true,
      },
      orderBy: { requestedAt: "desc" },
      take: 100,
    });
  }

  async approveRegistration(
    companyId: string,
    requestId: string,
    reviewerId: string,
    roleCode = "TEC_JEFE_OBRA",
  ) {
    const request = await this.prisma.registrationRequest.findFirst({
      where: {
        id: requestId,
        companyId,
        status: RegistrationStatus.PENDING,
      },
    });
    if (!request) throw new NotFoundException("Solicitud pendiente no encontrada");
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new BadRequestException("El rol solicitado no existe");
    const unusablePassword = await bcrypt.hash(randomBytes(48).toString("base64url"), 12);

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.registrationRequest.updateMany({
        where: {
          id: request.id,
          companyId,
          status: RegistrationStatus.PENDING,
        },
        data: {
          status: RegistrationStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          rejectionReason: null,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException("La solicitud ya fue procesada");
      }
      let user = await tx.user.findFirst({
        where: { companyId, email: request.email, deletedAt: null },
      });
      if (user?.status === UserStatus.DISABLED) {
        throw new BadRequestException("El correo pertenece a un usuario deshabilitado");
      }
      if (!user) {
        const username = await this.availableUsername(request.email, tx);
        user = await tx.user.create({
          data: {
            companyId,
            username,
            email: request.email,
            passwordHash: unusablePassword,
            firstName: request.firstName,
            lastName: request.lastName,
            status: UserStatus.ACTIVE,
          },
        });
      }
      await tx.externalIdentity.upsert({
        where: {
          provider_subject: {
            provider: request.provider,
            subject: request.providerSubject,
          },
        },
        create: {
          userId: user.id,
          provider: request.provider,
          subject: request.providerSubject,
          email: request.email,
        },
        update: { userId: user.id, email: request.email },
      });
      const existingRole = await tx.userRole.findFirst({
        where: { userId: user.id, roleId: role.id, workId: null },
      });
      if (!existingRole) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }
      const reviewed = await tx.registrationRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: { id: true, email: true, provider: true, status: true, reviewedAt: true },
      });
      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: AuditAction.APPROVE,
          module: "system",
          entityType: "registration-request",
          entityId: request.id,
          after: { email: request.email, provider: request.provider, roleCode },
        },
      });
      return reviewed;
    });
  }

  async rejectRegistration(
    companyId: string,
    requestId: string,
    reviewerId: string,
    reason: string,
  ) {
    const request = await this.prisma.registrationRequest.findFirst({
      where: {
        id: requestId,
        companyId,
        status: RegistrationStatus.PENDING,
      },
    });
    if (!request) throw new NotFoundException("Solicitud pendiente no encontrada");
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.registrationRequest.updateMany({
        where: {
          id: request.id,
          companyId,
          status: RegistrationStatus.PENDING,
        },
        data: {
          status: RegistrationStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          rejectionReason: reason,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException("La solicitud ya fue procesada");
      }
      const reviewed = await tx.registrationRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: { id: true, email: true, provider: true, status: true, reviewedAt: true },
      });
      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: AuditAction.VOID,
          module: "system",
          entityType: "registration-request",
          entityId: request.id,
          after: { email: request.email, provider: request.provider, reason },
        },
      });
      return reviewed;
    });
  }

  async audit(filters: { module?: string; userId?: string; workId?: string }) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        module: filters.module,
        userId: filters.userId,
        workId: filters.workId,
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return logs.map((log) => ({ ...log, id: log.id.toString() }));
  }

  private async availableUsername(
    email: string,
    database: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const base =
      email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "")
        .slice(0, 40) || "usuario";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const exists = await database.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    return `${base}-${randomBytes(5).toString("hex")}`;
  }
}
