import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationType, Prisma, RecordStatus } from "@prisma/client";
import type { AuthUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ApproveMaterialRequestDto,
  CreateDeliveryNoteDto,
  CreateMaterialRequestDto,
  CreateMaterialTakeoffDto,
} from "./procurement.dto";

const TECHNICAL_ROLES = new Set([
  "TEC_JEFE_OBRA",
  "TEC_OFICINA_TECNICA",
  "TEC_EQUIPOS_LOGISTICA",
  "ADMIN_GENERAL",
  "GERENTE_EMPRESA",
]);

const LOGISTICS_ROLES = new Set([
  "TEC_EQUIPOS_LOGISTICA",
  "ADM_COMPRAS_TESORERIA",
  "ADMIN_GENERAL",
  "GERENTE_EMPRESA",
]);

const MANAGER_ROLES = new Set(["GERENTE_EMPRESA", "ADMIN_GENERAL"]);

type TakeoffItem = {
  code: string;
  description: string;
  unit: string;
  quantity: number;
};

type RequestItem = {
  takeoffItemCode: string;
  description: string;
  unit: string;
  requestedQty: number;
  approvedQty: number;
  allocatedQty: number;
  priorReservedQty: number;
  remainingBeforeQty: number;
  projectedQty: number;
  exceedsAllocation: boolean;
  notes?: string;
};

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  async listTakeoffs(companyId: string, workId: string) {
    await this.requireWork(companyId, workId);
    return this.prisma.genericRecord.findMany({
      where: { module: "material-takeoff", workId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createTakeoff(user: AuthUser, dto: CreateMaterialTakeoffDto) {
    this.requireTechnicalRole(user);
    const work = await this.requireWork(user.companyId, dto.workId);
    const code = `CMP-${work.code}-V${dto.version}`;
    const duplicate = await this.prisma.genericRecord.findFirst({
      where: { module: "material-takeoff", code, deletedAt: null },
    });
    if (duplicate) throw new BadRequestException("Ya existe ese cómputo y versión para la obra");

    const normalizedItems = this.normalizeTakeoffItems(dto.items);
    return this.prisma.genericRecord.create({
      data: {
        module: "material-takeoff",
        workId: dto.workId,
        code,
        title: dto.title,
        status: RecordStatus.ACTIVE,
        createdById: user.id,
        data: {
          version: dto.version,
          items: normalizedItems,
          itemCount: normalizedItems.length,
          totalQuantity: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
        } as Prisma.InputJsonValue,
      },
    });
  }

  async listRequests(companyId: string, workId?: string) {
    if (workId) await this.requireWork(companyId, workId);
    return this.prisma.genericRecord.findMany({
      where: {
        module: "material-requests",
        deletedAt: null,
        ...(workId ? { workId } : {}),
        AND: [{ OR: [{ workId: null }, { work: { companyId } }] }],
      },
      include: { work: { select: { code: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async createRequest(user: AuthUser, dto: CreateMaterialRequestDto) {
    this.requireTechnicalRole(user);
    const work = await this.requireWork(user.companyId, dto.workId);
    const takeoff = await this.prisma.genericRecord.findFirst({
      where: {
        id: dto.takeoffId,
        module: "material-takeoff",
        workId: dto.workId,
        deletedAt: null,
        status: { in: [RecordStatus.ACTIVE, RecordStatus.APPROVED] },
      },
    });
    if (!takeoff) throw new NotFoundException("Cómputo de materiales no encontrado para la obra");

    const takeoffItems = this.takeoffItems(takeoff.data);
    const reservations = await this.currentReservations(dto.workId, takeoff.id);
    const requestItems: RequestItem[] = dto.items.map((item) => {
      const base = takeoffItems.find((candidate) => candidate.code === item.takeoffItemCode);
      if (!base) throw new BadRequestException(`El material ${item.takeoffItemCode} no pertenece al cómputo de la obra`);
      const priorReservedQty = reservations.get(base.code) ?? 0;
      const remainingBeforeQty = Math.max(0, base.quantity - priorReservedQty);
      const projectedQty = priorReservedQty + Number(item.quantity);
      return {
        takeoffItemCode: base.code,
        description: base.description,
        unit: base.unit,
        requestedQty: Number(item.quantity),
        approvedQty: 0,
        allocatedQty: base.quantity,
        priorReservedQty,
        remainingBeforeQty,
        projectedQty,
        exceedsAllocation: projectedQty > base.quantity + 0.000001,
        notes: item.notes,
      };
    });

    const overrun = requestItems.some((item) => item.exceedsAllocation);
    if (overrun && !dto.overrunReason?.trim()) {
      throw new BadRequestException("La solicitud excede el cómputo asignado. Debe indicar la justificación del exceso para elevarla a Gerencia.");
    }

    const number = this.requestNumber(work.code);
    const record = await this.prisma.genericRecord.create({
      data: {
        module: "material-requests",
        workId: dto.workId,
        code: number,
        title: `Orden de pedido · ${work.name}`,
        status: RecordStatus.PENDING,
        occurredAt: new Date(),
        createdById: user.id,
        data: {
          takeoffId: takeoff.id,
          takeoffCode: takeoff.code,
          requiredAt: dto.requiredAt ?? null,
          overrun,
          overrunReason: dto.overrunReason?.trim() ?? null,
          managerApprovalRequired: true,
          approvalStatus: "PENDING",
          items: requestItems,
          generatedPurchaseOrderId: null,
          generatedPurchaseOrderNumber: null,
        } as Prisma.InputJsonValue,
      },
    });

    await this.notifyManagers({
      workId: dto.workId,
      requestId: record.id,
      requestNumber: number,
      workName: work.name,
      overrun,
    });

    return record;
  }

  async approveRequest(user: AuthUser, requestId: string, dto: ApproveMaterialRequestDto) {
    if (!user.roleCodes.some((role) => MANAGER_ROLES.has(role))) {
      throw new ForbiddenException("Solo el Gerente General o el Administrador General pueden aprobar órdenes de pedido");
    }

    const request = await this.prisma.genericRecord.findFirst({
      where: { id: requestId, module: "material-requests", deletedAt: null },
    });
    if (!request) throw new NotFoundException("Orden de pedido no encontrada");
    if (request.status !== RecordStatus.PENDING) {
      throw new BadRequestException("La orden ya fue resuelta");
    }
    if (!request.workId) throw new BadRequestException("La orden no tiene obra asociada");
    await this.requireWork(user.companyId, request.workId);

    const data = this.objectData(request.data);
    const items = this.requestItems(data.items);

    if (dto.decision === "REJECT") {
      return this.prisma.genericRecord.update({
        where: { id: request.id },
        data: {
          status: RecordStatus.REJECTED,
          approvedById: user.id,
          approvedAt: new Date(),
          data: {
            ...data,
            approvalStatus: "REJECTED",
            approvalComments: dto.comments ?? null,
            approvedBy: user.id,
            approvedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }

    const approvedItems = items.map((item) => ({ ...item, approvedQty: item.requestedQty }));
    const purchaseOrder = await this.createAutomaticPurchaseOrder(
      user.id,
      request.workId,
      request.code,
      approvedItems,
      Boolean(data.overrun),
    );

    return this.prisma.genericRecord.update({
      where: { id: request.id },
      data: {
        status: RecordStatus.APPROVED,
        approvedById: user.id,
        approvedAt: new Date(),
        data: {
          ...data,
          approvalStatus: "APPROVED",
          approvalComments: dto.comments ?? null,
          approvedBy: user.id,
          approvedAt: new Date().toISOString(),
          items: approvedItems,
          generatedPurchaseOrderId: purchaseOrder.id,
          generatedPurchaseOrderNumber: purchaseOrder.number,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async listDeliveryNotes(companyId: string, workId?: string, requestId?: string) {
    if (workId) await this.requireWork(companyId, workId);
    const records = await this.prisma.genericRecord.findMany({
      where: {
        module: "delivery-notes",
        deletedAt: null,
        ...(workId ? { workId } : {}),
        AND: [{ OR: [{ workId: null }, { work: { companyId } }] }],
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    if (!requestId) return records;
    return records.filter((record) => this.objectData(record.data).requestId === requestId);
  }

  async createDeliveryNote(user: AuthUser, dto: CreateDeliveryNoteDto) {
    if (!user.roleCodes.some((role) => LOGISTICS_ROLES.has(role))) {
      throw new ForbiddenException("Solo Logística, Compras/Tesorería, Gerencia o Administración General pueden emitir remitos");
    }

    const request = await this.prisma.genericRecord.findFirst({
      where: {
        id: dto.requestId,
        module: "material-requests",
        deletedAt: null,
        status: RecordStatus.APPROVED,
      },
    });
    if (!request || !request.workId) throw new NotFoundException("Orden de pedido aprobada no encontrada");
    const work = await this.requireWork(user.companyId, request.workId);
    const requestData = this.objectData(request.data);
    const approvedItems = this.requestItems(requestData.items);
    const previousNotes = await this.listDeliveryNotes(user.companyId, request.workId, request.id);

    const alreadyDelivered = new Map<string, number>();
    for (const note of previousNotes) {
      const noteData = this.objectData(note.data);
      for (const item of this.deliveryItems(noteData.items)) {
        alreadyDelivered.set(item.takeoffItemCode, (alreadyDelivered.get(item.takeoffItemCode) ?? 0) + item.quantity);
      }
    }

    const noteItems = dto.items.map((item) => {
      const approved = approvedItems.find((candidate) => candidate.takeoffItemCode === item.takeoffItemCode);
      if (!approved) throw new BadRequestException(`El material ${item.takeoffItemCode} no pertenece a la orden aprobada`);
      const previous = alreadyDelivered.get(item.takeoffItemCode) ?? 0;
      const quantity = Number(item.quantity);
      if (previous + quantity > approved.approvedQty + 0.000001) {
        throw new BadRequestException(`El remito excede la cantidad aprobada para ${item.takeoffItemCode}`);
      }
      return {
        takeoffItemCode: approved.takeoffItemCode,
        description: approved.description,
        unit: approved.unit,
        quantity,
        previouslyDeliveredQty: previous,
        remainingAfterQty: approved.approvedQty - previous - quantity,
      };
    });

    const sequence = previousNotes.length + 1;
    const code = `REM-${request.code}-${String(sequence).padStart(2, "0")}`;
    return this.prisma.genericRecord.create({
      data: {
        module: "delivery-notes",
        workId: request.workId,
        code,
        title: `Remito a obra · ${work.name}`,
        status: RecordStatus.ACTIVE,
        occurredAt: dto.issuedAt ? new Date(dto.issuedAt) : new Date(),
        createdById: user.id,
        data: {
          requestId: request.id,
          requestNumber: request.code,
          purchaseOrderId: requestData.generatedPurchaseOrderId ?? null,
          purchaseOrderNumber: requestData.generatedPurchaseOrderNumber ?? null,
          vehiclePlate: dto.vehiclePlate ?? null,
          driver: dto.driver ?? null,
          issuedAt: dto.issuedAt ?? new Date().toISOString(),
          copies: 2,
          copyLabels: ["ORIGINAL · OBRA", "DUPLICADO · LOGÍSTICA"],
          destinationWork: { id: work.id, code: work.code, name: work.name, city: work.city },
          items: noteItems,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async workSummary(companyId: string, workId: string) {
    const work = await this.requireWork(companyId, workId);
    const takeoffs = await this.listTakeoffs(companyId, workId);
    const requests = await this.listRequests(companyId, workId);
    const notes = await this.listDeliveryNotes(companyId, workId);
    const latestTakeoff = takeoffs[0] ?? null;
    const takeoffItems = latestTakeoff ? this.takeoffItems(latestTakeoff.data) : [];
    const reservations = latestTakeoff ? await this.currentReservations(workId, latestTakeoff.id) : new Map<string, number>();
    const delivered = new Map<string, number>();
    for (const note of notes) {
      for (const item of this.deliveryItems(this.objectData(note.data).items)) {
        delivered.set(item.takeoffItemCode, (delivered.get(item.takeoffItemCode) ?? 0) + item.quantity);
      }
    }

    return {
      work: { id: work.id, code: work.code, name: work.name },
      latestTakeoff,
      materials: takeoffItems.map((item) => ({
        ...item,
        reservedQty: reservations.get(item.code) ?? 0,
        deliveredQty: delivered.get(item.code) ?? 0,
        remainingQty: item.quantity - (reservations.get(item.code) ?? 0),
      })),
      requests: {
        total: requests.length,
        pending: requests.filter((item) => item.status === RecordStatus.PENDING).length,
        approved: requests.filter((item) => item.status === RecordStatus.APPROVED).length,
        rejected: requests.filter((item) => item.status === RecordStatus.REJECTED).length,
        overrun: requests.filter((item) => Boolean(this.objectData(item.data).overrun)).length,
      },
      deliveryNotes: notes.length,
    };
  }

  private async currentReservations(workId: string, takeoffId: string) {
    const requests = await this.prisma.genericRecord.findMany({
      where: {
        module: "material-requests",
        workId,
        deletedAt: null,
        status: { in: [RecordStatus.PENDING, RecordStatus.APPROVED, RecordStatus.ACTIVE, RecordStatus.CLOSED] },
      },
      select: { data: true, status: true },
    });
    const reservations = new Map<string, number>();
    for (const request of requests) {
      const data = this.objectData(request.data);
      if (data.takeoffId !== takeoffId) continue;
      for (const item of this.requestItems(data.items)) {
        const qty = request.status === RecordStatus.APPROVED || request.status === RecordStatus.ACTIVE || request.status === RecordStatus.CLOSED
          ? item.approvedQty || item.requestedQty
          : item.requestedQty;
        reservations.set(item.takeoffItemCode, (reservations.get(item.takeoffItemCode) ?? 0) + qty);
      }
    }
    return reservations;
  }

  private async createAutomaticPurchaseOrder(
    userId: string,
    workId: string,
    requestNumber: string,
    items: RequestItem[],
    overrun: boolean,
  ) {
    const supplier = await this.ensurePendingSupplier();
    const number = `OC-${requestNumber.replace(/^PED-/, "")}`;
    return this.prisma.purchaseOrder.create({
      data: {
        number,
        workId,
        supplierId: supplier.id,
        requestedById: userId,
        approvedById: userId,
        status: RecordStatus.PENDING,
        subtotal: 0,
        vat: 0,
        total: 0,
        metadata: {
          requestNumber,
          autoGenerated: true,
          supplierPendingAssignment: true,
          overrunApproved: overrun,
          items: items.map((item) => ({
            code: item.takeoffItemCode,
            description: item.description,
            unit: item.unit,
            quantity: item.approvedQty,
          })),
          paymentStatus: "Pendiente",
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async ensurePendingSupplier() {
    let organization = await this.prisma.organization.findFirst({
      where: { legalName: "PROVEEDOR A DEFINIR · ORDEN AUTOMÁTICA", deletedAt: null },
    });
    if (!organization) {
      organization = await this.prisma.organization.create({
        data: {
          type: OrganizationType.SUPPLIER,
          legalName: "PROVEEDOR A DEFINIR · ORDEN AUTOMÁTICA",
          metadata: { internalPlaceholder: true },
        },
      });
    }
    return this.prisma.supplier.upsert({
      where: { organizationId: organization.id },
      update: { active: true },
      create: { organizationId: organization.id, active: true },
    });
  }

  private async notifyManagers(input: {
    workId: string;
    requestId: string;
    requestNumber: string;
    workName: string;
    overrun: boolean;
  }) {
    const managers = await this.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        roles: { some: { role: { code: { in: ["GERENTE_EMPRESA", "ADMIN_GENERAL"] } } } },
      },
      select: { id: true },
    });
    if (managers.length) {
      await this.prisma.notification.createMany({
        data: managers.map((manager) => ({
          userId: manager.id,
          type: input.overrun ? "MATERIAL_REQUEST_OVERRUN" : "MATERIAL_REQUEST_APPROVAL",
          title: input.overrun ? "Orden de pedido con exceso" : "Orden de pedido pendiente de aprobación",
          message: `${input.requestNumber} · ${input.workName}${input.overrun ? " · supera el cómputo asignado" : ""}`,
          severity: input.overrun ? "HIGH" : "INFO",
          module: "purchases",
          entityType: "MaterialRequest",
          entityId: input.requestId,
          actionUrl: `/purchases?request=${input.requestId}`,
        })),
      });
    }
    await this.prisma.alert.create({
      data: {
        workId: input.workId,
        type: input.overrun ? "MATERIAL_OVERRUN" : "MATERIAL_REQUEST_APPROVAL",
        severity: input.overrun ? "HIGH" : "INFO",
        title: input.overrun ? "Pedido excede cómputo de obra" : "Orden de pedido pendiente",
        description: `${input.requestNumber} · requiere aprobación del Gerente General`,
      },
    });
  }

  private requireTechnicalRole(user: AuthUser) {
    if (!user.roleCodes.some((role) => TECHNICAL_ROLES.has(role))) {
      throw new ForbiddenException("Esta operación corresponde a roles técnicos, Gerencia o Administración General");
    }
  }

  private async requireWork(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true, code: true, name: true, city: true },
    });
    if (!work) throw new NotFoundException("Obra no encontrada");
    return work;
  }

  private normalizeTakeoffItems(items: CreateMaterialTakeoffDto["items"]): TakeoffItem[] {
    const seen = new Set<string>();
    return items.map((item) => {
      const code = item.code.trim().toUpperCase();
      if (seen.has(code)) throw new BadRequestException(`Código de material duplicado: ${code}`);
      seen.add(code);
      return {
        code,
        description: item.description.trim(),
        unit: item.unit.trim(),
        quantity: Number(item.quantity),
      };
    });
  }

  private takeoffItems(data: Prisma.JsonValue): TakeoffItem[] {
    const raw = this.objectData(data).items;
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      const value = this.objectData(item as Prisma.JsonValue);
      return {
        code: String(value.code ?? ""),
        description: String(value.description ?? ""),
        unit: String(value.unit ?? ""),
        quantity: Number(value.quantity ?? 0),
      };
    });
  }

  private requestItems(value: unknown): RequestItem[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      const raw = this.objectData(item as Prisma.JsonValue);
      return {
        takeoffItemCode: String(raw.takeoffItemCode ?? ""),
        description: String(raw.description ?? ""),
        unit: String(raw.unit ?? ""),
        requestedQty: Number(raw.requestedQty ?? 0),
        approvedQty: Number(raw.approvedQty ?? 0),
        allocatedQty: Number(raw.allocatedQty ?? 0),
        priorReservedQty: Number(raw.priorReservedQty ?? 0),
        remainingBeforeQty: Number(raw.remainingBeforeQty ?? 0),
        projectedQty: Number(raw.projectedQty ?? 0),
        exceedsAllocation: Boolean(raw.exceedsAllocation),
        notes: raw.notes ? String(raw.notes) : undefined,
      };
    });
  }

  private deliveryItems(value: unknown) {
    if (!Array.isArray(value)) return [] as Array<{ takeoffItemCode: string; quantity: number }>;
    return value.map((item) => {
      const raw = this.objectData(item as Prisma.JsonValue);
      return { takeoffItemCode: String(raw.takeoffItemCode ?? ""), quantity: Number(raw.quantity ?? 0) };
    });
  }

  private objectData(value: Prisma.JsonValue | unknown): Record<string, any> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }

  private requestNumber(workCode: string) {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `PED-${workCode}-${stamp}-${random}`;
  }
}
