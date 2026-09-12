import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateAssetComplianceDto, CreateVehicleFineDto, UpdateAssetLiveStateDto } from "./fleet-control.dto";

@Injectable()
export class FleetControlService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(companyId: string) {
    const now = new Date();
    const next30 = new Date(now.getTime() + 30 * 86_400_000);
    const [vehicles, machines, vehicleLocations, machineLocations, fines, compliance] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { active: true, OR: [{ workId: null }, { work: { companyId } }] },
        include: { work: { select: { code: true, name: true } } },
        orderBy: { plate: "asc" },
      }),
      this.prisma.machine.findMany({
        where: { active: true, OR: [{ workId: null }, { work: { companyId } }] },
        include: { work: { select: { code: true, name: true } } },
        orderBy: { code: "asc" },
      }),
      this.prisma.genericRecord.findMany({ where: { module: "fleet-location", deletedAt: null } }),
      this.prisma.genericRecord.findMany({ where: { module: "machine-location", deletedAt: null } }),
      this.prisma.genericRecord.findMany({ where: { module: "fleet-fines", deletedAt: null, status: { not: RecordStatus.VOID } } }),
      this.prisma.genericRecord.findMany({
        where: {
          module: { in: ["fleet-compliance", "machine-compliance"] },
          deletedAt: null,
          status: { not: RecordStatus.VOID },
        },
      }),
    ]);

    const liveByVehicle = new Map(vehicleLocations.map((item) => [String((item.data as Record<string, unknown>).assetId ?? ""), item]));
    const liveByMachine = new Map(machineLocations.map((item) => [String((item.data as Record<string, unknown>).assetId ?? ""), item]));

    const expiring = compliance.filter((item) => {
      const expiresAt = new Date(String((item.data as Record<string, unknown>).expiresAt ?? ""));
      return !Number.isNaN(expiresAt.getTime()) && expiresAt >= now && expiresAt <= next30;
    });
    const expired = compliance.filter((item) => {
      const expiresAt = new Date(String((item.data as Record<string, unknown>).expiresAt ?? ""));
      return !Number.isNaN(expiresAt.getTime()) && expiresAt < now;
    });
    const pendingFines = fines.filter((item) => item.status !== RecordStatus.CLOSED);

    return {
      generatedAt: now.toISOString(),
      summary: {
        activeVehicles: vehicles.length,
        activeMachines: machines.length,
        vehiclesReporting: vehicles.filter((vehicle) => liveByVehicle.has(vehicle.id)).length,
        machinesReporting: machines.filter((machine) => liveByMachine.has(machine.id)).length,
        pendingFines: pendingFines.length,
        pendingFineAmount: pendingFines.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
        documentsDue30Days: expiring.length,
        documentsExpired: expired.length,
      },
      vehicles: vehicles.map((vehicle) => ({ ...vehicle, live: this.liveData(liveByVehicle.get(vehicle.id)) })),
      machines: machines.map((machine) => ({ ...machine, live: this.liveData(liveByMachine.get(machine.id)) })),
    };
  }

  async vehicleDetail(companyId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, OR: [{ workId: null }, { work: { companyId } }] },
      include: {
        work: { select: { code: true, name: true } },
        driverAssignments: { where: { active: true } },
        maintenancePlans: { where: { active: true } },
        maintenanceOrders: { orderBy: { scheduledAt: "desc" }, take: 20 },
        insurancePolicies: { orderBy: { endDate: "asc" } },
      },
    });
    if (!vehicle) throw new NotFoundException("Vehículo no encontrado");
    const [live, fines, compliance, photos] = await Promise.all([
      this.findLive("fleet-location", id),
      this.findAssetRecords("fleet-fines", id),
      this.findAssetRecords("fleet-compliance", id),
      this.findPhotos("fleet", "Vehicle", id),
    ]);
    return { ...vehicle, live: this.liveData(live), fines, compliance, photos };
  }

  async machineDetail(companyId: string, id: string) {
    const machine = await this.prisma.machine.findFirst({
      where: { id, OR: [{ workId: null }, { work: { companyId } }] },
      include: {
        work: { select: { code: true, name: true } },
        maintenancePlans: { where: { active: true } },
        maintenanceOrders: { orderBy: { scheduledAt: "desc" }, take: 20 },
        insurancePolicies: { orderBy: { endDate: "asc" } },
      },
    });
    if (!machine) throw new NotFoundException("Máquina no encontrada");
    const [live, compliance, photos] = await Promise.all([
      this.findLive("machine-location", id),
      this.findAssetRecords("machine-compliance", id),
      this.findPhotos("machinery", "Machine", id),
    ]);
    return { ...machine, live: this.liveData(live), compliance, photos };
  }

  async updateVehicleLive(companyId: string, userId: string, id: string, dto: UpdateAssetLiveStateDto) {
    await this.requireVehicle(companyId, id);
    return this.upsertLive("fleet-location", id, userId, dto);
  }

  async updateMachineLive(companyId: string, userId: string, id: string, dto: UpdateAssetLiveStateDto) {
    await this.requireMachine(companyId, id);
    return this.upsertLive("machine-location", id, userId, dto);
  }

  async createFine(companyId: string, userId: string, vehicleId: string, dto: CreateVehicleFineDto) {
    const vehicle = await this.requireVehicle(companyId, vehicleId);
    const occurredAt = this.requiredDate(dto.occurredAt, "Fecha de infracción");
    const dueAt = dto.dueAt ? this.requiredDate(dto.dueAt, "Vencimiento") : undefined;
    const code = `MUL-${vehicle.plate}-${dto.fineNumber}`.replace(/\s+/g, "-").toUpperCase();
    const record = await this.prisma.genericRecord.upsert({
      where: { module_code: { module: "fleet-fines", code } },
      update: {
        title: `${dto.authority} · ${dto.fineNumber}`,
        amount: dto.amount,
        occurredAt,
        status: RecordStatus.PENDING,
        data: {
          assetId: vehicleId,
          plate: vehicle.plate,
          authority: dto.authority,
          fineNumber: dto.fineNumber,
          dueAt: dueAt?.toISOString() ?? null,
          reason: dto.reason ?? null,
          location: dto.location ?? null,
          driver: dto.driver ?? null,
          receiptReference: dto.receiptReference ?? null,
        },
      },
      create: {
        module: "fleet-fines",
        code,
        title: `${dto.authority} · ${dto.fineNumber}`,
        status: RecordStatus.PENDING,
        amount: dto.amount,
        occurredAt,
        createdById: userId,
        data: {
          assetId: vehicleId,
          plate: vehicle.plate,
          authority: dto.authority,
          fineNumber: dto.fineNumber,
          dueAt: dueAt?.toISOString() ?? null,
          reason: dto.reason ?? null,
          location: dto.location ?? null,
          driver: dto.driver ?? null,
          receiptReference: dto.receiptReference ?? null,
        },
      },
    });
    if (dueAt) await this.createOrUpdateAlert(`FINE:${record.id}`, "Multa pendiente", `${vehicle.plate} · ${dto.fineNumber} · $${dto.amount}`, dueAt);
    return record;
  }

  async createVehicleCompliance(companyId: string, userId: string, id: string, dto: CreateAssetComplianceDto) {
    const vehicle = await this.requireVehicle(companyId, id);
    return this.createCompliance("fleet-compliance", id, vehicle.plate, userId, dto);
  }

  async createMachineCompliance(companyId: string, userId: string, id: string, dto: CreateAssetComplianceDto) {
    const machine = await this.requireMachine(companyId, id);
    return this.createCompliance("machine-compliance", id, machine.code, userId, dto);
  }

  private async upsertLive(module: string, assetId: string, userId: string, dto: UpdateAssetLiveStateDto) {
    const code = `LIVE-${assetId}`;
    return this.prisma.genericRecord.upsert({
      where: { module_code: { module, code } },
      update: {
        title: dto.locationText || `${dto.latitude}, ${dto.longitude}`,
        status: dto.operationalStatus === "OUT_OF_SERVICE" ? RecordStatus.PENDING : RecordStatus.ACTIVE,
        occurredAt: new Date(),
        data: {
          assetId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters ?? null,
          speedKmh: dto.speedKmh ?? null,
          headingDeg: dto.headingDeg ?? null,
          locationText: dto.locationText ?? null,
          operationalStatus: dto.operationalStatus,
          source: dto.source,
          deviceId: dto.deviceId ?? null,
          updatedAt: new Date().toISOString(),
          updatedById: userId,
        },
      },
      create: {
        module,
        code,
        title: dto.locationText || `${dto.latitude}, ${dto.longitude}`,
        status: dto.operationalStatus === "OUT_OF_SERVICE" ? RecordStatus.PENDING : RecordStatus.ACTIVE,
        occurredAt: new Date(),
        createdById: userId,
        data: {
          assetId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters ?? null,
          speedKmh: dto.speedKmh ?? null,
          headingDeg: dto.headingDeg ?? null,
          locationText: dto.locationText ?? null,
          operationalStatus: dto.operationalStatus,
          source: dto.source,
          deviceId: dto.deviceId ?? null,
          updatedAt: new Date().toISOString(),
          updatedById: userId,
        },
      },
    });
  }

  private async createCompliance(module: string, assetId: string, assetCode: string, userId: string, dto: CreateAssetComplianceDto) {
    const expiresAt = this.requiredDate(dto.expiresAt, "Vencimiento");
    const issuedAt = dto.issuedAt ? this.requiredDate(dto.issuedAt, "Emisión") : undefined;
    const code = `DOC-${assetCode}-${dto.documentType}-${dto.documentNumber ?? expiresAt.toISOString().slice(0, 10)}`.replace(/\s+/g, "-").toUpperCase();
    const now = new Date();
    const status = expiresAt < now ? RecordStatus.PENDING : RecordStatus.ACTIVE;
    const record = await this.prisma.genericRecord.upsert({
      where: { module_code: { module, code } },
      update: {
        title: dto.documentType,
        status,
        occurredAt: issuedAt,
        data: {
          assetId,
          assetCode,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber ?? null,
          issuedAt: issuedAt?.toISOString() ?? null,
          expiresAt: expiresAt.toISOString(),
          issuer: dto.issuer ?? null,
          notes: dto.notes ?? null,
        },
      },
      create: {
        module,
        code,
        title: dto.documentType,
        status,
        occurredAt: issuedAt,
        createdById: userId,
        data: {
          assetId,
          assetCode,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber ?? null,
          issuedAt: issuedAt?.toISOString() ?? null,
          expiresAt: expiresAt.toISOString(),
          issuer: dto.issuer ?? null,
          notes: dto.notes ?? null,
        },
      },
    });
    await this.createOrUpdateAlert(`DOC:${record.id}`, `Vencimiento ${dto.documentType}`, `${assetCode} · vence ${expiresAt.toLocaleDateString("es-AR")}`, expiresAt);
    return record;
  }

  private async createOrUpdateAlert(key: string, title: string, description: string, dueAt: Date) {
    const existing = await this.prisma.alert.findFirst({ where: { type: key, resolvedAt: null } });
    const severity = dueAt.getTime() - Date.now() <= 7 * 86_400_000 ? "HIGH" : "MEDIUM";
    if (existing) return this.prisma.alert.update({ where: { id: existing.id }, data: { title, description, dueAt, severity } });
    return this.prisma.alert.create({ data: { type: key, title, description, dueAt, severity } });
  }

  private findLive(module: string, assetId: string) {
    return this.prisma.genericRecord.findUnique({ where: { module_code: { module, code: `LIVE-${assetId}` } } });
  }

  private findAssetRecords(module: string, assetId: string) {
    return this.prisma.genericRecord.findMany({
      where: { module, deletedAt: null, data: { path: ["assetId"], equals: assetId } },
      orderBy: { updatedAt: "desc" },
    });
  }

  private findPhotos(module: string, entityType: string, entityId: string) {
    return this.prisma.document.findMany({
      where: { module, entityType, entityId, deletedAt: null },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    });
  }

  private liveData(record: Awaited<ReturnType<FleetControlService["findLive"]>> | undefined | null) {
    if (!record) return null;
    return { ...record.data as Record<string, unknown>, recordId: record.id, lastSeenAt: record.occurredAt ?? record.updatedAt };
  }

  private async requireVehicle(companyId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, OR: [{ workId: null }, { work: { companyId } }] } });
    if (!vehicle) throw new NotFoundException("Vehículo no encontrado");
    return vehicle;
  }

  private async requireMachine(companyId: string, id: string) {
    const machine = await this.prisma.machine.findFirst({ where: { id, OR: [{ workId: null }, { work: { companyId } }] } });
    if (!machine) throw new NotFoundException("Máquina no encontrada");
    return machine;
  }

  private requiredDate(value: string, label: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${label} inválida`);
    return parsed;
  }
}
