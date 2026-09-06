import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, OrganizationType, Prisma, RegistrationStatus, UserStatus, WorkStatus } from "@prisma/client";
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
import type { CreateManualUserDto } from "./dto/create-manual-user.dto";
import type { StarterImportDto } from "./dto/starter-import.dto";

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

  async createManualUser(
    companyId: string,
    dto: CreateManualUserDto,
    actorId: string,
  ) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username?.trim().toLowerCase() || await this.availableUsername(email);
    const [existingEmail, existingUsername, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { companyId, email, deletedAt: null }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { username }, select: { id: true } }),
      this.prisma.role.findUnique({ where: { code: dto.roleCode } }),
    ]);
    if (existingEmail) throw new BadRequestException("Ya existe un usuario con ese correo");
    if (existingUsername) throw new BadRequestException("El nombre de usuario ya está en uso");
    if (!role) throw new BadRequestException("El rol seleccionado no existe");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          companyId,
          username,
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          status: dto.status ?? UserStatus.ACTIVE,
          roles: {
            create: { roleId: role.id },
          },
        },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: AuditAction.CREATE,
          module: "system",
          entityType: "user",
          entityId: created.id,
          after: {
            username: created.username,
            email: created.email,
            firstName: created.firstName,
            lastName: created.lastName,
            roleCode: dto.roleCode,
            status: created.status,
          },
        },
      });
      return created;
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


  async starterImport(
    companyId: string,
    actorId: string,
    dto: StarterImportDto,
  ) {
    const textValue = (value: unknown) =>
      value === undefined || value === null ? "" : String(value).trim();
    const numberValue = (value: unknown) => {
      const normalized = textValue(value).replace(/\./g, "").replace(",", ".");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const dateValue = (value: unknown) => {
      const raw = textValue(value);
      if (!raw) return undefined;
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const results: Array<{ row: number; status: "created" | "updated" | "skipped"; key: string; message?: string }> = [];

    for (const [index, row] of dto.rows.entries()) {
      try {
        if (dto.kind === "employees") {
          const employeeNumber = textValue(row.employeeNumber || row.legajo || row.codigo);
          const fullName = textValue(row.fullName || row.nombre || row.nombreCompleto);
          if (!employeeNumber || !fullName) {
            results.push({ row: index + 2, status: "skipped", key: employeeNumber || fullName || "sin-clave", message: "Falta legajo o nombre" });
            continue;
          }
          const parts = fullName.split(/\s+/);
          const firstName = parts.shift() ?? fullName;
          const lastName = parts.join(" ") || "-";
          const existing = await this.prisma.employee.findUnique({ where: { employeeNumber } });
          await this.prisma.employee.upsert({
            where: { employeeNumber },
            update: {
              firstName,
              lastName,
              taxId: textValue(row.taxId || row.cuil || row.cuit),
              category: textValue(row.category || row.categoria),
              position: textValue(row.position || row.puesto),
              hireDate: dateValue(row.hireDate || row.fechaIngreso) ?? existing?.hireDate ?? new Date(),
              baseSalary: numberValue(row.baseSalary || row.basico),
              active: true,
            },
            create: {
              employeeNumber,
              taxId: textValue(row.taxId || row.cuil || row.cuit),
              firstName,
              lastName,
              category: textValue(row.category || row.categoria),
              position: textValue(row.position || row.puesto),
              hireDate: dateValue(row.hireDate || row.fechaIngreso) ?? new Date(),
              baseSalary: numberValue(row.baseSalary || row.basico),
            },
          });
          results.push({ row: index + 2, status: existing ? "updated" : "created", key: employeeNumber });
          continue;
        }

        if (dto.kind === "suppliers") {
          const legalName = textValue(row.legalName || row.razonSocial || row.nombre);
          const taxId = textValue(row.taxId || row.cuit);
          if (!legalName) {
            results.push({ row: index + 2, status: "skipped", key: taxId || "sin-clave", message: "Falta razón social" });
            continue;
          }
          const existingOrg = taxId
            ? await this.prisma.organization.findFirst({ where: { taxId, deletedAt: null } })
            : await this.prisma.organization.findFirst({ where: { legalName, deletedAt: null } });
          const organization = existingOrg
            ? await this.prisma.organization.update({
                where: { id: existingOrg.id },
                data: {
                  legalName,
                  type: OrganizationType.SUPPLIER,
                  taxId: taxId || undefined,
                  vatCondition: textValue(row.vatCondition || row.condicionIva),
                  email: textValue(row.email),
                  phone: textValue(row.phone || row.telefono),
                  address: textValue(row.address || row.domicilio),
                  bankAccount: textValue(row.bankAccount || row.cbu || row.alias),
                },
              })
            : await this.prisma.organization.create({
                data: {
                  legalName,
                  type: OrganizationType.SUPPLIER,
                  taxId: taxId || undefined,
                  vatCondition: textValue(row.vatCondition || row.condicionIva),
                  email: textValue(row.email),
                  phone: textValue(row.phone || row.telefono),
                  address: textValue(row.address || row.domicilio),
                  bankAccount: textValue(row.bankAccount || row.cbu || row.alias),
                },
              });
          const existingSupplier = await this.prisma.supplier.findUnique({ where: { organizationId: organization.id } });
          await this.prisma.supplier.upsert({
            where: { organizationId: organization.id },
            update: { active: true, accountBalance: numberValue(row.accountBalance || row.saldo) },
            create: { organizationId: organization.id, accountBalance: numberValue(row.accountBalance || row.saldo) },
          });
          results.push({ row: index + 2, status: existingSupplier ? "updated" : "created", key: taxId || legalName });
          continue;
        }

        if (dto.kind === "vehicles") {
          const plate = textValue(row.plate || row.dominio || row.patente).toUpperCase();
          if (!plate) {
            results.push({ row: index + 2, status: "skipped", key: "sin-dominio", message: "Falta dominio/patente" });
            continue;
          }
          const workCode = textValue(row.workCode || row.obra || row.codigoObra);
          const work = workCode
            ? await this.prisma.work.findFirst({ where: { companyId, code: workCode, deletedAt: null }, select: { id: true } })
            : null;
          const existing = await this.prisma.vehicle.findUnique({ where: { plate } });
          await this.prisma.vehicle.upsert({
            where: { plate },
            update: {
              brand: textValue(row.brand || row.marca),
              model: textValue(row.model || row.modelo),
              year: Math.trunc(numberValue(row.year || row.anio)),
              odometerKm: Math.trunc(numberValue(row.odometerKm || row.kilometraje)),
              insuranceDue: dateValue(row.insuranceDue || row.vencimientoSeguro),
              inspectionDue: dateValue(row.inspectionDue || row.vencimientoRto),
              workId: work?.id,
              active: true,
            },
            create: {
              plate,
              brand: textValue(row.brand || row.marca),
              model: textValue(row.model || row.modelo),
              year: Math.trunc(numberValue(row.year || row.anio)) || new Date().getFullYear(),
              odometerKm: Math.trunc(numberValue(row.odometerKm || row.kilometraje)),
              insuranceDue: dateValue(row.insuranceDue || row.vencimientoSeguro),
              inspectionDue: dateValue(row.inspectionDue || row.vencimientoRto),
              workId: work?.id,
            },
          });
          results.push({ row: index + 2, status: existing ? "updated" : "created", key: plate });
          continue;
        }

        if (dto.kind === "assets") {
          const code = textValue(row.code || row.codigo);
          const description = textValue(row.description || row.descripcion);
          if (!code || !description) {
            results.push({ row: index + 2, status: "skipped", key: code || description || "sin-clave", message: "Falta código o descripción" });
            continue;
          }
          const workCode = textValue(row.workCode || row.obra || row.codigoObra);
          const work = workCode
            ? await this.prisma.work.findFirst({ where: { companyId, code: workCode, deletedAt: null }, select: { id: true } })
            : null;
          const existing = await this.prisma.generalAsset.findUnique({ where: { code } });
          await this.prisma.generalAsset.upsert({
            where: { code },
            update: {
              assetType: textValue(row.assetType || row.tipo) || "OTHER",
              mobilityClass: /no|fijo/i.test(textValue(row.mobilityClass || row.movilidad)) ? "FIXED" : "MOBILE",
              description,
              brand: textValue(row.brand || row.marca),
              model: textValue(row.model || row.modelo),
              serialNumber: textValue(row.serialNumber || row.serie),
              acquisitionCost: numberValue(row.acquisitionCost || row.costo),
              currentValue: numberValue(row.currentValue || row.valorActual),
              workId: work?.id,
              location: textValue(row.location || row.ubicacion),
              status: "ACTIVE",
              inventoryDate: new Date(),
            },
            create: {
              code,
              assetType: textValue(row.assetType || row.tipo) || "OTHER",
              mobilityClass: /no|fijo/i.test(textValue(row.mobilityClass || row.movilidad)) ? "FIXED" : "MOBILE",
              description,
              brand: textValue(row.brand || row.marca),
              model: textValue(row.model || row.modelo),
              serialNumber: textValue(row.serialNumber || row.serie),
              acquisitionCost: numberValue(row.acquisitionCost || row.costo),
              currentValue: numberValue(row.currentValue || row.valorActual),
              workId: work?.id,
              location: textValue(row.location || row.ubicacion),
              inventoryDate: new Date(),
            },
          });
          results.push({ row: index + 2, status: existing ? "updated" : "created", key: code });
          continue;
        }

        if (dto.kind === "works") {
          const code = textValue(row.code || row.codigo);
          const name = textValue(row.name || row.nombre);
          const clientName = textValue(row.client || row.comitente || row.cliente);
          if (!code || !name || !clientName) {
            results.push({ row: index + 2, status: "skipped", key: code || name || "sin-clave", message: "Falta código, nombre o comitente" });
            continue;
          }
          let client = await this.prisma.organization.findFirst({ where: { legalName: clientName, deletedAt: null } });
          if (!client) {
            client = await this.prisma.organization.create({
              data: { legalName: clientName, type: OrganizationType.PUBLIC_AGENCY },
            });
          }
          const existing = await this.prisma.work.findUnique({ where: { code } });
          await this.prisma.work.upsert({
            where: { code },
            update: {
              companyId,
              clientId: client.id,
              name,
              city: textValue(row.city || row.ciudad),
              contractAmount: numberValue(row.contractAmount || row.montoContrato),
              targetBudget: numberValue(row.targetBudget || row.presupuestoObjetivo),
              startDate: dateValue(row.startDate || row.fechaInicio) ?? existing?.startDate ?? new Date(),
              contractualEndDate: dateValue(row.contractualEndDate || row.fechaFin),
              responsibleName: textValue(row.responsibleName || row.responsable),
              status: WorkStatus.ACTIVE,
              deletedAt: null,
            },
            create: {
              companyId,
              clientId: client.id,
              code,
              name,
              status: WorkStatus.ACTIVE,
              costCenter: textValue(row.costCenter || row.centroCosto) || `CC-${code}`,
              city: textValue(row.city || row.ciudad),
              startDate: dateValue(row.startDate || row.fechaInicio) ?? new Date(),
              contractualEndDate: dateValue(row.contractualEndDate || row.fechaFin),
              contractAmount: numberValue(row.contractAmount || row.montoContrato),
              targetBudget: numberValue(row.targetBudget || row.presupuestoObjetivo),
              responsibleName: textValue(row.responsibleName || row.responsable),
            },
          });
          results.push({ row: index + 2, status: existing ? "updated" : "created", key: code });
        }
      } catch (error) {
        results.push({
          row: index + 2,
          status: "skipped",
          key: textValue(row.code || row.codigo || row.employeeNumber || row.legajo || row.plate || row.patente || row.taxId || row.cuit) || "sin-clave",
          message: error instanceof Error ? error.message : "Error de importación",
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.CREATE,
        module: "system",
        entityType: "starter-import",
        entityId: `${dto.kind}:${Date.now()}`,
        after: {
          kind: dto.kind,
          total: dto.rows.length,
          created: results.filter((item) => item.status === "created").length,
          updated: results.filter((item) => item.status === "updated").length,
          skipped: results.filter((item) => item.status === "skipped").length,
        },
      },
    });

    return {
      kind: dto.kind,
      total: dto.rows.length,
      created: results.filter((item) => item.status === "created").length,
      updated: results.filter((item) => item.status === "updated").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      results,
    };
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
