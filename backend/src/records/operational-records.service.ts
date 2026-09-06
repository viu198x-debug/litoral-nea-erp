import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateRecordDto } from "./dto/create-record.dto";
import type { UpdateRecordDto } from "./dto/update-record.dto";

const operationalModules = new Set([
  "fleet",
  "drivers",
  "fuel",
  "machinery",
  "maintenance",
  "mechanics",
  "spare-parts",
  "fuel-estimates",
  "insurance",
  "unexpected-tasks",
]);

@Injectable()
export class OperationalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  handles(module: string) {
    return operationalModules.has(module);
  }

  async list(
    companyId: string,
    module: string,
    filters: { workId?: string; status?: RecordStatus; search?: string },
  ) {
    const search = filters.search?.trim().slice(0, 120);
    switch (module) {
      case "fleet": {
        const items = await this.prisma.vehicle.findMany({
          where: {
            ...(filters.workId ? { workId: filters.workId } : {}),
            ...(search ? { OR: [
              { plate: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
            ] } : {}),
            OR: [{ workId: null }, { work: { companyId } }],
          },
          include: { work: { select: { code: true, name: true } } },
          orderBy: [{ active: "desc" }, { plate: "asc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.plate,
          title: `${item.brand} ${item.model}`,
          status: item.active ? RecordStatus.ACTIVE : RecordStatus.VOID,
          amount: null,
          date: item.inspectionDue ?? item.insuranceDue,
          owner: "fleet",
          work: item.work,
          data: {
            plate: item.plate,
            brand: item.brand,
            model: item.model,
            year: item.year,
            odometerKm: item.odometerKm,
            insuranceDue: item.insuranceDue,
            inspectionDue: item.inspectionDue,
            active: item.active ? "Sí" : "No",
          },
        }));
      }
      case "drivers": {
        const items = await this.prisma.driver.findMany({
          where: {
            ...(search ? { OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { employeeCode: { contains: search, mode: "insensitive" } },
              { licenseNumber: { contains: search, mode: "insensitive" } },
            ] } : {}),
          },
          include: { vehicle: { select: { plate: true, work: { select: { code: true, name: true } } } } },
          orderBy: [{ active: "desc" }, { fullName: "asc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.employeeCode,
          title: item.fullName,
          status: item.active ? RecordStatus.ACTIVE : RecordStatus.VOID,
          amount: null,
          date: item.licenseDue,
          owner: "drivers",
          work: item.vehicle?.work ?? null,
          data: {
            employeeCode: item.employeeCode,
            licenseNumber: item.licenseNumber,
            licenseCategory: item.licenseCategory,
            licenseDue: item.licenseDue,
            vehicle: item.vehicle?.plate ?? "",
            active: item.active ? "Sí" : "No",
          },
        }));
      }
      case "fuel": {
        const items = await this.prisma.fuelLog.findMany({
          where: {
            voidedAt: null,
            ...(filters.workId ? { workId: filters.workId } : {}),
            ...(search ? { OR: [
              { supplier: { contains: search, mode: "insensitive" } },
              { vehicle: { plate: { contains: search, mode: "insensitive" } } },
              { machine: { code: { contains: search, mode: "insensitive" } } },
            ] } : {}),
            OR: [{ workId: null }, { work: { companyId } }],
          },
          include: {
            work: { select: { code: true, name: true } },
            vehicle: { select: { plate: true } },
            machine: { select: { code: true } },
            driver: { select: { fullName: true } },
          },
          orderBy: { filledAt: "desc" },
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: `COMB-${item.id.slice(-8).toUpperCase()}`,
          title: item.vehicle?.plate ?? item.machine?.code ?? "Carga de combustible",
          status: RecordStatus.ACTIVE,
          amount: item.total,
          date: item.filledAt,
          owner: item.createdById,
          work: item.work,
          data: {
            filledAt: item.filledAt,
            assetType: item.vehicleId ? "Vehículo" : "Máquina",
            asset: item.vehicle?.plate ?? item.machine?.code ?? "",
            driver: item.driver?.fullName ?? "",
            liters: item.liters,
            unitPrice: item.unitPrice,
            total: item.total,
            odometerKm: item.odometerKm,
            hourMeter: item.hourMeter,
            supplier: item.supplier,
            costCenter: item.costCenter,
          },
        }));
      }
      case "machinery": {
        const items = await this.prisma.machine.findMany({
          where: {
            ...(filters.workId ? { workId: filters.workId } : {}),
            ...(search ? { OR: [
              { code: { contains: search, mode: "insensitive" } },
              { equipmentType: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
            ] } : {}),
            OR: [{ workId: null }, { work: { companyId } }],
          },
          include: { work: { select: { code: true, name: true } } },
          orderBy: [{ active: "desc" }, { code: "asc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.code,
          title: `${item.equipmentType} · ${item.brand} ${item.model}`,
          status: item.active ? RecordStatus.ACTIVE : RecordStatus.VOID,
          amount: item.hourlyCost,
          date: null,
          owner: "machinery",
          work: item.work,
          data: {
            equipmentType: item.equipmentType,
            brand: item.brand,
            model: item.model,
            hourMeter: item.hourMeter,
            operator: item.operatorName,
            hourlyCost: item.hourlyCost,
          },
        }));
      }
      case "maintenance": {
        const items = await this.prisma.maintenanceOrder.findMany({
          where: {
            ...(filters.workId ? { workId: filters.workId } : {}),
            ...(search ? { OR: [
              { number: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { vehicle: { plate: { contains: search, mode: "insensitive" } } },
              { machine: { code: { contains: search, mode: "insensitive" } } },
            ] } : {}),
            OR: [{ workId: null }, { work: { companyId } }],
          },
          include: {
            work: { select: { code: true, name: true } },
            vehicle: { select: { plate: true } },
            machine: { select: { code: true } },
            mechanic: { select: { fullName: true } },
          },
          orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.number,
          title: item.description,
          status: item.status,
          amount: Number(item.partsCost) + Number(item.laborCost),
          date: item.scheduledAt ?? item.completedAt,
          owner: item.mechanic?.fullName ?? "maintenance",
          work: item.work,
          data: {
            maintenanceType: item.type,
            assetType: item.vehicleId ? "Vehículo" : item.machineId ? "Máquina" : "Instalación",
            asset: item.vehicle?.plate ?? item.machine?.code ?? "",
            mechanic: item.mechanic?.fullName ?? "",
            priority: item.priority,
            description: item.description,
            scheduledAt: item.scheduledAt,
            completedAt: item.completedAt,
            odometerKm: item.odometerKm,
            hourMeter: item.hourMeter,
            partsCost: item.partsCost,
            laborCost: item.laborCost,
            totalCost: Number(item.partsCost) + Number(item.laborCost),
            nextServiceAt: item.nextServiceAt,
            notes: item.notes,
          },
        }));
      }
      case "mechanics": {
        const items = await this.prisma.mechanic.findMany({
          where: search ? { OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { specialty: { contains: search, mode: "insensitive" } },
          ] } : {},
          include: { employee: { select: { employeeNumber: true } } },
          orderBy: [{ active: "desc" }, { fullName: "asc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.employee?.employeeNumber ?? `MEC-${item.id.slice(-8).toUpperCase()}`,
          title: item.fullName,
          status: item.active ? RecordStatus.ACTIVE : RecordStatus.VOID,
          amount: null,
          date: null,
          owner: "mechanics",
          work: null,
          data: {
            employeeNumber: item.employee?.employeeNumber ?? "",
            fullName: item.fullName,
            specialty: item.specialty,
            phone: item.phone,
            email: item.email,
            active: item.active ? "Sí" : "No",
            notes: item.notes,
          },
        }));
      }
      case "spare-parts": {
        const items = await this.prisma.sparePart.findMany({
          where: {
            ...(search ? { OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
            ] } : {}),
          },
          orderBy: [{ active: "desc" }, { description: "asc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.sku,
          title: item.description,
          status: item.active ? RecordStatus.ACTIVE : RecordStatus.VOID,
          amount: Number(item.currentStock) * Number(item.averageCost),
          date: null,
          owner: "parts",
          work: null,
          data: {
            sku: item.sku,
            description: item.description,
            brand: item.brand,
            unit: item.unit,
            currentStock: item.currentStock,
            minimumStock: item.minimumStock,
            averageCost: item.averageCost,
            stockValue: Number(item.currentStock) * Number(item.averageCost),
            location: item.location,
            active: item.active ? "Sí" : "No",
          },
        }));
      }
      case "fuel-estimates": {
        const items = await this.prisma.fuelEstimate.findMany({
          where: {
            ...(filters.workId ? { workId: filters.workId } : {}),
            ...(search ? { OR: [
              { period: { contains: search, mode: "insensitive" } },
              { vehicle: { plate: { contains: search, mode: "insensitive" } } },
            ] } : {}),
            OR: [{ workId: null }, { work: { companyId } }],
          },
          include: {
            vehicle: { select: { plate: true } },
            work: { select: { code: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: `ECO-${item.id.slice(-8).toUpperCase()}`,
          title: `${item.vehicle.plate} · ${item.period}`,
          status: item.status,
          amount: item.estimatedLiters,
          date: item.updatedAt,
          owner: item.createdById,
          work: item.work,
          data: {
            vehicle: item.vehicle.plate,
            period: item.period,
            estimatedKm: item.estimatedKm,
            estimatedHours: item.estimatedHours,
            estimatedLiters: item.estimatedLiters,
            basis: item.basis,
          },
        }));
      }
      case "insurance": {
        const items = await this.prisma.insurancePolicy.findMany({
          where: {
            ...(filters.workId ? { workId: filters.workId } : {}),
            ...(search ? { OR: [
              { policyNumber: { contains: search, mode: "insensitive" } },
              { policyType: { contains: search, mode: "insensitive" } },
              { insurer: { name: { contains: search, mode: "insensitive" } } },
              { clientOrPrincipal: { contains: search, mode: "insensitive" } },
            ] } : {}),
            OR: [{ workId: null }, { work: { companyId } }],
          },
          include: {
            insurer: true,
            work: { select: { code: true, name: true } },
            vehicle: { select: { plate: true } },
            machine: { select: { code: true } },
            endorsements: { orderBy: { issueDate: "desc" }, take: 1 },
            payments: { orderBy: { dueDate: "desc" }, take: 5 },
          },
          orderBy: { endDate: "asc" },
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.policyNumber,
          title: `${item.policyType} · ${item.insurer.name}`,
          status: this.policyRecordStatus(item.status, item.endDate),
          amount: item.premiumAmount,
          date: item.endDate,
          owner: item.insurer.name,
          work: item.work,
          data: {
            policyNumber: item.policyNumber,
            policyType: item.policyType,
            insurer: item.insurer.name,
            clientOrPrincipal: item.clientOrPrincipal,
            contractor: item.contractor,
            asset: item.vehicle?.plate ?? item.machine?.code ?? "",
            issueDate: item.issueDate,
            startDate: item.startDate,
            endDate: item.endDate,
            premiumAmount: item.premiumAmount,
            paidAmount: item.paidAmount,
            coverageAmount: item.coverageAmount,
            endorsementNumber: item.endorsements[0]?.number ?? "",
            renewalDate: item.endorsements[0]?.endDate ?? null,
            statusPolicy: item.status,
            receipt: item.payments.find((payment) => payment.receiptNumber)?.receiptNumber ?? "",
            notes: item.notes,
          },
        }));
      }
      case "unexpected-tasks": {
        const items = await this.prisma.unexpectedTask.findMany({
          where: {
            ...(filters.workId ? { workId: filters.workId } : {}),
            ...(search ? { OR: [
              { code: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ] } : {}),
            OR: [{ workId: null }, { work: { companyId } }],
          },
          include: {
            work: { select: { code: true, name: true } },
            assignedUser: { select: { firstName: true, lastName: true, email: true } },
            assignedEmployee: { select: { firstName: true, lastName: true, employeeNumber: true } },
            vehicle: { select: { plate: true } },
            machine: { select: { code: true } },
          },
          orderBy: [{ status: "asc" }, { dueAt: "asc" }, { priority: "desc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.code,
          title: item.title,
          status: item.status,
          amount: item.actualCost,
          date: item.reportedAt,
          owner: item.assignedUser
            ? `${item.assignedUser.firstName} ${item.assignedUser.lastName}`
            : item.assignedEmployee
              ? `${item.assignedEmployee.firstName} ${item.assignedEmployee.lastName}`
              : item.createdById,
          work: item.work,
          data: {
            priority: item.priority,
            source: item.source,
            assignedTo: item.assignedUser?.email ?? item.assignedEmployee?.employeeNumber ?? "",
            location: item.location,
            reportedAt: item.reportedAt,
            dueAt: item.dueAt,
            startedAt: item.startedAt,
            completedAt: item.completedAt,
            vehicleOrMachine: item.vehicle?.plate ?? item.machine?.code ?? "",
            estimatedCost: item.estimatedCost,
            actualCost: item.actualCost,
            evidence: item.description,
            notes: item.notes,
          },
        }));
      }
      default:
        throw new BadRequestException("Módulo operativo no soportado");
    }
  }

  async create(
    companyId: string,
    module: string,
    userId: string,
    dto: CreateRecordDto,
  ) {
    const data = dto.data ?? {};
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    switch (module) {
      case "fleet": {
        const plate = String(data.plate ?? dto.title).trim().toUpperCase();
        const item = await this.prisma.vehicle.create({
          data: {
            plate,
            brand: String(data.brand ?? ""),
            model: String(data.model ?? ""),
            year: this.intValue(data.year),
            odometerKm: this.intValue(data.odometerKm),
            insuranceDue: this.dateValue(data.insuranceDue),
            inspectionDue: this.dateValue(data.inspectionDue),
            workId: dto.workId,
            active: this.booleanValue(data.active, true),
          },
        });
        return { id: item.id, code: item.plate, title: `${item.brand} ${item.model}` };
      }
      case "drivers": {
        const vehicleId = await this.resolveVehicleId(data.vehicle);
        const item = await this.prisma.driver.create({
          data: {
            employeeCode: String(data.employeeCode ?? dto.code),
            fullName: dto.title,
            licenseNumber: String(data.licenseNumber ?? ""),
            licenseCategory: String(data.licenseCategory ?? ""),
            licenseDue: this.requiredDate(data.licenseDue, "Vencimiento de licencia"),
            vehicleId,
            active: this.booleanValue(data.active, true),
          },
        });
        return { id: item.id, code: item.employeeCode, title: item.fullName };
      }
      case "fuel": {
        const assetType = String(data.assetType ?? "").toLowerCase();
        const vehicleId = assetType.includes("veh") ? await this.requireVehicleId(data.asset) : undefined;
        const machineId = assetType.includes("máq") || assetType.includes("maq") ? await this.requireMachineId(data.asset) : undefined;
        if (!vehicleId && !machineId) throw new BadRequestException("Debe seleccionar un vehículo o máquina válido");
        const driverId = await this.resolveDriverId(data.driver);
        const liters = this.numberValue(data.liters);
        const unitPrice = this.numberValue(data.unitPrice);
        const total = data.total === undefined ? liters * unitPrice : this.numberValue(data.total);
        const item = await this.prisma.fuelLog.create({
          data: {
            workId: dto.workId,
            vehicleId,
            machineId,
            driverId,
            filledAt: this.requiredDate(data.filledAt ?? dto.occurredAt, "Fecha de carga"),
            liters,
            unitPrice,
            total,
            odometerKm: data.odometerKm === undefined ? undefined : this.intValue(data.odometerKm),
            hourMeter: data.hourMeter === undefined ? undefined : this.numberValue(data.hourMeter),
            supplier: this.stringValue(data.supplier),
            costCenter: this.stringValue(data.costCenter),
            createdById: userId,
          },
        });
        if (vehicleId && data.odometerKm !== undefined) {
          const km = this.intValue(data.odometerKm);
          await this.prisma.vehicle.updateMany({
            where: { id: vehicleId, odometerKm: { lt: km } },
            data: { odometerKm: km },
          });
        }
        if (machineId && data.hourMeter !== undefined) {
          const hours = this.numberValue(data.hourMeter);
          const machine = await this.prisma.machine.findUnique({ where: { id: machineId }, select: { hourMeter: true } });
          if (machine && hours > Number(machine.hourMeter)) {
            await this.prisma.machine.update({ where: { id: machineId }, data: { hourMeter: hours } });
          }
        }
        return { id: item.id, code: dto.code, title: dto.title };
      }
      case "machinery": {
        const item = await this.prisma.machine.create({
          data: {
            code: dto.code,
            equipmentType: String(data.equipmentType ?? dto.title),
            brand: String(data.brand ?? ""),
            model: String(data.model ?? ""),
            hourMeter: this.numberValue(data.hourMeter),
            workId: dto.workId,
            operatorName: this.stringValue(data.operator),
            hourlyCost: this.numberValue(data.hourlyCost),
            active: true,
          },
        });
        return { id: item.id, code: item.code, title: `${item.equipmentType} · ${item.brand} ${item.model}` };
      }
      case "maintenance": {
        const asset = await this.resolveAsset(data.asset);
        const mechanicId = await this.resolveMechanicId(data.mechanic);
        const item = await this.prisma.maintenanceOrder.create({
          data: {
            number: dto.code,
            type: String(data.maintenanceType ?? "Preventivo"),
            vehicleId: asset.vehicleId,
            machineId: asset.machineId,
            workId: dto.workId,
            mechanicId,
            description: String(data.description ?? dto.title),
            status: dto.status ?? RecordStatus.PENDING,
            priority: String(data.priority ?? "NORMAL").toUpperCase(),
            scheduledAt: this.dateValue(data.scheduledAt ?? dto.occurredAt),
            completedAt: this.dateValue(data.completedAt),
            odometerKm: data.odometerKm === undefined ? undefined : this.intValue(data.odometerKm),
            hourMeter: data.hourMeter === undefined ? undefined : this.numberValue(data.hourMeter),
            partsCost: this.numberValue(data.partsCost),
            laborCost: this.numberValue(data.laborCost),
            nextServiceAt: this.dateValue(data.nextServiceAt),
            notes: [this.stringValue(data.parts), this.stringValue(data.notes)].filter(Boolean).join(" · ") || undefined,
          },
        });
        return { id: item.id, code: item.number, title: item.description };
      }
      case "mechanics": {
        const employeeId = await this.resolveEmployeeId(data.employeeNumber);
        const item = await this.prisma.mechanic.create({
          data: {
            employeeId,
            fullName: String(data.fullName ?? dto.title),
            specialty: this.stringValue(data.specialty),
            phone: this.stringValue(data.phone),
            email: this.stringValue(data.email),
            active: this.booleanValue(data.active, true),
            notes: this.stringValue(data.notes),
          },
        });
        return { id: item.id, code: dto.code, title: item.fullName };
      }
      case "spare-parts": {
        const item = await this.prisma.sparePart.create({
          data: {
            sku: String(data.sku ?? dto.code),
            description: String(data.description ?? dto.title),
            brand: this.stringValue(data.brand),
            unit: String(data.unit ?? "u"),
            currentStock: this.numberValue(data.currentStock),
            minimumStock: this.numberValue(data.minimumStock),
            averageCost: this.numberValue(data.averageCost),
            location: this.stringValue(data.location),
            active: this.booleanValue(data.active, true),
          },
        });
        return { id: item.id, code: item.sku, title: item.description };
      }
      case "fuel-estimates": {
        const vehicleId = await this.requireVehicleId(data.vehicle);
        if (!dto.workId) throw new BadRequestException("La estimación debe imputarse a una obra");
        const item = await this.prisma.fuelEstimate.create({
          data: {
            vehicleId,
            workId: dto.workId,
            period: String(data.period ?? ""),
            estimatedLiters: this.numberValue(data.estimatedLiters),
            estimatedKm: data.estimatedKm === undefined ? undefined : this.intValue(data.estimatedKm),
            estimatedHours: data.estimatedHours === undefined ? undefined : this.numberValue(data.estimatedHours),
            basis: this.stringValue(data.basis),
            status: dto.status ?? RecordStatus.DRAFT,
            createdById: userId,
            approvedById: dto.status === RecordStatus.APPROVED ? userId : undefined,
          },
        });
        return { id: item.id, code: dto.code, title: dto.title };
      }
      case "insurance": {
        const insurerName = String(data.insurer ?? "").trim();
        if (!insurerName) throw new BadRequestException("Debe indicar la compañía emisora");
        const insurer = await this.prisma.insuranceCompany.upsert({
          where: { name: insurerName },
          update: { active: true },
          create: { name: insurerName },
        });
        const asset = await this.resolveAsset(data.asset);
        const item = await this.prisma.insurancePolicy.create({
          data: {
            policyNumber: String(data.policyNumber ?? dto.code),
            policyType: String(data.policyType ?? dto.title),
            insurerId: insurer.id,
            workId: dto.workId,
            vehicleId: asset.vehicleId,
            machineId: asset.machineId,
            contractor: this.stringValue(data.contractor),
            clientOrPrincipal: this.stringValue(data.clientOrPrincipal),
            issueDate: this.requiredDate(data.issueDate ?? dto.occurredAt, "Fecha de emisión"),
            startDate: this.requiredDate(data.startDate, "Inicio de vigencia"),
            endDate: this.requiredDate(data.endDate, "Fin de vigencia"),
            status: this.normalizePolicyStatus(data.statusPolicy),
            premiumAmount: this.numberValue(data.premiumAmount),
            paidAmount: this.numberValue(data.paidAmount),
            coverageAmount: data.coverageAmount === undefined ? undefined : this.numberValue(data.coverageAmount),
            coverageDetail: this.stringValue(data.coverageDetail),
            notes: [this.stringValue(data.actReference), this.stringValue(data.notes)].filter(Boolean).join(" · ") || undefined,
          },
        });
        const endorsement = this.stringValue(data.endorsementNumber);
        if (endorsement) {
          await this.prisma.insuranceEndorsement.create({
            data: {
              policyId: item.id,
              number: endorsement,
              endorsementType: "ALTA / ACTUALIZACIÓN",
              issueDate: item.issueDate,
              effectiveDate: item.startDate,
              endDate: this.dateValue(data.renewalDate),
              description: "Endoso registrado desde alta de póliza",
            },
          });
        }
        const paid = this.numberValue(data.paidAmount);
        const receipt = this.stringValue(data.receipt);
        if (paid > 0 || receipt) {
          await this.prisma.insurancePayment.create({
            data: {
              policyId: item.id,
              dueDate: item.startDate,
              paidAt: paid > 0 ? new Date() : undefined,
              amount: paid,
              receiptNumber: receipt,
              status: paid > 0 ? "PAID" : "PENDING",
            },
          });
        }
        return { id: item.id, code: item.policyNumber, title: dto.title };
      }
      case "unexpected-tasks": {
        const assignment = await this.resolveAssignment(data.assignedTo);
        const asset = await this.resolveAsset(data.vehicleOrMachine);
        const item = await this.prisma.unexpectedTask.create({
          data: {
            code: dto.code,
            title: dto.title,
            description: String(data.evidence ?? data.notes ?? dto.title),
            priority: String(data.priority ?? "NORMAL").toUpperCase(),
            status: dto.status ?? RecordStatus.PENDING,
            source: this.stringValue(data.source),
            workId: dto.workId,
            assignedUserId: assignment.userId,
            assignedEmployeeId: assignment.employeeId,
            vehicleId: asset.vehicleId,
            machineId: asset.machineId,
            location: this.stringValue(data.location),
            reportedAt: this.dateValue(data.reportedAt ?? dto.occurredAt) ?? new Date(),
            dueAt: this.dateValue(data.dueAt),
            startedAt: this.dateValue(data.startedAt),
            completedAt: this.dateValue(data.completedAt),
            estimatedCost: this.numberValue(data.estimatedCost),
            actualCost: this.numberValue(data.actualCost),
            createdById: userId,
            notes: this.stringValue(data.notes),
          },
        });
        if (item.assignedUserId) {
          await this.prisma.notification.create({
            data: {
              userId: item.assignedUserId,
              type: "UNEXPECTED_TASK_ASSIGNED",
              title: "Trabajo imprevisto asignado",
              message: `${item.code} · ${item.title}`,
              severity: item.priority === "CRITICAL" ? "CRITICAL" : item.priority === "HIGH" ? "HIGH" : "INFO",
              module: "unexpected-tasks",
              entityType: "UnexpectedTask",
              entityId: item.id,
              actionUrl: "/unexpected-tasks",
            },
          });
        }
        return { id: item.id, code: item.code, title: item.title };
      }
      default:
        throw new BadRequestException("Módulo operativo no soportado");
    }
  }

  async update(companyId: string, module: string, id: string, dto: UpdateRecordDto) {
    const data = dto.data ?? {};
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    switch (module) {
      case "fleet": {
        const current = await this.prisma.vehicle.findFirst({ where: { id, OR: [{ workId: null }, { work: { companyId } }] } });
        if (!current) throw new NotFoundException("Vehículo no encontrado");
        return this.prisma.vehicle.update({
          where: { id },
          data: {
            plate: data.plate === undefined ? undefined : String(data.plate).toUpperCase(),
            brand: data.brand === undefined ? undefined : String(data.brand),
            model: data.model === undefined ? undefined : String(data.model),
            year: data.year === undefined ? undefined : this.intValue(data.year),
            odometerKm: data.odometerKm === undefined ? undefined : this.intValue(data.odometerKm),
            insuranceDue: data.insuranceDue === undefined ? undefined : this.dateValue(data.insuranceDue),
            inspectionDue: data.inspectionDue === undefined ? undefined : this.dateValue(data.inspectionDue),
            workId: dto.workId,
            active: data.active === undefined ? undefined : this.booleanValue(data.active, true),
          },
        });
      }
      case "drivers": {
        const current = await this.prisma.driver.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Chofer no encontrado");
        return this.prisma.driver.update({
          where: { id },
          data: {
            fullName: dto.title,
            employeeCode: data.employeeCode === undefined ? undefined : String(data.employeeCode),
            licenseNumber: data.licenseNumber === undefined ? undefined : String(data.licenseNumber),
            licenseCategory: data.licenseCategory === undefined ? undefined : String(data.licenseCategory),
            licenseDue: data.licenseDue === undefined ? undefined : this.dateValue(data.licenseDue),
            vehicleId: data.vehicle === undefined ? undefined : await this.resolveVehicleId(data.vehicle),
            active: data.active === undefined ? undefined : this.booleanValue(data.active, true),
          },
        });
      }
      case "fuel": {
        const current = await this.prisma.fuelLog.findFirst({ where: { id, voidedAt: null, OR: [{ workId: null }, { work: { companyId } }] } });
        if (!current) throw new NotFoundException("Carga de combustible no encontrada");
        const asset = data.asset === undefined ? {} : await this.resolveAsset(data.asset);
        const liters = data.liters === undefined ? Number(current.liters) : this.numberValue(data.liters);
        const unitPrice = data.unitPrice === undefined ? Number(current.unitPrice) : this.numberValue(data.unitPrice);
        return this.prisma.fuelLog.update({
          where: { id },
          data: {
            workId: dto.workId,
            vehicleId: asset.vehicleId,
            machineId: asset.machineId,
            driverId: data.driver === undefined ? undefined : await this.resolveDriverId(data.driver),
            filledAt: data.filledAt === undefined ? undefined : this.dateValue(data.filledAt),
            liters,
            unitPrice,
            total: data.total === undefined ? liters * unitPrice : this.numberValue(data.total),
            odometerKm: data.odometerKm === undefined ? undefined : this.intValue(data.odometerKm),
            hourMeter: data.hourMeter === undefined ? undefined : this.numberValue(data.hourMeter),
            supplier: data.supplier === undefined ? undefined : this.stringValue(data.supplier),
            costCenter: data.costCenter === undefined ? undefined : this.stringValue(data.costCenter),
          },
        });
      }
      case "machinery": {
        const current = await this.prisma.machine.findFirst({ where: { id, OR: [{ workId: null }, { work: { companyId } }] } });
        if (!current) throw new NotFoundException("Máquina no encontrada");
        return this.prisma.machine.update({
          where: { id },
          data: {
            equipmentType: data.equipmentType === undefined ? undefined : String(data.equipmentType),
            brand: data.brand === undefined ? undefined : String(data.brand),
            model: data.model === undefined ? undefined : String(data.model),
            hourMeter: data.hourMeter === undefined ? undefined : this.numberValue(data.hourMeter),
            workId: dto.workId,
            operatorName: data.operator === undefined ? undefined : this.stringValue(data.operator),
            hourlyCost: data.hourlyCost === undefined ? undefined : this.numberValue(data.hourlyCost),
          },
        });
      }
      case "maintenance": {
        const current = await this.prisma.maintenanceOrder.findFirst({ where: { id, OR: [{ workId: null }, { work: { companyId } }] } });
        if (!current) throw new NotFoundException("Orden de mantenimiento no encontrada");
        const asset = data.asset === undefined ? {} : await this.resolveAsset(data.asset);
        return this.prisma.maintenanceOrder.update({
          where: { id },
          data: {
            type: data.maintenanceType === undefined ? undefined : String(data.maintenanceType),
            vehicleId: asset.vehicleId,
            machineId: asset.machineId,
            workId: dto.workId,
            mechanicId: data.mechanic === undefined ? undefined : await this.resolveMechanicId(data.mechanic),
            description: dto.title ?? (data.description === undefined ? undefined : String(data.description)),
            status: dto.status,
            priority: data.priority === undefined ? undefined : String(data.priority).toUpperCase(),
            scheduledAt: data.scheduledAt === undefined ? undefined : this.dateValue(data.scheduledAt),
            completedAt: data.completedAt === undefined ? undefined : this.dateValue(data.completedAt),
            odometerKm: data.odometerKm === undefined ? undefined : this.intValue(data.odometerKm),
            hourMeter: data.hourMeter === undefined ? undefined : this.numberValue(data.hourMeter),
            partsCost: data.partsCost === undefined ? undefined : this.numberValue(data.partsCost),
            laborCost: data.laborCost === undefined ? undefined : this.numberValue(data.laborCost),
            nextServiceAt: data.nextServiceAt === undefined ? undefined : this.dateValue(data.nextServiceAt),
            notes: data.notes === undefined ? undefined : this.stringValue(data.notes),
          },
        });
      }
      case "mechanics": {
        const current = await this.prisma.mechanic.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Mecánico no encontrado");
        return this.prisma.mechanic.update({
          where: { id },
          data: {
            fullName: dto.title ?? (data.fullName === undefined ? undefined : String(data.fullName)),
            employeeId: data.employeeNumber === undefined ? undefined : await this.resolveEmployeeId(data.employeeNumber),
            specialty: data.specialty === undefined ? undefined : this.stringValue(data.specialty),
            phone: data.phone === undefined ? undefined : this.stringValue(data.phone),
            email: data.email === undefined ? undefined : this.stringValue(data.email),
            active: data.active === undefined ? undefined : this.booleanValue(data.active, true),
            notes: data.notes === undefined ? undefined : this.stringValue(data.notes),
          },
        });
      }
      case "spare-parts": {
        const current = await this.prisma.sparePart.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Repuesto no encontrado");
        return this.prisma.sparePart.update({
          where: { id },
          data: {
            sku: data.sku === undefined ? undefined : String(data.sku),
            description: dto.title ?? (data.description === undefined ? undefined : String(data.description)),
            brand: data.brand === undefined ? undefined : this.stringValue(data.brand),
            unit: data.unit === undefined ? undefined : String(data.unit),
            currentStock: data.currentStock === undefined ? undefined : this.numberValue(data.currentStock),
            minimumStock: data.minimumStock === undefined ? undefined : this.numberValue(data.minimumStock),
            averageCost: data.averageCost === undefined ? undefined : this.numberValue(data.averageCost),
            location: data.location === undefined ? undefined : this.stringValue(data.location),
            active: data.active === undefined ? undefined : this.booleanValue(data.active, true),
          },
        });
      }
      case "fuel-estimates": {
        const current = await this.prisma.fuelEstimate.findFirst({ where: { id, OR: [{ workId: null }, { work: { companyId } }] } });
        if (!current) throw new NotFoundException("Estimación no encontrada");
        return this.prisma.fuelEstimate.update({
          where: { id },
          data: {
            vehicleId: data.vehicle === undefined ? undefined : await this.requireVehicleId(data.vehicle),
            workId: dto.workId,
            period: data.period === undefined ? undefined : String(data.period),
            estimatedLiters: data.estimatedLiters === undefined ? undefined : this.numberValue(data.estimatedLiters),
            estimatedKm: data.estimatedKm === undefined ? undefined : this.intValue(data.estimatedKm),
            estimatedHours: data.estimatedHours === undefined ? undefined : this.numberValue(data.estimatedHours),
            basis: data.basis === undefined ? undefined : this.stringValue(data.basis),
            status: dto.status,
          },
        });
      }
      case "insurance": {
        const current = await this.prisma.insurancePolicy.findFirst({ where: { id, OR: [{ workId: null }, { work: { companyId } }] } });
        if (!current) throw new NotFoundException("Póliza no encontrada");
        let insurerId: string | undefined;
        if (data.insurer !== undefined) {
          const insurer = await this.prisma.insuranceCompany.upsert({
            where: { name: String(data.insurer) },
            update: { active: true },
            create: { name: String(data.insurer) },
          });
          insurerId = insurer.id;
        }
        const asset = data.asset === undefined ? {} : await this.resolveAsset(data.asset);
        return this.prisma.insurancePolicy.update({
          where: { id },
          data: {
            policyNumber: data.policyNumber === undefined ? undefined : String(data.policyNumber),
            policyType: data.policyType === undefined ? undefined : String(data.policyType),
            insurerId,
            workId: dto.workId,
            vehicleId: asset.vehicleId,
            machineId: asset.machineId,
            contractor: data.contractor === undefined ? undefined : this.stringValue(data.contractor),
            clientOrPrincipal: data.clientOrPrincipal === undefined ? undefined : this.stringValue(data.clientOrPrincipal),
            issueDate: data.issueDate === undefined ? undefined : this.dateValue(data.issueDate),
            startDate: data.startDate === undefined ? undefined : this.dateValue(data.startDate),
            endDate: data.endDate === undefined ? undefined : this.dateValue(data.endDate),
            status: data.statusPolicy === undefined ? undefined : this.normalizePolicyStatus(data.statusPolicy),
            premiumAmount: data.premiumAmount === undefined ? undefined : this.numberValue(data.premiumAmount),
            paidAmount: data.paidAmount === undefined ? undefined : this.numberValue(data.paidAmount),
            coverageAmount: data.coverageAmount === undefined ? undefined : this.numberValue(data.coverageAmount),
            notes: data.notes === undefined ? undefined : this.stringValue(data.notes),
          },
        });
      }
      case "unexpected-tasks": {
        const current = await this.prisma.unexpectedTask.findFirst({ where: { id, OR: [{ workId: null }, { work: { companyId } }] } });
        if (!current) throw new NotFoundException("Trabajo imprevisto no encontrado");
        const assignment = data.assignedTo === undefined ? {} : await this.resolveAssignment(data.assignedTo);
        const asset = data.vehicleOrMachine === undefined ? {} : await this.resolveAsset(data.vehicleOrMachine);
        return this.prisma.unexpectedTask.update({
          where: { id },
          data: {
            title: dto.title,
            priority: data.priority === undefined ? undefined : String(data.priority).toUpperCase(),
            status: dto.status,
            source: data.source === undefined ? undefined : this.stringValue(data.source),
            workId: dto.workId,
            assignedUserId: assignment.userId,
            assignedEmployeeId: assignment.employeeId,
            vehicleId: asset.vehicleId,
            machineId: asset.machineId,
            location: data.location === undefined ? undefined : this.stringValue(data.location),
            reportedAt: data.reportedAt === undefined ? undefined : this.dateValue(data.reportedAt),
            dueAt: data.dueAt === undefined ? undefined : this.dateValue(data.dueAt),
            startedAt: data.startedAt === undefined ? undefined : this.dateValue(data.startedAt),
            completedAt: data.completedAt === undefined ? undefined : this.dateValue(data.completedAt),
            estimatedCost: data.estimatedCost === undefined ? undefined : this.numberValue(data.estimatedCost),
            actualCost: data.actualCost === undefined ? undefined : this.numberValue(data.actualCost),
            description: data.evidence === undefined ? undefined : String(data.evidence),
            notes: data.notes === undefined ? undefined : this.stringValue(data.notes),
          },
        });
      }
      default:
        throw new BadRequestException("Módulo operativo no soportado");
    }
  }

  async softDelete(companyId: string, module: string, id: string, userId: string) {
    switch (module) {
      case "fleet":
        return this.prisma.vehicle.update({ where: { id }, data: { active: false } });
      case "drivers":
        return this.prisma.driver.update({ where: { id }, data: { active: false } });
      case "fuel": {
        const current = await this.prisma.fuelLog.findFirst({ where: { id, voidedAt: null, OR: [{ workId: null }, { work: { companyId } }] } });
        if (!current) throw new NotFoundException("Carga de combustible no encontrada");
        return this.prisma.fuelLog.update({
          where: { id },
          data: { voidedAt: new Date(), voidedById: userId, voidReason: "Baja lógica desde ERP" },
        });
      }
      case "machinery":
        return this.prisma.machine.update({ where: { id }, data: { active: false } });
      case "maintenance":
        return this.prisma.maintenanceOrder.update({ where: { id }, data: { status: RecordStatus.VOID } });
      case "mechanics":
        return this.prisma.mechanic.update({ where: { id }, data: { active: false } });
      case "spare-parts":
        return this.prisma.sparePart.update({ where: { id }, data: { active: false } });
      case "fuel-estimates":
        return this.prisma.fuelEstimate.update({ where: { id }, data: { status: RecordStatus.VOID } });
      case "insurance":
        return this.prisma.insurancePolicy.update({
          where: { id },
          data: { status: "VOID", cancellationDate: new Date(), cancellationReason: "Baja lógica desde ERP" },
        });
      case "unexpected-tasks":
        return this.prisma.unexpectedTask.update({ where: { id }, data: { status: RecordStatus.VOID } });
      default:
        throw new BadRequestException("Módulo operativo no soportado");
    }
  }

  private row(input: {
    id: string;
    code: string;
    title: string;
    status: RecordStatus;
    amount: unknown;
    date: Date | null | undefined;
    owner: string;
    work: { code: string; name?: string } | null | undefined;
    data: Record<string, unknown>;
  }) {
    return {
      id: input.id,
      code: input.code,
      title: input.title,
      status: input.status,
      amount: input.amount,
      occurredAt: input.date,
      updatedAt: input.date ?? new Date(0),
      createdById: input.owner,
      work: input.work,
      data: input.data,
    };
  }

  private async requireWork(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({ where: { id: workId, companyId, deletedAt: null }, select: { id: true } });
    if (!work) throw new NotFoundException("Obra no encontrada");
  }

  private async resolveVehicleId(value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) return undefined;
    const item = await this.prisma.vehicle.findFirst({
      where: { active: true, OR: [
        { id: raw },
        { plate: { equals: raw, mode: "insensitive" } },
        { plate: { contains: raw, mode: "insensitive" } },
      ] },
      select: { id: true },
    });
    return item?.id;
  }

  private async requireVehicleId(value: unknown) {
    const id = await this.resolveVehicleId(value);
    if (!id) throw new NotFoundException("Vehículo no encontrado");
    return id;
  }

  private async resolveMachineId(value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) return undefined;
    const item = await this.prisma.machine.findFirst({
      where: { active: true, OR: [
        { id: raw },
        { code: { equals: raw, mode: "insensitive" } },
        { code: { contains: raw, mode: "insensitive" } },
      ] },
      select: { id: true },
    });
    return item?.id;
  }

  private async requireMachineId(value: unknown) {
    const id = await this.resolveMachineId(value);
    if (!id) throw new NotFoundException("Máquina no encontrada");
    return id;
  }

  private async resolveAsset(value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) return {} as { vehicleId?: string; machineId?: string };
    const vehicleId = await this.resolveVehicleId(raw);
    if (vehicleId) return { vehicleId };
    const machineId = await this.resolveMachineId(raw);
    if (machineId) return { machineId };
    return {} as { vehicleId?: string; machineId?: string };
  }

  private async resolveDriverId(value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) return undefined;
    const item = await this.prisma.driver.findFirst({
      where: { active: true, OR: [
        { id: raw },
        { employeeCode: { equals: raw, mode: "insensitive" } },
        { fullName: { contains: raw, mode: "insensitive" } },
      ] },
      select: { id: true },
    });
    return item?.id;
  }

  private async resolveMechanicId(value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) return undefined;
    const item = await this.prisma.mechanic.findFirst({
      where: { active: true, OR: [
        { id: raw },
        { fullName: { contains: raw, mode: "insensitive" } },
      ] },
      select: { id: true },
    });
    return item?.id;
  }

  private async resolveEmployeeId(value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) return undefined;
    const item = await this.prisma.employee.findFirst({
      where: { active: true, OR: [
        { id: raw },
        { employeeNumber: { equals: raw, mode: "insensitive" } },
        { firstName: { contains: raw, mode: "insensitive" } },
        { lastName: { contains: raw, mode: "insensitive" } },
      ] },
      select: { id: true },
    });
    return item?.id;
  }

  private async resolveAssignment(value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) return {} as { userId?: string; employeeId?: string };
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: raw },
          { email: { equals: raw, mode: "insensitive" } },
          { username: { equals: raw, mode: "insensitive" } },
          { firstName: { contains: raw, mode: "insensitive" } },
          { lastName: { contains: raw, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (user) return { userId: user.id };
    const employeeId = await this.resolveEmployeeId(raw);
    return employeeId ? { employeeId } : {};
  }

  private numberValue(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private intValue(value: unknown) {
    return Math.trunc(this.numberValue(value));
  }

  private stringValue(value: unknown) {
    if (value === undefined || value === null || value === "") return undefined;
    return String(value).trim();
  }

  private dateValue(value: unknown) {
    if (!value) return undefined;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private requiredDate(value: unknown, label: string) {
    const date = this.dateValue(value);
    if (!date) throw new BadRequestException(`${label} inválida`);
    return date;
  }

  private booleanValue(value: unknown, fallback = false) {
    if (typeof value === "boolean") return value;
    if (value === undefined || value === null || value === "") return fallback;
    const normalized = String(value).trim().toLowerCase();
    return ["sí", "si", "true", "1", "activo", "active"].includes(normalized);
  }

  private normalizePolicyStatus(value: unknown) {
    const normalized = String(value ?? "ACTIVE").trim().toLowerCase();
    if (normalized.includes("venc")) return "EXPIRED";
    if (normalized.includes("renov")) return "RENEWED";
    if (normalized.includes("anul") || normalized.includes("baja")) return "VOID";
    if (normalized.includes("pend")) return "PENDING";
    return "ACTIVE";
  }

  private policyRecordStatus(status: string, endDate: Date) {
    if (status === "VOID") return RecordStatus.VOID;
    if (status === "PENDING") return RecordStatus.PENDING;
    if (status === "RENEWED") return RecordStatus.CLOSED;
    if (status === "EXPIRED" || endDate < new Date()) return RecordStatus.PENDING;
    return RecordStatus.ACTIVE;
  }
}
