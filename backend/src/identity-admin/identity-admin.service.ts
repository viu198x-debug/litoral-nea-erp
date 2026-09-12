import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { AuthUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateManagedRoleDto,
  ReplaceUserPermissionsDto,
  ReplaceUserRolesDto,
  ResetManagedPasswordDto,
  UpdateManagedRoleDto,
  UpdateManagedUserDto,
} from "./identity-admin.dto";

@Injectable()
export class IdentityAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers(companyId: string) {
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
        roles: { include: { role: { select: { id: true, code: true, name: true } }, work: { select: { id: true, code: true, name: true } } } },
        directPermissions: { include: { permission: true, work: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

  listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async updateUser(actor: AuthUser, id: string, dto: UpdateManagedUserDto) {
    const current = await this.requireUser(actor.companyId, id);
    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const duplicate = await this.prisma.user.findFirst({ where: { email, id: { not: id }, deletedAt: null }, select: { id: true } });
      if (duplicate) throw new BadRequestException("El correo ya está utilizado por otro usuario");
    }
    if (dto.username) {
      const username = dto.username.trim().toLowerCase();
      const duplicate = await this.prisma.user.findFirst({ where: { username, id: { not: id } }, select: { id: true } });
      if (duplicate) throw new BadRequestException("El nombre de usuario ya está utilizado");
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email?.trim().toLowerCase(),
        username: dto.username?.trim().toLowerCase(),
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
      },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, status: true },
    });
    await this.audit(actor.id, AuditAction.UPDATE, "user", id, current, updated);
    return updated;
  }

  async resetPassword(actor: AuthUser, id: string, dto: ResetManagedPasswordDto) {
    await this.requireUser(actor.companyId, id);
    const password = dto.password ?? this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, status: UserStatus.ACTIVE } }),
      this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { userId: actor.id, action: AuditAction.UPDATE, module: "system", entityType: "user-password", entityId: id, after: { sessionsRevoked: true, generated: !dto.password } } }),
    ]);
    return { id, temporaryPassword: dto.password ? undefined : password, generated: !dto.password };
  }

  async replaceRoles(actor: AuthUser, id: string, dto: ReplaceUserRolesDto) {
    if (id === actor.id && dto.roles.length === 0) throw new BadRequestException("No puede quitarse todos sus roles");
    await this.requireUser(actor.companyId, id);
    const requestedCodes = [...new Set(dto.roles.map((item) => item.roleCode))];
    if (!actor.roleCodes.includes("ADMIN_GENERAL") && requestedCodes.includes("ADMIN_GENERAL")) {
      throw new ForbiddenException("Solo el Administrador General puede asignar ADMIN_GENERAL");
    }
    const roles = await this.prisma.role.findMany({ where: { code: { in: requestedCodes } } });
    if (roles.length !== requestedCodes.length) throw new BadRequestException("Uno o más roles no existen");
    const roleByCode = new Map(roles.map((role) => [role.code, role]));
    for (const item of dto.roles) {
      if (item.workId) await this.requireWork(actor.companyId, item.workId);
    }
    const before = await this.prisma.userRole.findMany({ where: { userId: id }, include: { role: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      for (const item of dto.roles) {
        const role = roleByCode.get(item.roleCode)!;
        await tx.userRole.create({ data: { userId: id, roleId: role.id, workId: item.workId ?? null } });
      }
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: actor.id, action: AuditAction.UPDATE, module: "system", entityType: "user-roles", entityId: id, before: before.map((x) => ({ role: x.role.code, workId: x.workId })), after: dto.roles as unknown as Prisma.InputJsonValue } });
    });
    return this.userSecurityProfile(id);
  }

  async replacePermissions(actor: AuthUser, id: string, dto: ReplaceUserPermissionsDto) {
    await this.requireUser(actor.companyId, id);
    for (const item of dto.permissions) {
      if (item.workId) await this.requireWork(actor.companyId, item.workId);
      if (!actor.roleCodes.includes("ADMIN_GENERAL") && item.module === "system" && item.action === "admin" && item.allowed) {
        throw new ForbiddenException("Solo el Administrador General puede otorgar privilegios raíz del sistema");
      }
    }
    const keys = dto.permissions.map((p) => ({ module: p.module, action: p.action }));
    const permissions = await this.prisma.permission.findMany({ where: { OR: keys } });
    const keyMap = new Map(permissions.map((p) => [`${p.module}:${p.action}`, p]));
    if (permissions.length !== keys.length) throw new BadRequestException("Uno o más permisos no existen");
    const before = await this.prisma.userPermission.findMany({ where: { userId: id }, include: { permission: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: id } });
      for (const item of dto.permissions) {
        const permission = keyMap.get(`${item.module}:${item.action}`)!;
        await tx.userPermission.create({ data: { userId: id, permissionId: permission.id, workId: item.workId ?? null, allowed: item.allowed } });
      }
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: actor.id, action: AuditAction.UPDATE, module: "system", entityType: "user-permissions", entityId: id, before: before.map((x) => ({ module: x.permission.module, action: x.permission.action, allowed: x.allowed, workId: x.workId })), after: dto.permissions as unknown as Prisma.InputJsonValue } });
    });
    return this.userSecurityProfile(id);
  }

  async disableUser(actor: AuthUser, id: string) {
    if (id === actor.id) throw new BadRequestException("No puede darse de baja a sí mismo");
    const current = await this.requireUser(actor.companyId, id);
    const targetRoles = await this.prisma.userRole.findMany({ where: { userId: id }, include: { role: true } });
    if (!actor.roleCodes.includes("ADMIN_GENERAL") && targetRoles.some((x) => x.role.code === "ADMIN_GENERAL")) {
      throw new ForbiddenException("Solo el Administrador General puede dar de baja a otro Administrador General");
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data: { status: UserStatus.DISABLED, deletedAt: now, lockedUntil: now } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      await tx.auditLog.create({ data: { userId: actor.id, action: AuditAction.SOFT_DELETE, module: "system", entityType: "user", entityId: id, before: current as unknown as Prisma.InputJsonValue, after: { status: "DISABLED", deletedAt: now.toISOString() } } });
      return row;
    });
    return { id: updated.id, status: updated.status, deletedAt: updated.deletedAt };
  }

  async createRole(actor: AuthUser, dto: CreateManagedRoleDto) {
    if (dto.code === "ADMIN_GENERAL" && !actor.roleCodes.includes("ADMIN_GENERAL")) throw new ForbiddenException("Rol reservado");
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException("Ya existe un rol con ese código");
    const role = await this.prisma.role.create({ data: { code: dto.code, name: dto.name.trim(), description: dto.description?.trim(), isSystem: false } });
    await this.audit(actor.id, AuditAction.CREATE, "role", role.id, null, role);
    return role;
  }

  async updateRole(actor: AuthUser, id: string, dto: UpdateManagedRoleDto) {
    const current = await this.prisma.role.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Rol no encontrado");
    if (current.code === "ADMIN_GENERAL" && !actor.roleCodes.includes("ADMIN_GENERAL")) throw new ForbiddenException("Rol reservado");
    const updated = await this.prisma.role.update({ where: { id }, data: { name: dto.name?.trim(), description: dto.description?.trim() } });
    await this.audit(actor.id, AuditAction.UPDATE, "role", id, current, updated);
    return updated;
  }

  async deleteRole(actor: AuthUser, id: string) {
    const current = await this.prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!current) throw new NotFoundException("Rol no encontrado");
    if (current.isSystem) throw new BadRequestException("Los roles del sistema no pueden darse de baja");
    if (current._count.users > 0) throw new BadRequestException("No se puede dar de baja un rol con usuarios asignados");
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
      await tx.auditLog.create({ data: { userId: actor.id, action: AuditAction.SOFT_DELETE, module: "system", entityType: "role", entityId: id, before: current as unknown as Prisma.InputJsonValue } });
    });
    return { id, deleted: true };
  }

  private async userSecurityProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, status: true, roles: { include: { role: true, work: { select: { id: true, code: true, name: true } } } }, directPermissions: { include: { permission: true, work: { select: { id: true, code: true, name: true } } } } },
    });
  }

  private async requireUser(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    return user;
  }

  private async requireWork(companyId: string, id: string) {
    const work = await this.prisma.work.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!work) throw new BadRequestException("La obra indicada no pertenece a la empresa");
    return work;
  }

  private generateTemporaryPassword() {
    const token = randomBytes(8).toString("base64url");
    return `Ln#${token}aA1`;
  }

  private audit(actorId: string, action: AuditAction, entityType: string, entityId: string, before: unknown, after: unknown) {
    return this.prisma.auditLog.create({ data: { userId: actorId, action, module: "system", entityType, entityId, before: before as Prisma.InputJsonValue | undefined, after: after as Prisma.InputJsonValue | undefined } });
  }
}
