import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RegistrationStatus, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

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
