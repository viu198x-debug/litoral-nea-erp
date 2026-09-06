import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateRecordDto } from "./dto/create-record.dto";
import type { UpdateRecordDto } from "./dto/update-record.dto";

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    companyId: string,
    module: string,
    filters: { workId?: string; status?: RecordStatus; search?: string },
  ) {
    if (["assets", "stakeholders", "personnel-control", "safety"].includes(module)) {
      return this.listDomain(companyId, module, filters);
    }
    return this.listConfigured(companyId, module, filters);
  }

  private async listConfigured(
    companyId: string,
    module: string,
    filters: { workId?: string; status?: RecordStatus; search?: string },
  ) {
    await this.requireModule(module);
    return this.prisma.genericRecord.findMany({
      where: {
        module,
        deletedAt: null,
        workId: filters.workId,
        status: filters.status,
        AND: [
          { OR: [{ workId: null }, { work: { companyId } }] },
          ...(filters.search
            ? [
                {
                  OR: [
                    {
                      code: {
                        contains: filters.search.slice(0, 120),
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      title: {
                        contains: filters.search.slice(0, 120),
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: { work: { select: { code: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async create(
    companyId: string,
    module: string,
    userId: string,
    dto: CreateRecordDto,
  ) {
    if (["assets", "stakeholders", "personnel-control", "safety"].includes(module)) {
      return this.createDomain(companyId, module, userId, dto);
    }
    const configuration = await this.requireModule(module);
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    if (configuration.requiresWork && !dto.workId) {
      throw new NotFoundException("Este módulo requiere seleccionar una obra");
    }
    await this.validateConfiguredData(configuration.id, dto.data ?? {});
    const { occurredAt, data, ...fields } = dto;
    const createData: Prisma.GenericRecordUncheckedCreateInput = {
      ...fields,
      module,
      createdById: userId,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      data: data as Prisma.InputJsonValue | undefined,
    };
    return this.prisma.genericRecord.create({
      data: createData,
    });
  }

  async update(companyId: string, module: string, id: string, dto: UpdateRecordDto) {
    if (["assets", "stakeholders", "personnel-control", "safety"].includes(module)) {
      return this.updateDomain(companyId, module, id, dto);
    }
    const configuration = await this.requireModule(module);
    await this.requireRecord(companyId, module, id);
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    if (dto.data) await this.validateConfiguredData(configuration.id, dto.data);
    const { occurredAt, data, ...fields } = dto;
    const updateData: Prisma.GenericRecordUncheckedUpdateInput = {
      ...fields,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      data: data as Prisma.InputJsonValue | undefined,
    };
    return this.prisma.genericRecord.update({
      where: { id },
      data: updateData,
    });
  }

  async softDelete(companyId: string, module: string, id: string) {
    if (["assets", "stakeholders", "personnel-control", "safety"].includes(module)) {
      return this.softDeleteDomain(companyId, module, id);
    }
    await this.requireRecord(companyId, module, id);
    return this.prisma.genericRecord.update({
      where: { id },
      data: { deletedAt: new Date(), status: RecordStatus.VOID },
    });
  }


  private async listDomain(
    companyId: string,
    module: string,
    filters: { workId?: string; status?: RecordStatus; search?: string },
  ) {
    const search = filters.search?.trim().slice(0, 120);
    if (module === "assets") {
      const items = await this.prisma.generalAsset.findMany({
        where: {
          ...(filters.workId ? { workId: filters.workId } : {}),
          ...(search
            ? {
                OR: [
                  { code: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                  { serialNumber: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
          OR: [{ workId: null }, { work: { companyId } }],
        },
        include: {
          work: { select: { code: true, name: true } },
          assignedEmployee: { select: { firstName: true, lastName: true, employeeNumber: true } },
        },
        orderBy: { code: "asc" },
        take: 100,
      });
      return items.map((item) => ({
        id: item.id,
        code: item.code,
        title: item.description,
        status: item.status === "ACTIVE" ? RecordStatus.ACTIVE : item.status === "DECOMMISSIONED" ? RecordStatus.VOID : RecordStatus.PENDING,
        amount: item.currentValue,
        occurredAt: item.inventoryDate ?? item.purchaseDate,
        updatedAt: item.inventoryDate ?? item.purchaseDate ?? new Date(0),
        createdById: "domain-assets",
        work: item.work,
        data: {
          assetType: item.assetType,
          mobilityClass: item.mobilityClass,
          brand: item.brand,
          model: item.model,
          serialNumber: item.serialNumber,
          assignedTo: item.assignedEmployee
            ? `${item.assignedEmployee.firstName} ${item.assignedEmployee.lastName}`
            : "",
          location: item.location,
          acquisitionCost: item.acquisitionCost,
          currentValue: item.currentValue,
          warrantyDue: item.warrantyDue,
          calibrationDue: item.calibrationDue,
          assetStatus: item.status,
          notes: item.notes,
        },
      }));
    }

    if (module === "stakeholders") {
      const roles = await this.prisma.organizationStakeholderRole.findMany({
        where: {
          active: true,
          ...(filters.workId ? { workId: filters.workId } : {}),
          ...(search
            ? {
                organization: {
                  OR: [
                    { legalName: { contains: search, mode: "insensitive" } },
                    { taxId: { contains: search, mode: "insensitive" } },
                  ],
                },
              }
            : {}),
          OR: [{ workId: null }, { work: { companyId } }],
        },
        include: {
          organization: true,
          work: { select: { code: true, name: true } },
        },
        orderBy: [{ roleType: "asc" }, { organization: { legalName: "asc" } }],
        take: 100,
      });
      return roles.map((role) => ({
        id: role.id,
        code: `TER-${role.id.slice(-8).toUpperCase()}`,
        title: role.organization.legalName,
        status: RecordStatus.ACTIVE,
        amount: role.accountBalance,
        occurredAt: role.organization.updatedAt,
        updatedAt: role.organization.updatedAt,
        createdById: "domain-thirdparty",
        work: role.work,
        data: {
          roleType: role.roleType,
          taxId: role.organization.taxId,
          vatCondition: role.organization.vatCondition,
          contactPerson: role.contactPerson,
          email: role.organization.email,
          phone: role.organization.phone,
          address: role.organization.address,
          bankAccount: role.organization.bankAccount,
          paymentTerms: role.paymentTerms,
          accountBalance: role.accountBalance,
          creditLimit: role.creditLimit,
          notes: role.notes,
        },
      }));
    }

    if (module === "personnel-control") {
      const rows = await this.prisma.attendanceRecord.findMany({
        where: {
          ...(filters.workId ? { workId: filters.workId } : {}),
          ...(search
            ? {
                employee: {
                  OR: [
                    { employeeNumber: { contains: search, mode: "insensitive" } },
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                  ],
                },
              }
            : {}),
          OR: [{ workId: null }, { work: { companyId } }],
        },
        include: {
          employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
          work: { select: { code: true, name: true } },
        },
        orderBy: { date: "desc" },
        take: 100,
      });
      return rows.map((row) => ({
        id: row.id,
        code: `PER-${row.id.slice(-8).toUpperCase()}`,
        title: `${row.employee.firstName} ${row.employee.lastName}`,
        status: row.attendanceType === "ABSENT" || row.attendanceType === "ACCIDENT" ? RecordStatus.PENDING : RecordStatus.ACTIVE,
        amount: null,
        occurredAt: row.date,
        updatedAt: row.date,
        createdById: row.approvedById ?? "domain-personnel",
        work: row.work,
        data: {
          employee: `${row.employee.employeeNumber} · ${row.employee.firstName} ${row.employee.lastName}`,
          attendanceType: row.attendanceType,
          date: row.date,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          normalHours: row.normalHours,
          overtimeHours: row.overtimeHours,
          location: row.location,
          source: row.source,
          observations: row.observations,
        },
      }));
    }

    return this.listSafetyDomain(companyId, filters);
  }

  private async createDomain(
    companyId: string,
    module: string,
    userId: string,
    dto: CreateRecordDto,
  ) {
    const data = dto.data ?? {};
    if (dto.workId) await this.requireWork(companyId, dto.workId);

    if (module === "assets") {
      const assignedEmployeeId = await this.resolveEmployeeId(data.assignedTo);
      const created = await this.prisma.generalAsset.create({
        data: {
          code: dto.code,
          assetType: String(data.assetType ?? "OTHER"),
          mobilityClass: this.normalizeMobility(data.mobilityClass),
          description: dto.title,
          brand: this.optionalString(data.brand),
          model: this.optionalString(data.model),
          serialNumber: this.optionalString(data.serialNumber),
          purchaseDate: this.optionalDate(data.purchaseDate ?? dto.occurredAt),
          acquisitionCost: this.numberValue(data.acquisitionCost),
          currentValue: this.numberValue(data.currentValue),
          status: this.normalizeAssetStatus(data.assetStatus),
          workId: dto.workId,
          assignedEmployeeId,
          location: this.optionalString(data.location),
          inventoryDate: new Date(),
          warrantyDue: this.optionalDate(data.warrantyDue),
          calibrationDue: this.optionalDate(data.calibrationDue),
          notes: this.optionalString(data.notes),
        },
      });
      return { id: created.id, code: created.code, title: created.description };
    }

    if (module === "stakeholders") {
      const roleType = this.normalizeStakeholderRole(data.roleType);
      const type = this.organizationTypeForRole(roleType);
      const taxId = this.optionalString(data.taxId);
      const existing = taxId
        ? await this.prisma.organization.findFirst({ where: { taxId, deletedAt: null } })
        : await this.prisma.organization.findFirst({ where: { legalName: dto.title, deletedAt: null } });
      return this.prisma.$transaction(async (tx) => {
        const organization = existing
          ? await tx.organization.update({
              where: { id: existing.id },
              data: {
                type,
                legalName: dto.title,
                taxId,
                vatCondition: this.optionalString(data.vatCondition),
                email: this.optionalString(data.email),
                phone: this.optionalString(data.phone),
                address: this.optionalString(data.address),
                bankAccount: this.optionalString(data.bankAccount),
              },
            })
          : await tx.organization.create({
              data: {
                type,
                legalName: dto.title,
                taxId,
                vatCondition: this.optionalString(data.vatCondition),
                email: this.optionalString(data.email),
                phone: this.optionalString(data.phone),
                address: this.optionalString(data.address),
                bankAccount: this.optionalString(data.bankAccount),
              },
            });
        const role = await tx.organizationStakeholderRole.create({
          data: {
            organizationId: organization.id,
            workId: dto.workId,
            roleType,
            active: true,
            accountBalance: this.numberValue(data.accountBalance),
            creditLimit: data.creditLimit == null || data.creditLimit === "" ? undefined : this.numberValue(data.creditLimit),
            paymentTerms: this.optionalString(data.paymentTerms),
            contactPerson: this.optionalString(data.contactPerson),
            notes: this.optionalString(data.notes),
          },
        });
        return { id: role.id, code: dto.code, title: organization.legalName };
      });
    }

    if (module === "personnel-control") {
      const employeeId = await this.requireEmployeeId(data.employee);
      const date = this.optionalDate(data.date ?? dto.occurredAt) ?? new Date();
      const attendance = await this.prisma.attendanceRecord.create({
        data: {
          employeeId,
          workId: dto.workId,
          date,
          attendanceType: this.normalizeAttendance(data.attendanceType),
          checkIn: this.optionalDate(data.checkIn),
          checkOut: this.optionalDate(data.checkOut),
          normalHours: this.numberValue(data.normalHours),
          overtimeHours: this.numberValue(data.overtimeHours),
          location: this.optionalString(data.location),
          source: String(data.source ?? "MANUAL").toUpperCase(),
          approvedById: userId,
          observations: this.optionalString(data.observations),
        },
      });
      if (dto.workId && this.optionalString(data.assignmentRole)) {
        const active = await this.prisma.employeeWorkAssignment.findFirst({
          where: { employeeId, workId: dto.workId, endDate: null },
        });
        if (!active) {
          await this.prisma.employeeWorkAssignment.create({
            data: {
              employeeId,
              workId: dto.workId,
              role: String(data.assignmentRole),
              shift: this.optionalString(data.shift),
              costCenter: this.optionalString(data.costCenter),
            },
          });
        }
      }
      return { id: attendance.id, code: dto.code, title: dto.title };
    }

    return this.createSafetyDomain(companyId, userId, dto);
  }

  private async updateDomain(
    companyId: string,
    module: string,
    id: string,
    dto: UpdateRecordDto,
  ) {
    const data = dto.data ?? {};
    if (dto.workId) await this.requireWork(companyId, dto.workId);

    if (module === "assets") {
      const current = await this.prisma.generalAsset.findFirst({
        where: { id, OR: [{ workId: null }, { work: { companyId } }] },
      });
      if (!current) throw new NotFoundException("Activo no encontrado");
      const assignedEmployeeId =
        data.assignedTo !== undefined ? await this.resolveEmployeeId(data.assignedTo) : undefined;
      return this.prisma.generalAsset.update({
        where: { id },
        data: {
          description: dto.title,
          workId: dto.workId,
          assetType: data.assetType === undefined ? undefined : String(data.assetType),
          mobilityClass: data.mobilityClass === undefined ? undefined : this.normalizeMobility(data.mobilityClass),
          brand: data.brand === undefined ? undefined : this.optionalString(data.brand),
          model: data.model === undefined ? undefined : this.optionalString(data.model),
          serialNumber: data.serialNumber === undefined ? undefined : this.optionalString(data.serialNumber),
          acquisitionCost: data.acquisitionCost === undefined ? undefined : this.numberValue(data.acquisitionCost),
          currentValue: data.currentValue === undefined ? undefined : this.numberValue(data.currentValue),
          assignedEmployeeId,
          location: data.location === undefined ? undefined : this.optionalString(data.location),
          warrantyDue: data.warrantyDue === undefined ? undefined : this.optionalDate(data.warrantyDue),
          calibrationDue: data.calibrationDue === undefined ? undefined : this.optionalDate(data.calibrationDue),
          status: data.assetStatus === undefined ? undefined : this.normalizeAssetStatus(data.assetStatus),
          notes: data.notes === undefined ? undefined : this.optionalString(data.notes),
          inventoryDate: new Date(),
        },
      });
    }

    if (module === "stakeholders") {
      const role = await this.prisma.organizationStakeholderRole.findFirst({
        where: { id, OR: [{ workId: null }, { work: { companyId } }] },
        include: { organization: true },
      });
      if (!role) throw new NotFoundException("Tercero no encontrado");
      return this.prisma.$transaction(async (tx) => {
        if (dto.title || Object.keys(data).some((key) => ["taxId", "vatCondition", "email", "phone", "address", "bankAccount"].includes(key))) {
          await tx.organization.update({
            where: { id: role.organizationId },
            data: {
              legalName: dto.title,
              taxId: data.taxId === undefined ? undefined : this.optionalString(data.taxId),
              vatCondition: data.vatCondition === undefined ? undefined : this.optionalString(data.vatCondition),
              email: data.email === undefined ? undefined : this.optionalString(data.email),
              phone: data.phone === undefined ? undefined : this.optionalString(data.phone),
              address: data.address === undefined ? undefined : this.optionalString(data.address),
              bankAccount: data.bankAccount === undefined ? undefined : this.optionalString(data.bankAccount),
            },
          });
        }
        return tx.organizationStakeholderRole.update({
          where: { id },
          data: {
            workId: dto.workId,
            roleType: data.roleType === undefined ? undefined : this.normalizeStakeholderRole(data.roleType),
            accountBalance: data.accountBalance === undefined ? undefined : this.numberValue(data.accountBalance),
            creditLimit: data.creditLimit === undefined ? undefined : this.numberValue(data.creditLimit),
            paymentTerms: data.paymentTerms === undefined ? undefined : this.optionalString(data.paymentTerms),
            contactPerson: data.contactPerson === undefined ? undefined : this.optionalString(data.contactPerson),
            notes: data.notes === undefined ? undefined : this.optionalString(data.notes),
          },
        });
      });
    }

    if (module === "personnel-control") {
      const row = await this.prisma.attendanceRecord.findFirst({
        where: { id, OR: [{ workId: null }, { work: { companyId } }] },
      });
      if (!row) throw new NotFoundException("Registro de personal no encontrado");
      return this.prisma.attendanceRecord.update({
        where: { id },
        data: {
          workId: dto.workId,
          date: data.date === undefined ? undefined : this.optionalDate(data.date),
          attendanceType: data.attendanceType === undefined ? undefined : this.normalizeAttendance(data.attendanceType),
          checkIn: data.checkIn === undefined ? undefined : this.optionalDate(data.checkIn),
          checkOut: data.checkOut === undefined ? undefined : this.optionalDate(data.checkOut),
          normalHours: data.normalHours === undefined ? undefined : this.numberValue(data.normalHours),
          overtimeHours: data.overtimeHours === undefined ? undefined : this.numberValue(data.overtimeHours),
          location: data.location === undefined ? undefined : this.optionalString(data.location),
          source: data.source === undefined ? undefined : String(data.source).toUpperCase(),
          observations: data.observations === undefined ? undefined : this.optionalString(data.observations),
        },
      });
    }

    return this.updateSafetyDomain(companyId, id, dto);
  }

  private async softDeleteDomain(companyId: string, module: string, id: string) {
    if (module === "assets") {
      const current = await this.prisma.generalAsset.findFirst({
        where: { id, OR: [{ workId: null }, { work: { companyId } }] },
      });
      if (!current) throw new NotFoundException("Activo no encontrado");
      return this.prisma.generalAsset.update({
        where: { id },
        data: { status: "DECOMMISSIONED", inventoryDate: new Date() },
      });
    }
    if (module === "stakeholders") {
      const current = await this.prisma.organizationStakeholderRole.findFirst({
        where: { id, OR: [{ workId: null }, { work: { companyId } }] },
      });
      if (!current) throw new NotFoundException("Tercero no encontrado");
      return this.prisma.organizationStakeholderRole.update({
        where: { id },
        data: { active: false },
      });
    }
    if (module === "personnel-control") {
      const current = await this.prisma.attendanceRecord.findFirst({
        where: { id, OR: [{ workId: null }, { work: { companyId } }] },
      });
      if (!current) throw new NotFoundException("Registro de personal no encontrado");
      return this.prisma.attendanceRecord.update({
        where: { id },
        data: { attendanceType: "VOID", observations: [current.observations, "Baja lógica"].filter(Boolean).join(" · ") },
      });
    }
    return this.softDeleteSafetyDomain(companyId, id);
  }

  private async listSafetyDomain(
    companyId: string,
    filters: { workId?: string; status?: RecordStatus; search?: string },
  ) {
    const search = filters.search?.trim().slice(0, 120);
    const [incidents, inspections, credentials, ppe, training] = await Promise.all([
      this.prisma.safetyIncident.findMany({
        where: {
          ...(filters.workId ? { workId: filters.workId } : {}),
          ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {}),
          OR: [{ workId: null }, { work: { companyId } }],
        },
        include: { work: { select: { code: true, name: true } }, employee: { select: { firstName: true, lastName: true } } },
        orderBy: { occurredAt: "desc" },
        take: 40,
      }),
      this.prisma.safetyInspection.findMany({
        where: {
          ...(filters.workId ? { workId: filters.workId } : {}),
          ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { inspectionType: { contains: search, mode: "insensitive" } }] } : {}),
          OR: [{ workId: null }, { work: { companyId } }],
        },
        include: { work: { select: { code: true, name: true } } },
        orderBy: { inspectedAt: "desc" },
        take: 30,
      }),
      this.prisma.safetyCredential.findMany({
        where: search ? { OR: [{ credentialType: { contains: search, mode: "insensitive" } }, { employee: { firstName: { contains: search, mode: "insensitive" } } }, { employee: { lastName: { contains: search, mode: "insensitive" } } }] } : {},
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { expiresAt: "asc" },
        take: 20,
      }),
      this.prisma.pPEIssue.findMany({
        where: search ? { OR: [{ item: { contains: search, mode: "insensitive" } }, { employee: { firstName: { contains: search, mode: "insensitive" } } }, { employee: { lastName: { contains: search, mode: "insensitive" } } }] } : {},
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { issuedAt: "desc" },
        take: 20,
      }),
      this.prisma.safetyTraining.findMany({
        where: search ? { OR: [{ topic: { contains: search, mode: "insensitive" } }, { employee: { firstName: { contains: search, mode: "insensitive" } } }, { employee: { lastName: { contains: search, mode: "insensitive" } } }] } : {},
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { completedAt: "desc" },
        take: 20,
      }),
    ]);

    const rows = [
      ...incidents.map((item) => ({
        id: item.id,
        code: item.code,
        title: `Incidente · ${item.incidentType}`,
        status: item.status,
        amount: null,
        occurredAt: item.occurredAt,
        updatedAt: item.occurredAt,
        createdById: item.reportedById,
        work: item.work,
        data: {
          recordType: "Incidente",
          employee: item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : "",
          incidentType: item.incidentType,
          severity: item.severity,
          occurredAt: item.occurredAt,
          location: item.location,
          description: item.description,
          immediateAction: item.immediateAction,
          correctiveAction: item.correctiveAction,
          closedAt: item.closedAt,
        },
      })),
      ...inspections.map((item) => ({
        id: item.id,
        code: item.code,
        title: `Inspección · ${item.inspectionType}`,
        status: item.status,
        amount: null,
        occurredAt: item.inspectedAt,
        updatedAt: item.inspectedAt,
        createdById: "domain-safety",
        work: item.work,
        data: {
          recordType: "Inspección",
          description: item.result,
          dueAt: item.dueAt,
          responsible: item.inspector,
        },
      })),
      ...credentials.map((item) => ({
        id: item.id,
        code: `SEG-CRED-${item.id.slice(-6).toUpperCase()}`,
        title: `Credencial · ${item.employee.firstName} ${item.employee.lastName}`,
        status: item.status === "ACTIVE" ? RecordStatus.ACTIVE : RecordStatus.VOID,
        amount: null,
        occurredAt: item.issuedAt,
        updatedAt: item.issuedAt ?? new Date(0),
        createdById: "domain-safety",
        work: null,
        data: { recordType: "Apto / credencial", employee: `${item.employee.firstName} ${item.employee.lastName}`, description: item.credentialType, issuedAt: item.issuedAt, expiresAt: item.expiresAt },
      })),
      ...ppe.map((item) => ({
        id: item.id,
        code: `SEG-EPP-${item.id.slice(-6).toUpperCase()}`,
        title: `EPP · ${item.employee.firstName} ${item.employee.lastName}`,
        status: item.returnedAt ? RecordStatus.CLOSED : RecordStatus.ACTIVE,
        amount: null,
        occurredAt: item.issuedAt,
        updatedAt: item.issuedAt,
        createdById: "domain-safety",
        work: null,
        data: { recordType: "Entrega EPP", employee: `${item.employee.firstName} ${item.employee.lastName}`, description: item.item, issuedAt: item.issuedAt, expiresAt: item.dueAt },
      })),
      ...training.map((item) => ({
        id: item.id,
        code: `SEG-CAP-${item.id.slice(-6).toUpperCase()}`,
        title: `Capacitación · ${item.employee.firstName} ${item.employee.lastName}`,
        status: item.approved ? RecordStatus.APPROVED : RecordStatus.PENDING,
        amount: null,
        occurredAt: item.completedAt,
        updatedAt: item.completedAt,
        createdById: "domain-safety",
        work: null,
        data: { recordType: "Capacitación", employee: `${item.employee.firstName} ${item.employee.lastName}`, description: item.topic, issuedAt: item.completedAt, expiresAt: item.expiresAt },
      })),
    ];
    return rows
      .sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime())
      .slice(0, 100);
  }

  private async createSafetyDomain(companyId: string, userId: string, dto: CreateRecordDto) {
    const data = dto.data ?? {};
    const recordType = String(data.recordType ?? "").toLowerCase();
    if (recordType.includes("incidente")) {
      const employeeId = await this.resolveEmployeeId(data.employee);
      const item = await this.prisma.safetyIncident.create({
        data: {
          code: dto.code,
          workId: dto.workId,
          employeeId,
          incidentType: String(data.incidentType ?? dto.title),
          severity: String(data.severity ?? "MEDIUM").toUpperCase(),
          occurredAt: this.optionalDate(data.occurredAt ?? dto.occurredAt) ?? new Date(),
          location: this.optionalString(data.location),
          description: String(data.description ?? dto.title),
          immediateAction: this.optionalString(data.immediateAction),
          correctiveAction: this.optionalString(data.correctiveAction),
          status: dto.status ?? RecordStatus.PENDING,
          reportedById: userId,
          closedAt: this.optionalDate(data.closedAt),
        },
      });
      return { id: item.id, code: item.code, title: dto.title };
    }
    if (recordType.includes("inspección") || recordType.includes("inspeccion") || recordType.includes("correctiva")) {
      const item = await this.prisma.safetyInspection.create({
        data: {
          code: dto.code,
          workId: dto.workId,
          inspectionType: recordType.includes("correctiva") ? "ACCIÓN CORRECTIVA" : dto.title,
          inspectedAt: this.optionalDate(data.occurredAt ?? dto.occurredAt) ?? new Date(),
          inspector: String(data.responsible ?? "Sin asignar"),
          result: String(data.description ?? dto.title),
          dueAt: this.optionalDate(data.expiresAt),
          status: dto.status ?? RecordStatus.PENDING,
        },
      });
      return { id: item.id, code: item.code, title: dto.title };
    }

    const employeeId = await this.requireEmployeeId(data.employee);
    if (recordType.includes("epp")) {
      const item = await this.prisma.pPEIssue.create({
        data: {
          employeeId,
          item: String(data.description ?? dto.title),
          issuedAt: this.optionalDate(data.issuedAt ?? dto.occurredAt) ?? new Date(),
          dueAt: this.optionalDate(data.expiresAt),
          notes: this.optionalString(data.correctiveAction),
        },
      });
      return { id: item.id, code: dto.code, title: dto.title };
    }
    if (recordType.includes("capacitación") || recordType.includes("capacitacion")) {
      const item = await this.prisma.safetyTraining.create({
        data: {
          employeeId,
          topic: String(data.description ?? dto.title),
          provider: this.optionalString(data.responsible),
          completedAt: this.optionalDate(data.issuedAt ?? dto.occurredAt) ?? new Date(),
          expiresAt: this.optionalDate(data.expiresAt),
          approved: dto.status === RecordStatus.APPROVED || dto.status === RecordStatus.ACTIVE,
        },
      });
      return { id: item.id, code: dto.code, title: dto.title };
    }
    const item = await this.prisma.safetyCredential.create({
      data: {
        employeeId,
        credentialType: String(data.description ?? dto.title),
        issuer: this.optionalString(data.responsible),
        issuedAt: this.optionalDate(data.issuedAt ?? dto.occurredAt),
        expiresAt: this.optionalDate(data.expiresAt),
        status: dto.status === RecordStatus.VOID ? "VOID" : "ACTIVE",
      },
    });
    return { id: item.id, code: dto.code, title: dto.title };
  }

  private async updateSafetyDomain(companyId: string, id: string, dto: UpdateRecordDto) {
    const data = dto.data ?? {};
    const incident = await this.prisma.safetyIncident.findFirst({
      where: { id, OR: [{ workId: null }, { work: { companyId } }] },
    });
    if (incident) {
      return this.prisma.safetyIncident.update({
        where: { id },
        data: {
          workId: dto.workId,
          status: dto.status,
          severity: data.severity === undefined ? undefined : String(data.severity).toUpperCase(),
          location: data.location === undefined ? undefined : this.optionalString(data.location),
          description: data.description === undefined ? undefined : String(data.description),
          immediateAction: data.immediateAction === undefined ? undefined : this.optionalString(data.immediateAction),
          correctiveAction: data.correctiveAction === undefined ? undefined : this.optionalString(data.correctiveAction),
          closedAt: data.closedAt === undefined ? undefined : this.optionalDate(data.closedAt),
        },
      });
    }
    const inspection = await this.prisma.safetyInspection.findFirst({
      where: { id, OR: [{ workId: null }, { work: { companyId } }] },
    });
    if (inspection) {
      return this.prisma.safetyInspection.update({
        where: { id },
        data: {
          workId: dto.workId,
          status: dto.status,
          result: data.description === undefined ? undefined : String(data.description),
          inspector: data.responsible === undefined ? undefined : String(data.responsible),
          dueAt: data.expiresAt === undefined ? undefined : this.optionalDate(data.expiresAt),
        },
      });
    }
    const credential = await this.prisma.safetyCredential.findUnique({ where: { id } });
    if (credential) {
      return this.prisma.safetyCredential.update({
        where: { id },
        data: {
          credentialType: data.description === undefined ? undefined : String(data.description),
          issuer: data.responsible === undefined ? undefined : this.optionalString(data.responsible),
          expiresAt: data.expiresAt === undefined ? undefined : this.optionalDate(data.expiresAt),
          status: dto.status === RecordStatus.VOID ? "VOID" : undefined,
        },
      });
    }
    throw new NotFoundException("Registro de Seguridad e Higiene no encontrado");
  }

  private async softDeleteSafetyDomain(companyId: string, id: string) {
    const incident = await this.prisma.safetyIncident.findFirst({
      where: { id, OR: [{ workId: null }, { work: { companyId } }] },
    });
    if (incident) return this.prisma.safetyIncident.update({ where: { id }, data: { status: RecordStatus.VOID } });
    const inspection = await this.prisma.safetyInspection.findFirst({
      where: { id, OR: [{ workId: null }, { work: { companyId } }] },
    });
    if (inspection) return this.prisma.safetyInspection.update({ where: { id }, data: { status: RecordStatus.VOID } });
    const credential = await this.prisma.safetyCredential.findUnique({ where: { id } });
    if (credential) return this.prisma.safetyCredential.update({ where: { id }, data: { status: "VOID" } });
    const ppe = await this.prisma.pPEIssue.findUnique({ where: { id } });
    if (ppe) return this.prisma.pPEIssue.update({ where: { id }, data: { returnedAt: new Date(), condition: "BAJA LÓGICA" } });
    const training = await this.prisma.safetyTraining.findUnique({ where: { id } });
    if (training) return this.prisma.safetyTraining.update({ where: { id }, data: { approved: false, notes: "BAJA LÓGICA" } });
    throw new NotFoundException("Registro de Seguridad e Higiene no encontrado");
  }

  private async requireEmployeeId(value: unknown) {
    const id = await this.resolveEmployeeId(value);
    if (!id) throw new NotFoundException("Empleado no encontrado. Use legajo o nombre completo existente.");
    return id;
  }

  private async resolveEmployeeId(value: unknown) {
    const raw = this.optionalString(value);
    if (!raw) return undefined;
    const normalized = raw.includes("·") ? raw.split("·")[0].trim() : raw.trim();
    const byCode = await this.prisma.employee.findFirst({
      where: { employeeNumber: normalized, active: true },
      select: { id: true },
    });
    if (byCode) return byCode.id;
    const parts = raw.replace(/^[^·]+·s*/, "").trim().split(/s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    const byName = await this.prisma.employee.findFirst({
      where: {
        active: true,
        ...(firstName ? { firstName: { equals: firstName, mode: "insensitive" } } : {}),
        ...(lastName ? { lastName: { equals: lastName, mode: "insensitive" } } : {}),
      },
      select: { id: true },
    });
    return byName?.id;
  }

  private optionalString(value: unknown) {
    if (value === undefined || value === null || value === "") return undefined;
    return String(value).trim();
  }

  private optionalDate(value: unknown) {
    if (!value) return undefined;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private numberValue(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private normalizeMobility(value: unknown) {
    const normalized = String(value ?? "").toLowerCase();
    return normalized.includes("no") || normalized.includes("fijo") ? "FIXED" : "MOBILE";
  }

  private normalizeAssetStatus(value: unknown) {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized.includes("baja") || normalized.includes("vendido")) return "DECOMMISSIONED";
    if (normalized.includes("repar")) return "REPAIR";
    if (normalized.includes("prest")) return "LOANED";
    if (normalized.includes("perd")) return "LOST";
    return "ACTIVE";
  }

  private normalizeAttendance(value: unknown) {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized.includes("ausent")) return "ABSENT";
    if (normalized.includes("licenc")) return "LEAVE";
    if (normalized.includes("enfer")) return "SICK";
    if (normalized.includes("accident")) return "ACCIDENT";
    if (normalized.includes("vacac")) return "VACATION";
    if (normalized.includes("franco")) return "OFF";
    if (normalized.includes("comisi")) return "COMMISSION";
    return "PRESENT";
  }

  private normalizeStakeholderRole(value: unknown) {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized.includes("subcontr")) return "SUBCONTRACTOR";
    if (normalized.includes("contrat")) return "CONTRACTOR";
    if (normalized.includes("prove")) return "SUPPLIER";
    if (normalized.includes("acre")) return "CREDITOR";
    if (normalized.includes("asegur")) return "INSURER";
    if (normalized.includes("comit") || normalized.includes("cliente")) return "CLIENT";
    if (normalized.includes("minister")) return "MINISTRY";
    if (normalized.includes("municip")) return "MUNICIPALITY";
    if (normalized.includes("organ")) return "PUBLIC_AGENCY";
    return "PRIVATE";
  }

  private organizationTypeForRole(role: string) {
    if (role === "MINISTRY") return "MINISTRY" as const;
    if (role === "MUNICIPALITY") return "MUNICIPALITY" as const;
    if (role === "PUBLIC_AGENCY") return "PUBLIC_AGENCY" as const;
    if (role === "SUPPLIER" || role === "CREDITOR") return "SUPPLIER" as const;
    return "PRIVATE" as const;
  }

  private async requireRecord(companyId: string, module: string, id: string) {
    const record = await this.prisma.genericRecord.findFirst({
      where: {
        id,
        module,
        deletedAt: null,
        OR: [{ workId: null }, { work: { companyId } }],
      },
    });
    if (!record) throw new NotFoundException("Registro no encontrado");
    return record;
  }

  private async requireWork(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!work) throw new NotFoundException("Obra no encontrada");
  }

  private async requireModule(slug: string) {
    const module = await this.prisma.moduleConfiguration.findFirst({
      where: { slug, active: true },
      select: { id: true, requiresWork: true },
    });
    if (!module) throw new NotFoundException("Módulo no configurado o inactivo");
    return module;
  }

  private async validateConfiguredData(moduleId: string, value: Record<string, unknown>) {
    const fields = await this.prisma.moduleFieldConfiguration.findMany({
      where: { moduleId, active: true },
      select: { fieldKey: true, label: true, fieldType: true, required: true },
    });
    const allowed = new Set(fields.map((field) => field.fieldKey));
    const unknown = Object.keys(value).filter((key) => key !== "source" && !allowed.has(key));
    if (unknown.length) {
      throw new BadRequestException(`Campos no configurados: ${unknown.join(", ")}`);
    }
    const missing = fields.filter(
      (field) => field.required && (value[field.fieldKey] === undefined || value[field.fieldKey] === ""),
    );
    if (missing.length) {
      throw new BadRequestException(`Faltan campos obligatorios: ${missing.map((field) => field.label).join(", ")}`);
    }
    for (const field of fields) {
      const current = value[field.fieldKey];
      if (current === undefined || current === "") continue;
      if (["number", "currency"].includes(field.fieldType) && !Number.isFinite(Number(current))) {
        throw new BadRequestException(`${field.label} debe ser numérico`);
      }
      if (field.fieldType === "boolean" && typeof current !== "boolean") {
        throw new BadRequestException(`${field.label} debe ser verdadero o falso`);
      }
    }
  }
}
