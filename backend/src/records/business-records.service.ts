import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MovementDirection, Prisma, RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateRecordDto } from "./dto/create-record.dto";
import type { UpdateRecordDto } from "./dto/update-record.dto";

const businessModules = new Set([
  "purchases",
  "suppliers",
  "stock",
  "cash",
  "banks",
  "payments",
  "accounting",
  "taxes",
]);

@Injectable()
export class BusinessRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  handles(module: string) {
    return businessModules.has(module);
  }

  async list(
    companyId: string,
    module: string,
    filters: { workId?: string; status?: RecordStatus; search?: string },
  ) {
    const search = filters.search?.trim().slice(0, 120);
    switch (module) {
      case "purchases": {
        const items = await this.prisma.purchaseOrder.findMany({
          where: {
            deletedAt: null,
            ...(filters.workId ? { workId: filters.workId } : {}),
            AND: [
              { OR: [{ workId: null }, { work: { companyId } }] },
              ...(search ? [{ OR: [
                { number: { contains: search, mode: "insensitive" as const } },
                { supplier: { organization: { legalName: { contains: search, mode: "insensitive" as const } } } },
                { invoiceNumber: { contains: search, mode: "insensitive" as const } },
              ] }] : []),
            ],
          },
          include: {
            work: { select: { code: true, name: true } },
            supplier: { include: { organization: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.number,
          title: item.supplier.organization.legalName,
          status: item.status,
          amount: item.total,
          date: item.createdAt,
          owner: item.requestedById,
          work: item.work,
          data: {
            requestNumber: (item.metadata as Record<string, unknown>)?.requestNumber ?? "",
            supplier: item.supplier.organization.legalName,
            quotationCount: (item.metadata as Record<string, unknown>)?.quotationCount ?? 0,
            comparisonResult: (item.metadata as Record<string, unknown>)?.comparisonResult ?? "",
            purchaseOrder: item.number,
            deliveryNote: (item.metadata as Record<string, unknown>)?.deliveryNote ?? "",
            invoice: item.invoiceNumber,
            costCenter: item.costCenter,
            subtotal: item.subtotal,
            vat: item.vat,
            total: item.total,
            expectedAt: item.expectedAt,
            receivedAt: item.receivedAt,
            paymentStatus: (item.metadata as Record<string, unknown>)?.paymentStatus ?? "Pendiente",
          },
        }));
      }
      case "suppliers": {
        const items = await this.prisma.supplier.findMany({
          where: {
            active: true,
            ...(search ? { organization: { OR: [
              { legalName: { contains: search, mode: "insensitive" } },
              { taxId: { contains: search, mode: "insensitive" } },
            ] } } : {}),
          },
          include: { organization: true },
          orderBy: { organization: { legalName: "asc" } },
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.organization.taxId ?? `PRO-${item.id.slice(-8).toUpperCase()}`,
          title: item.organization.legalName,
          status: item.active ? RecordStatus.ACTIVE : RecordStatus.VOID,
          amount: item.accountBalance,
          date: item.organization.updatedAt,
          owner: "suppliers",
          work: null,
          data: {
            taxId: item.organization.taxId,
            vatCondition: item.organization.vatCondition,
            contact: (item.organization.metadata as Record<string, unknown>)?.contact ?? "",
            email: item.organization.email,
            phone: item.organization.phone,
            address: item.organization.address,
            cbu: item.organization.bankAccount,
            accountBalance: item.accountBalance,
            documentationDue: (item.organization.metadata as Record<string, unknown>)?.documentationDue ?? null,
          },
        }));
      }
      case "stock": {
        const items = await this.prisma.stockItem.findMany({
          where: {
            active: true,
            ...(search ? { OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { warehouse: { name: { contains: search, mode: "insensitive" } } },
            ] } : {}),
          },
          include: { warehouse: true },
          orderBy: [{ warehouse: { name: "asc" } }, { description: "asc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: item.sku,
          title: item.description,
          status: item.active ? RecordStatus.ACTIVE : RecordStatus.VOID,
          amount: Number(item.currentStock) * Number(item.averageCost),
          date: null,
          owner: item.warehouse.name,
          work: null,
          data: {
            sku: item.sku,
            unit: item.unit,
            warehouse: item.warehouse.name,
            currentStock: item.currentStock,
            minimumStock: item.minimumStock,
            unitCost: item.averageCost,
            totalCost: Number(item.currentStock) * Number(item.averageCost),
            movement: "Ajuste",
            quantity: 0,
          },
        }));
      }
      case "cash":
      case "banks":
      case "payments": {
        const typeFilter =
          module === "cash"
            ? { cashBoxId: { not: null } }
            : module === "banks"
              ? { bankAccountId: { not: null } }
              : {};
        const items = await this.prisma.financialMovement.findMany({
          where: {
            deletedAt: null,
            ...typeFilter,
            ...(filters.workId ? { workId: filters.workId } : {}),
            AND: [
              { OR: [{ workId: null }, { work: { companyId } }] },
              ...(search ? [{ OR: [
                { concept: { contains: search, mode: "insensitive" as const } },
                { counterparty: { contains: search, mode: "insensitive" as const } },
                { reference: { contains: search, mode: "insensitive" as const } },
              ] }] : []),
            ],
          },
          include: {
            work: { select: { code: true, name: true } },
            cashBox: true,
            bankAccount: true,
          },
          orderBy: { occurredAt: "desc" },
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: `${module.slice(0, 3).toUpperCase()}-${item.id.slice(-8).toUpperCase()}`,
          title: item.concept,
          status: RecordStatus.ACTIVE,
          amount: item.amount,
          date: item.occurredAt,
          owner: item.createdById,
          work: item.work,
          data: module === "cash" ? {
            cashBox: item.cashBox?.name ?? "",
            direction: item.direction === MovementDirection.IN ? "Ingreso" : "Egreso",
            beneficiary: item.counterparty,
            concept: item.concept,
            amount: item.amount,
            receipt: item.reference,
            accounted: "No",
          } : module === "banks" ? {
            bank: item.bankAccount?.bankName ?? "",
            account: item.bankAccount?.accountNumber ?? "",
            movementType: item.type,
            counterparty: item.counterparty,
            reference: item.reference,
            amount: item.amount,
            bankBalance: item.bankAccount?.bankBalance ?? 0,
            accountingBalance: item.bankAccount?.accountingBalance ?? 0,
            reconciled: "No",
            projectedAt: item.occurredAt,
          } : {
            operation: item.direction === MovementDirection.OUT ? "Pago a proveedor" : "Cobro de cliente",
            counterparty: item.counterparty,
            account: item.bankAccount?.accountNumber ?? item.cashBox?.name ?? "",
            receiptType: item.type,
            receiptNumber: item.reference,
            amount: item.amount,
            withholding: 0,
            paymentMethod: item.bankAccountId ? "Transferencia" : "Efectivo",
            allocation: item.concept,
          },
        }));
      }
      case "accounting": {
        const items = await this.prisma.journalEntry.findMany({
          where: {
            ...(search ? { OR: [
              { description: { contains: search, mode: "insensitive" } },
              { sourceModule: { contains: search, mode: "insensitive" } },
            ] } : {}),
          },
          include: {
            lines: {
              include: {
                account: true,
                work: { select: { code: true, name: true } },
              },
              orderBy: { debit: "desc" },
            },
          },
          orderBy: { entryDate: "desc" },
          take: 100,
        });
        return items.map((item) => {
          const debitLine = item.lines.find((line) => Number(line.debit) > 0);
          const creditLine = item.lines.find((line) => Number(line.credit) > 0);
          const totalDebit = item.lines.reduce((sum, line) => sum + Number(line.debit), 0);
          return this.row({
            id: item.id,
            code: `ASI-${String(item.number).padStart(6, "0")}`,
            title: item.description,
            status: item.status,
            amount: totalDebit,
            date: item.entryDate,
            owner: item.createdById,
            work: debitLine?.work ?? creditLine?.work ?? null,
            data: {
              entryNumber: item.number,
              entryDate: item.entryDate,
              sourceModule: item.sourceModule,
              accountDebit: debitLine ? `${debitLine.account.code} · ${debitLine.account.name}` : "",
              debit: debitLine?.debit ?? 0,
              accountCredit: creditLine ? `${creditLine.account.code} · ${creditLine.account.name}` : "",
              credit: creditLine?.credit ?? 0,
              costCenter: debitLine?.work?.code ?? creditLine?.work?.code ?? "",
              period: item.entryDate.toISOString().slice(0, 7),
              closingType: "Sin cierre",
              posted: item.postedAt ? "Sí" : "No",
            },
          });
        });
      }
      case "taxes": {
        const items = await this.prisma.taxEstimate.findMany({
          where: search ? { OR: [
            { taxType: { contains: search, mode: "insensitive" } },
            { period: { contains: search, mode: "insensitive" } },
          ] } : {},
          orderBy: [{ period: "desc" }, { taxType: "asc" }],
          take: 100,
        });
        return items.map((item) => this.row({
          id: item.id,
          code: `IMP-${item.taxType.replace(/\s+/g, "-").toUpperCase()}-${item.period}`,
          title: `${item.taxType} · ${item.period}`,
          status: item.status,
          amount: item.estimatedDue,
          date: item.dueDate,
          owner: "taxes",
          work: null,
          data: {
            taxType: item.taxType,
            period: item.period,
            debitAmount: item.debitAmount,
            creditAmount: item.creditAmount,
            withholdings: item.withholdings,
            perceptions: item.perceptions,
            technicalBalance: (item.metadata as Record<string, unknown>)?.technicalBalance ?? 0,
            estimatedDue: item.estimatedDue,
            dueDate: item.dueDate,
            returnNumber: (item.metadata as Record<string, unknown>)?.returnNumber ?? "",
            filed: (item.metadata as Record<string, unknown>)?.filed ? "Sí" : "No",
          },
        }));
      }
      default:
        throw new BadRequestException("Módulo empresarial no soportado");
    }
  }

  async create(companyId: string, module: string, userId: string, dto: CreateRecordDto) {
    const data = dto.data ?? {};
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    switch (module) {
      case "purchases": {
        const supplier = await this.requireSupplier(data.supplier);
        const item = await this.prisma.purchaseOrder.create({
          data: {
            number: String(data.purchaseOrder ?? dto.code),
            workId: dto.workId,
            supplierId: supplier.id,
            costCenter: this.stringValue(data.costCenter),
            requestedById: userId,
            approvedById: dto.status === RecordStatus.APPROVED ? userId : undefined,
            status: dto.status ?? RecordStatus.PENDING,
            subtotal: this.numberValue(data.subtotal),
            vat: this.numberValue(data.vat),
            total: this.numberValue(data.total),
            expectedAt: this.dateValue(data.expectedAt),
            receivedAt: this.dateValue(data.receivedAt),
            invoiceNumber: this.stringValue(data.invoice),
            metadata: {
              requestNumber: data.requestNumber ?? null,
              quotationCount: this.numberValue(data.quotationCount),
              comparisonResult: data.comparisonResult ?? null,
              deliveryNote: data.deliveryNote ?? null,
              paymentStatus: data.paymentStatus ?? "Pendiente",
            } as Prisma.InputJsonValue,
          },
        });
        return { id: item.id, code: item.number, title: dto.title };
      }
      case "suppliers": {
        const taxId = this.stringValue(data.taxId);
        const existing = taxId
          ? await this.prisma.organization.findFirst({ where: { taxId, deletedAt: null } })
          : await this.prisma.organization.findFirst({ where: { legalName: dto.title, deletedAt: null } });
        return this.prisma.$transaction(async (tx) => {
          const organization = existing
            ? await tx.organization.update({
                where: { id: existing.id },
                data: {
                  legalName: dto.title,
                  type: "SUPPLIER",
                  taxId,
                  vatCondition: this.stringValue(data.vatCondition),
                  email: this.stringValue(data.email),
                  phone: this.stringValue(data.phone),
                  address: this.stringValue(data.address),
                  bankAccount: this.stringValue(data.cbu),
                  metadata: {
                    ...(typeof existing.metadata === "object" && existing.metadata ? existing.metadata as object : {}),
                    contact: data.contact ?? null,
                    documentationDue: data.documentationDue ?? null,
                  } as Prisma.InputJsonValue,
                },
              })
            : await tx.organization.create({
                data: {
                  legalName: dto.title,
                  type: "SUPPLIER",
                  taxId,
                  vatCondition: this.stringValue(data.vatCondition),
                  email: this.stringValue(data.email),
                  phone: this.stringValue(data.phone),
                  address: this.stringValue(data.address),
                  bankAccount: this.stringValue(data.cbu),
                  metadata: {
                    contact: data.contact ?? null,
                    documentationDue: data.documentationDue ?? null,
                  } as Prisma.InputJsonValue,
                },
              });
          const supplier = await tx.supplier.upsert({
            where: { organizationId: organization.id },
            update: { active: true, accountBalance: this.numberValue(data.accountBalance) },
            create: {
              organizationId: organization.id,
              accountBalance: this.numberValue(data.accountBalance),
            },
          });
          return { id: supplier.id, code: taxId ?? dto.code, title: organization.legalName };
        });
      }
      case "stock": {
        const warehouseName = String(data.warehouse ?? "Central").trim();
        const warehouseCode = this.slugCode(warehouseName).slice(0, 20) || "CENTRAL";
        const direction = this.stockDirection(data.movement);
        const quantity = this.numberValue(data.quantity);
        const unitCost = this.numberValue(data.unitCost);
        return this.prisma.$transaction(async (tx) => {
          const warehouse = await tx.warehouse.upsert({
            where: { code: warehouseCode },
            update: { name: warehouseName, active: true },
            create: { code: warehouseCode, name: warehouseName },
          });
          const stockItem = await tx.stockItem.upsert({
            where: { warehouseId_sku: { warehouseId: warehouse.id, sku: String(data.sku ?? dto.code) } },
            update: {
              description: dto.title,
              unit: String(data.unit ?? "u"),
              minimumStock: this.numberValue(data.minimumStock),
              averageCost: unitCost || undefined,
              active: true,
            },
            create: {
              warehouseId: warehouse.id,
              sku: String(data.sku ?? dto.code),
              description: dto.title,
              unit: String(data.unit ?? "u"),
              currentStock: 0,
              minimumStock: this.numberValue(data.minimumStock),
              averageCost: unitCost,
            },
          });
          let delta = quantity;
          if (direction === MovementDirection.OUT) delta = -quantity;
          if (String(data.movement ?? "").toLowerCase().includes("ajuste") && data.currentStock !== undefined) {
            delta = this.numberValue(data.currentStock) - Number(stockItem.currentStock);
          }
          const resulting = Number(stockItem.currentStock) + delta;
          if (resulting < 0) throw new BadRequestException("El movimiento dejaría stock negativo");
          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: {
              currentStock: resulting,
              averageCost: unitCost || stockItem.averageCost,
            },
          });
          if (delta !== 0) {
            await tx.stockMovement.create({
              data: {
                warehouseId: warehouse.id,
                stockItemId: stockItem.id,
                workId: dto.workId,
                direction: delta >= 0 ? MovementDirection.IN : MovementDirection.OUT,
                quantity: Math.abs(delta),
                unitCost,
                reference: this.stringValue(data.reference),
                createdById: userId,
              },
            });
          }
          return { id: stockItem.id, code: stockItem.sku, title: stockItem.description };
        });
      }
      case "cash":
      case "banks":
      case "payments":
        return this.createFinancialMovement(companyId, module, userId, dto);
      case "accounting":
        return this.createJournalEntry(companyId, userId, dto);
      case "taxes": {
        const item = await this.prisma.taxEstimate.upsert({
          where: { taxType_period: { taxType: String(data.taxType ?? dto.title), period: String(data.period ?? "") } },
          update: {
            debitAmount: this.numberValue(data.debitAmount),
            creditAmount: this.numberValue(data.creditAmount),
            withholdings: this.numberValue(data.withholdings),
            perceptions: this.numberValue(data.perceptions),
            estimatedDue: this.numberValue(data.estimatedDue),
            dueDate: this.dateValue(data.dueDate),
            status: dto.status ?? RecordStatus.PENDING,
            metadata: {
              technicalBalance: this.numberValue(data.technicalBalance),
              returnNumber: data.returnNumber ?? null,
              filed: this.booleanValue(data.filed),
            } as Prisma.InputJsonValue,
          },
          create: {
            taxType: String(data.taxType ?? dto.title),
            period: String(data.period ?? ""),
            debitAmount: this.numberValue(data.debitAmount),
            creditAmount: this.numberValue(data.creditAmount),
            withholdings: this.numberValue(data.withholdings),
            perceptions: this.numberValue(data.perceptions),
            estimatedDue: this.numberValue(data.estimatedDue),
            dueDate: this.dateValue(data.dueDate),
            status: dto.status ?? RecordStatus.PENDING,
            metadata: {
              technicalBalance: this.numberValue(data.technicalBalance),
              returnNumber: data.returnNumber ?? null,
              filed: this.booleanValue(data.filed),
            } as Prisma.InputJsonValue,
          },
        });
        return { id: item.id, code: dto.code, title: dto.title };
      }
      default:
        throw new BadRequestException("Módulo empresarial no soportado");
    }
  }

  async update(companyId: string, module: string, id: string, dto: UpdateRecordDto) {
    const data = dto.data ?? {};
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    switch (module) {
      case "purchases": {
        const current = await this.prisma.purchaseOrder.findFirst({
          where: { id, deletedAt: null, AND: [{ OR: [{ workId: null }, { work: { companyId } }] }] },
        });
        if (!current) throw new NotFoundException("Orden de compra no encontrada");
        const supplierId = data.supplier === undefined ? undefined : (await this.requireSupplier(data.supplier)).id;
        return this.prisma.purchaseOrder.update({
          where: { id },
          data: {
            supplierId,
            workId: dto.workId,
            costCenter: data.costCenter === undefined ? undefined : this.stringValue(data.costCenter),
            status: dto.status,
            subtotal: data.subtotal === undefined ? undefined : this.numberValue(data.subtotal),
            vat: data.vat === undefined ? undefined : this.numberValue(data.vat),
            total: data.total === undefined ? undefined : this.numberValue(data.total),
            expectedAt: data.expectedAt === undefined ? undefined : this.dateValue(data.expectedAt),
            receivedAt: data.receivedAt === undefined ? undefined : this.dateValue(data.receivedAt),
            invoiceNumber: data.invoice === undefined ? undefined : this.stringValue(data.invoice),
            metadata: data && Object.keys(data).length ? {
              requestNumber: data.requestNumber ?? null,
              quotationCount: this.numberValue(data.quotationCount),
              comparisonResult: data.comparisonResult ?? null,
              deliveryNote: data.deliveryNote ?? null,
              paymentStatus: data.paymentStatus ?? "Pendiente",
            } as Prisma.InputJsonValue : undefined,
          },
        });
      }
      case "suppliers": {
        const supplier = await this.prisma.supplier.findUnique({ where: { id }, include: { organization: true } });
        if (!supplier) throw new NotFoundException("Proveedor no encontrado");
        return this.prisma.$transaction(async (tx) => {
          if (dto.title || Object.keys(data).length) {
            await tx.organization.update({
              where: { id: supplier.organizationId },
              data: {
                legalName: dto.title,
                taxId: data.taxId === undefined ? undefined : this.stringValue(data.taxId),
                vatCondition: data.vatCondition === undefined ? undefined : this.stringValue(data.vatCondition),
                email: data.email === undefined ? undefined : this.stringValue(data.email),
                phone: data.phone === undefined ? undefined : this.stringValue(data.phone),
                address: data.address === undefined ? undefined : this.stringValue(data.address),
                bankAccount: data.cbu === undefined ? undefined : this.stringValue(data.cbu),
              },
            });
          }
          return tx.supplier.update({
            where: { id },
            data: {
              accountBalance: data.accountBalance === undefined ? undefined : this.numberValue(data.accountBalance),
            },
          });
        });
      }
      case "stock": {
        const item = await this.prisma.stockItem.findUnique({ where: { id } });
        if (!item) throw new NotFoundException("Ítem de stock no encontrado");
        return this.prisma.stockItem.update({
          where: { id },
          data: {
            description: dto.title,
            unit: data.unit === undefined ? undefined : String(data.unit),
            minimumStock: data.minimumStock === undefined ? undefined : this.numberValue(data.minimumStock),
            averageCost: data.unitCost === undefined ? undefined : this.numberValue(data.unitCost),
          },
        });
      }
      case "cash":
      case "banks":
      case "payments":
        return this.updateFinancialMovement(companyId, module, id, dto);
      case "accounting":
        return this.updateJournalEntry(companyId, id, dto);
      case "taxes": {
        const item = await this.prisma.taxEstimate.findUnique({ where: { id } });
        if (!item) throw new NotFoundException("Estimación fiscal no encontrada");
        return this.prisma.taxEstimate.update({
          where: { id },
          data: {
            taxType: data.taxType === undefined ? undefined : String(data.taxType),
            period: data.period === undefined ? undefined : String(data.period),
            debitAmount: data.debitAmount === undefined ? undefined : this.numberValue(data.debitAmount),
            creditAmount: data.creditAmount === undefined ? undefined : this.numberValue(data.creditAmount),
            withholdings: data.withholdings === undefined ? undefined : this.numberValue(data.withholdings),
            perceptions: data.perceptions === undefined ? undefined : this.numberValue(data.perceptions),
            estimatedDue: data.estimatedDue === undefined ? undefined : this.numberValue(data.estimatedDue),
            dueDate: data.dueDate === undefined ? undefined : this.dateValue(data.dueDate),
            status: dto.status,
            metadata: Object.keys(data).length ? {
              technicalBalance: this.numberValue(data.technicalBalance),
              returnNumber: data.returnNumber ?? null,
              filed: this.booleanValue(data.filed),
            } as Prisma.InputJsonValue : undefined,
          },
        });
      }
      default:
        throw new BadRequestException("Módulo empresarial no soportado");
    }
  }

  async softDelete(companyId: string, module: string, id: string, userId: string) {
    switch (module) {
      case "purchases":
        return this.prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date(), status: RecordStatus.VOID } });
      case "suppliers":
        return this.prisma.supplier.update({ where: { id }, data: { active: false } });
      case "stock":
        return this.prisma.stockItem.update({ where: { id }, data: { active: false } });
      case "cash":
      case "banks":
      case "payments":
        return this.voidFinancialMovement(companyId, id, userId);
      case "accounting":
        return this.prisma.journalEntry.update({ where: { id }, data: { status: RecordStatus.VOID } });
      case "taxes":
        return this.prisma.taxEstimate.update({ where: { id }, data: { status: RecordStatus.VOID } });
      default:
        throw new BadRequestException("Módulo empresarial no soportado");
    }
  }

  private async createFinancialMovement(companyId: string, module: string, userId: string, dto: CreateRecordDto) {
    const data = dto.data ?? {};
    const direction =
      module === "payments"
        ? String(data.operation ?? "").toLowerCase().includes("cobro") ? MovementDirection.IN : MovementDirection.OUT
        : this.directionValue(data.direction ?? data.movementType);
    const amount = this.numberValue(data.amount);
    if (amount <= 0) throw new BadRequestException("El importe debe ser mayor a cero");

    return this.prisma.$transaction(async (tx) => {
      let cashBoxId: string | undefined;
      let bankAccountId: string | undefined;

      if (module === "cash") {
        const name = String(data.cashBox ?? "Central");
        const code = this.slugCode(name).slice(0, 20) || "CENTRAL";
        const box = await tx.cashBox.upsert({
          where: { code },
          update: { name, active: true },
          create: { code, name, workId: dto.workId },
        });
        cashBoxId = box.id;
      } else {
        const method = String(data.paymentMethod ?? "").toLowerCase();
        if (module === "banks" || !method.includes("efectivo")) {
          const bankName = String(data.bank ?? "Cuenta operativa");
          const accountNumber = String(data.account ?? "OPERATIVA").trim();
          const account = await tx.bankAccount.upsert({
            where: { accountNumber },
            update: { bankName, active: true },
            create: {
              bankName,
              accountName: accountNumber,
              accountNumber,
            },
          });
          bankAccountId = account.id;
        } else {
          const box = await tx.cashBox.upsert({
            where: { code: "CENTRAL" },
            update: { active: true },
            create: { code: "CENTRAL", name: "Central" },
          });
          cashBoxId = box.id;
        }
      }

      const movement = await tx.financialMovement.create({
        data: {
          workId: dto.workId,
          cashBoxId,
          bankAccountId,
          direction,
          type: String(data.receiptType ?? data.movementType ?? data.operation ?? data.direction ?? module),
          concept: String(data.concept ?? data.allocation ?? dto.title),
          amount,
          occurredAt: this.dateValue(data.projectedAt ?? dto.occurredAt) ?? new Date(),
          counterparty: this.stringValue(data.counterparty ?? data.beneficiary),
          reference: this.stringValue(data.reference ?? data.receiptNumber ?? data.receipt),
          createdById: userId,
        },
      });

      const signed = direction === MovementDirection.IN ? amount : -amount;
      if (cashBoxId) {
        const box = await tx.cashBox.findUnique({ where: { id: cashBoxId }, select: { balance: true } });
        if (box && Number(box.balance) + signed < 0) throw new BadRequestException("La caja quedaría con saldo negativo");
        await tx.cashBox.update({ where: { id: cashBoxId }, data: { balance: { increment: signed } } });
      }
      if (bankAccountId) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            bankBalance: { increment: signed },
            accountingBalance: { increment: signed },
          },
        });
      }
      return { id: movement.id, code: dto.code, title: movement.concept };
    });
  }

  private async updateFinancialMovement(companyId: string, module: string, id: string, dto: UpdateRecordDto) {
    const current = await this.prisma.financialMovement.findFirst({
      where: { id, deletedAt: null, AND: [{ OR: [{ workId: null }, { work: { companyId } }] }] },
    });
    if (!current) throw new NotFoundException("Movimiento financiero no encontrado");
    const data = dto.data ?? {};
    const newAmount = data.amount === undefined ? Number(current.amount) : this.numberValue(data.amount);
    const newDirection =
      data.direction === undefined && data.operation === undefined && data.movementType === undefined
        ? current.direction
        : module === "payments"
          ? String(data.operation ?? "").toLowerCase().includes("cobro") ? MovementDirection.IN : MovementDirection.OUT
          : this.directionValue(data.direction ?? data.movementType);
    return this.prisma.$transaction(async (tx) => {
      const oldSigned = current.direction === MovementDirection.IN ? Number(current.amount) : -Number(current.amount);
      const newSigned = newDirection === MovementDirection.IN ? newAmount : -newAmount;
      const delta = newSigned - oldSigned;
      if (current.cashBoxId && delta !== 0) {
        const box = await tx.cashBox.findUnique({ where: { id: current.cashBoxId }, select: { balance: true } });
        if (box && Number(box.balance) + delta < 0) throw new BadRequestException("La modificación dejaría la caja con saldo negativo");
        await tx.cashBox.update({ where: { id: current.cashBoxId }, data: { balance: { increment: delta } } });
      }
      if (current.bankAccountId && delta !== 0) {
        await tx.bankAccount.update({
          where: { id: current.bankAccountId },
          data: { bankBalance: { increment: delta }, accountingBalance: { increment: delta } },
        });
      }
      return tx.financialMovement.update({
        where: { id },
        data: {
          workId: dto.workId,
          direction: newDirection,
          type: data.receiptType === undefined && data.movementType === undefined && data.operation === undefined
            ? undefined
            : String(data.receiptType ?? data.movementType ?? data.operation),
          concept: data.concept === undefined && data.allocation === undefined && dto.title === undefined
            ? undefined
            : String(data.concept ?? data.allocation ?? dto.title),
          amount: newAmount,
          occurredAt: data.projectedAt === undefined ? undefined : this.dateValue(data.projectedAt),
          counterparty: data.counterparty === undefined && data.beneficiary === undefined ? undefined : this.stringValue(data.counterparty ?? data.beneficiary),
          reference: data.reference === undefined && data.receiptNumber === undefined && data.receipt === undefined ? undefined : this.stringValue(data.reference ?? data.receiptNumber ?? data.receipt),
        },
      });
    });
  }

  private async voidFinancialMovement(companyId: string, id: string, userId: string) {
    const current = await this.prisma.financialMovement.findFirst({
      where: { id, deletedAt: null, AND: [{ OR: [{ workId: null }, { work: { companyId } }] }] },
    });
    if (!current) throw new NotFoundException("Movimiento financiero no encontrado");
    return this.prisma.$transaction(async (tx) => {
      const signed = current.direction === MovementDirection.IN ? Number(current.amount) : -Number(current.amount);
      if (current.cashBoxId) {
        await tx.cashBox.update({ where: { id: current.cashBoxId }, data: { balance: { decrement: signed } } });
      }
      if (current.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: current.bankAccountId },
          data: { bankBalance: { decrement: signed }, accountingBalance: { decrement: signed } },
        });
      }
      return tx.financialMovement.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          reference: [current.reference, `BAJA:${userId}`].filter(Boolean).join(" · "),
        },
      });
    });
  }

  private async createJournalEntry(companyId: string, userId: string, dto: CreateRecordDto) {
    const data = dto.data ?? {};
    const debit = this.numberValue(data.debit);
    const credit = this.numberValue(data.credit);
    if (debit <= 0 || credit <= 0 || Math.abs(debit - credit) > 0.005) {
      throw new BadRequestException("El asiento debe estar balanceado: Debe = Haber");
    }
    const debitAccount = await this.resolveChartAccount(data.accountDebit, "ACTIVO");
    const creditAccount = await this.resolveChartAccount(data.accountCredit, "PASIVO");
    const workId = dto.workId ?? await this.resolveWorkFromCostCenter(companyId, data.costCenter);
    const number = data.entryNumber ? Math.trunc(this.numberValue(data.entryNumber)) : await this.nextJournalNumber();
    const posted = this.booleanValue(data.posted);
    const entry = await this.prisma.journalEntry.create({
      data: {
        number,
        entryDate: this.dateValue(data.entryDate ?? dto.occurredAt) ?? new Date(),
        description: dto.title,
        sourceModule: this.stringValue(data.sourceModule),
        status: posted ? RecordStatus.APPROVED : dto.status ?? RecordStatus.DRAFT,
        createdById: userId,
        postedById: posted ? userId : undefined,
        postedAt: posted ? new Date() : undefined,
        lines: {
          create: [
            { accountId: debitAccount.id, workId, debit, credit: 0, description: dto.title },
            { accountId: creditAccount.id, workId, debit: 0, credit, description: dto.title },
          ],
        },
      },
    });
    return { id: entry.id, code: `ASI-${String(entry.number).padStart(6, "0")}`, title: entry.description };
  }

  private async updateJournalEntry(companyId: string, id: string, dto: UpdateRecordDto) {
    const current = await this.prisma.journalEntry.findUnique({ where: { id }, include: { lines: true } });
    if (!current) throw new NotFoundException("Asiento no encontrado");
    if (current.postedAt) throw new BadRequestException("Un asiento mayorizado no se modifica; debe revertirse con otro asiento");
    const data = dto.data ?? {};
    const debit = data.debit === undefined ? current.lines.reduce((sum, line) => sum + Number(line.debit), 0) : this.numberValue(data.debit);
    const credit = data.credit === undefined ? current.lines.reduce((sum, line) => sum + Number(line.credit), 0) : this.numberValue(data.credit);
    if (Math.abs(debit - credit) > 0.005) throw new BadRequestException("El asiento debe permanecer balanceado");
    const debitLine = current.lines.find((line) => Number(line.debit) > 0);
    const creditLine = current.lines.find((line) => Number(line.credit) > 0);
    const debitAccountId = data.accountDebit === undefined ? debitLine?.accountId : (await this.resolveChartAccount(data.accountDebit, "ACTIVO")).id;
    const creditAccountId = data.accountCredit === undefined ? creditLine?.accountId : (await this.resolveChartAccount(data.accountCredit, "PASIVO")).id;
    if (!debitAccountId || !creditAccountId) throw new BadRequestException("Faltan cuentas contables");
    const workId = dto.workId ?? await this.resolveWorkFromCostCenter(companyId, data.costCenter);
    const posted = data.posted === undefined ? false : this.booleanValue(data.posted);
    return this.prisma.$transaction(async (tx) => {
      await tx.journalLine.deleteMany({ where: { journalEntryId: id } });
      return tx.journalEntry.update({
        where: { id },
        data: {
          entryDate: data.entryDate === undefined ? undefined : this.dateValue(data.entryDate),
          description: dto.title,
          sourceModule: data.sourceModule === undefined ? undefined : this.stringValue(data.sourceModule),
          status: posted ? RecordStatus.APPROVED : dto.status,
          postedById: posted ? current.createdById : undefined,
          postedAt: posted ? new Date() : undefined,
          lines: {
            create: [
              { accountId: debitAccountId, workId, debit, credit: 0, description: dto.title },
              { accountId: creditAccountId, workId, debit: 0, credit, description: dto.title },
            ],
          },
        },
      });
    });
  }

  private async resolveChartAccount(value: unknown, defaultType: string) {
    const raw = String(value ?? "").trim();
    if (!raw) throw new BadRequestException("Debe indicar la cuenta contable");
    const code = raw.includes("·") ? raw.split("·")[0].trim() : this.slugCode(raw).slice(0, 20);
    const name = raw.includes("·") ? raw.split("·").slice(1).join("·").trim() : raw;
    return this.prisma.chartAccount.upsert({
      where: { code },
      update: { name, active: true },
      create: { code, name, type: defaultType },
    });
  }

  private async resolveWorkFromCostCenter(companyId: string, value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) return undefined;
    const work = await this.prisma.work.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ costCenter: raw }, { code: raw }],
      },
      select: { id: true },
    });
    return work?.id;
  }

  private async requireSupplier(value: unknown) {
    const raw = this.stringValue(value);
    if (!raw) throw new BadRequestException("Debe seleccionar un proveedor");
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        active: true,
        organization: {
          deletedAt: null,
          OR: [
            { legalName: { equals: raw, mode: "insensitive" } },
            { legalName: { contains: raw, mode: "insensitive" } },
            { taxId: { equals: raw, mode: "insensitive" } },
          ],
        },
      },
    });
    if (!supplier) throw new NotFoundException("Proveedor no encontrado");
    return supplier;
  }

  private async requireWork(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!work) throw new NotFoundException("Obra no encontrada");
  }

  private async nextJournalNumber() {
    const latest = await this.prisma.journalEntry.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    return (latest?.number ?? 0) + 1;
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

  private numberValue(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
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

  private booleanValue(value: unknown) {
    if (typeof value === "boolean") return value;
    const normalized = String(value ?? "").toLowerCase();
    return ["sí", "si", "true", "1", "presentado", "mayorizado"].includes(normalized);
  }

  private directionValue(value: unknown) {
    const normalized = String(value ?? "").toLowerCase();
    return normalized.includes("ingreso") || normalized.includes("crédito") || normalized.includes("credito") || normalized.includes("depósito") || normalized.includes("deposito")
      ? MovementDirection.IN
      : MovementDirection.OUT;
  }

  private stockDirection(value: unknown) {
    const normalized = String(value ?? "").toLowerCase();
    return normalized.includes("entrada") ? MovementDirection.IN : MovementDirection.OUT;
  }

  private slugCode(value: string) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
}
