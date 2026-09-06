import { Injectable } from "@nestjs/common";
import { RecordStatus, WorkStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const amount = (value: unknown) => Number(value ?? 0);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async general(companyId: string, userId: string, restrictToAssignedWorks: boolean) {
    const workScope = restrictToAssignedWorks
      ? { companyId, members: { some: { userId, endDate: null } } }
      : { companyId };
    const [
      works,
      certificateAggregate,
      payables,
      bankAggregate,
      cashAggregate,
      taxEstimates,
      alerts,
    ] = await Promise.all([
      this.prisma.work.findMany({
        where: { ...workScope, deletedAt: null, status: WorkStatus.ACTIVE },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          contractAmount: true,
          targetBudget: true,
          actualCost: true,
          physicalProgress: true,
          financialProgress: true,
          collectedAmount: true,
          responsibleName: true,
          client: { select: { legalName: true } },
        },
      }),
      this.prisma.certificate.aggregate({
        where: {
          work: workScope,
          deletedAt: null,
          status: { not: RecordStatus.VOID },
        },
        _sum: { netAmount: true, collectedAmount: true },
        _count: true,
      }),
      this.prisma.purchaseOrder.aggregate({
        where: {
          work: workScope,
          deletedAt: null,
          status: { in: [RecordStatus.PENDING, RecordStatus.APPROVED] },
        },
        _sum: { total: true },
      }),
      this.prisma.bankAccount.aggregate({
        where: { active: true },
        _sum: { accountingBalance: true },
      }),
      this.prisma.cashBox.aggregate({
        where: { active: true },
        _sum: { balance: true },
      }),
      this.prisma.taxEstimate.findMany({
        where: { status: RecordStatus.PENDING },
        orderBy: { dueDate: "asc" },
        take: 6,
      }),
      this.prisma.alert.findMany({
        where: {
          resolvedAt: null,
          OR: [
            ...(!restrictToAssignedWorks ? [{ workId: null }] : []),
            { work: workScope },
          ],
        },
        include: { work: { select: { code: true } } },
        orderBy: [{ severity: "desc" }, { dueAt: "asc" }],
        take: 8,
      }),
    ]);

    const contractTotal = works.reduce(
      (sum, work) => sum + amount(work.contractAmount),
      0,
    );
    const actualCost = works.reduce(
      (sum, work) => sum + amount(work.actualCost),
      0,
    );
    const targetBudget = works.reduce(
      (sum, work) => sum + amount(work.targetBudget),
      0,
    );
    const certified = amount(certificateAggregate._sum.netAmount);
    const collected = amount(certificateAggregate._sum.collectedAmount);

    return {
      generatedAt: new Date().toISOString(),
      kpis: {
        activeWorks: works.length,
        contractTotal,
        certified,
        pendingCollection: Math.max(0, certified - collected),
        accountsPayable: amount(payables._sum.total),
        cashAndBanks:
          amount(bankAggregate._sum.accountingBalance) +
          amount(cashAggregate._sum.balance),
        actualCost,
        targetBudget,
        estimatedMargin:
          contractTotal > 0
            ? ((contractTotal - actualCost) / contractTotal) * 100
            : 0,
        estimatedTaxes: taxEstimates.reduce(
          (sum, tax) => sum + amount(tax.estimatedDue),
          0,
        ),
      },
      works: works.map((work) => ({
        ...work,
        contractAmount: amount(work.contractAmount),
        targetBudget: amount(work.targetBudget),
        actualCost: amount(work.actualCost),
        collectedAmount: amount(work.collectedAmount),
        physicalProgress: amount(work.physicalProgress),
        financialProgress: amount(work.financialProgress),
        margin:
          amount(work.contractAmount) > 0
            ? ((amount(work.contractAmount) - amount(work.actualCost)) /
                amount(work.contractAmount)) *
              100
            : 0,
      })),
      taxEstimates,
      alerts,
    };
  }

  async sector(
    companyId: string,
    userId: string,
    roleCodes: string[],
    module: string,
  ) {
    const normalizedModule = module.trim().toLowerCase();
    const elevated = roleCodes.includes("ADMIN_GENERAL") || roleCodes.includes("GERENTE_EMPRESA");
    if (!elevated) {
      const [rolePermission, directPermission] = await Promise.all([
        this.prisma.rolePermission.findFirst({
          where: {
            allowed: true,
            permission: { module: normalizedModule, action: "view" },
            role: { users: { some: { userId } } },
          },
          select: { roleId: true },
        }),
        this.prisma.userPermission.findFirst({
          where: {
            userId,
            workId: null,
            permission: { module: normalizedModule, action: "view" },
          },
          select: { allowed: true },
        }),
      ]);
      if (directPermission?.allowed === false || (!directPermission?.allowed && !rolePermission)) {
        return {
          module: normalizedModule,
          generatedAt: new Date().toISOString(),
          authorized: false,
          cards: [],
          alerts: [],
          byWork: [],
        };
      }
    }

    const restrictToAssignedWorks = roleCodes.some((code) => code.startsWith("TEC_"));
    const workFilter = restrictToAssignedWorks
      ? { companyId, members: { some: { userId, endDate: null } } }
      : { companyId };
    const genericWorkScope = restrictToAssignedWorks
      ? { OR: [{ workId: null }, { work: workFilter }] }
      : {};

    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const next30 = new Date(Date.now() + 30 * 86_400_000);

    const [genericSummary, genericRecent, genericByWork, alerts, documents] = await Promise.all([
      this.prisma.genericRecord.groupBy({
        by: ["status"],
        where: {
          module: normalizedModule,
          deletedAt: null,
          ...genericWorkScope,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.genericRecord.count({
        where: {
          module: normalizedModule,
          deletedAt: null,
          createdAt: { gte: since30 },
          ...genericWorkScope,
        },
      }),
      this.prisma.genericRecord.groupBy({
        by: ["workId"],
        where: {
          module: normalizedModule,
          deletedAt: null,
          workId: { not: null },
          ...genericWorkScope,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.alert.findMany({
        where: {
          resolvedAt: null,
          OR: [
            { type: normalizedModule },
            { type: { startsWith: normalizedModule } },
            ...(restrictToAssignedWorks ? [{ work: workFilter }] : []),
          ],
        },
        include: { work: { select: { code: true, name: true } } },
        orderBy: [{ severity: "desc" }, { dueAt: "asc" }],
        take: 6,
      }),
      this.prisma.document.count({
        where: {
          module: normalizedModule,
          deletedAt: null,
          ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
        },
      }),
    ]);

    const genericTotal = genericSummary.reduce((sum, row) => sum + row._count._all, 0);
    const genericAmount = genericSummary.reduce((sum, row) => sum + amount(row._sum.amount), 0);
    const pending = genericSummary
      .filter((row) => [RecordStatus.DRAFT, RecordStatus.PENDING].includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);
    const approved = genericSummary
      .filter((row) => [RecordStatus.APPROVED, RecordStatus.ACTIVE, RecordStatus.CLOSED].includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);

    const workIds = genericByWork.map((row) => row.workId).filter((id): id is string => Boolean(id));
    const workNames = workIds.length
      ? await this.prisma.work.findMany({
          where: { id: { in: workIds }, companyId },
          select: { id: true, code: true, name: true },
        })
      : [];
    const workNameMap = new Map(workNames.map((work) => [work.id, work]));
    const byWork = genericByWork
      .map((row) => {
        const work = row.workId ? workNameMap.get(row.workId) : undefined;
        return {
          workId: row.workId,
          code: work?.code ?? "SIN-OBRA",
          name: work?.name ?? "Sin obra",
          count: row._count._all,
          amount: amount(row._sum.amount),
        };
      })
      .sort((a, b) => b.amount - a.amount || b.count - a.count)
      .slice(0, 6);

    const cards: Array<{
      key: string;
      label: string;
      value: number;
      format: "number" | "currency" | "percent" | "liters";
      tone?: "positive" | "warning" | "danger";
    }> = [
      { key: "records", label: "Registros", value: genericTotal, format: "number" },
      { key: "pending", label: "Pendientes", value: pending, format: "number", tone: pending ? "warning" : "positive" },
      { key: "approved", label: "Aprobados / activos", value: approved, format: "number", tone: "positive" },
      { key: "amount", label: "Monto registrado", value: genericAmount, format: "currency" },
      { key: "recent", label: "Actividad últimos 30 días", value: genericRecent, format: "number" },
      { key: "documents", label: "Documentos vinculados", value: documents, format: "number" },
    ];

    const push = (
      key: string,
      label: string,
      value: number,
      format: "number" | "currency" | "percent" | "liters" = "number",
      tone?: "positive" | "warning" | "danger",
    ) => cards.push({ key, label, value, format, tone });

    switch (normalizedModule) {
      case "works": {
        const works = await this.prisma.work.findMany({
          where: { ...workFilter, deletedAt: null },
          select: {
            status: true,
            contractAmount: true,
            actualCost: true,
            physicalProgress: true,
            contractualEndDate: true,
          },
        });
        const active = works.filter((work) => work.status === WorkStatus.ACTIVE);
        const overdue = active.filter((work) => work.contractualEndDate && work.contractualEndDate < new Date()).length;
        const contractTotal = active.reduce((sum, work) => sum + amount(work.contractAmount), 0);
        const actualCost = active.reduce((sum, work) => sum + amount(work.actualCost), 0);
        const avgProgress = active.length
          ? active.reduce((sum, work) => sum + amount(work.physicalProgress), 0) / active.length
          : 0;
        push("activeWorks", "Obras activas", active.length);
        push("contractTotal", "Monto contractual activo", contractTotal, "currency");
        push("actualCost", "Costo real acumulado", actualCost, "currency");
        push("avgProgress", "Avance físico promedio", avgProgress, "percent");
        push("overdueWorks", "Obras fuera de plazo", overdue, "number", overdue ? "danger" : "positive");
        break;
      }
      case "budgets": {
        const [agg, count, approvedCount] = await Promise.all([
          this.prisma.budget.aggregate({
            where: { work: workFilter, deletedAt: null, status: { not: RecordStatus.VOID } },
            _sum: { total: true },
          }),
          this.prisma.budget.count({ where: { work: workFilter, deletedAt: null } }),
          this.prisma.budget.count({ where: { work: workFilter, deletedAt: null, status: RecordStatus.APPROVED } }),
        ]);
        push("budgetCount", "Presupuestos", count);
        push("budgetApproved", "Presupuestos aprobados", approvedCount, "number", "positive");
        push("budgetTotal", "Total presupuestado", amount(agg._sum.total), "currency");
        break;
      }
      case "progress": {
        const [reports, reports30] = await Promise.all([
          this.prisma.dailyReport.aggregate({
            where: { work: workFilter, deletedAt: null },
            _avg: { personnelCount: true, equipmentCount: true, physicalProgress: true },
            _count: true,
          }),
          this.prisma.dailyReport.count({
            where: { work: workFilter, deletedAt: null, reportDate: { gte: since30 } },
          }),
        ]);
        push("dailyReports", "Partes diarios", reports._count);
        push("reports30", "Partes últimos 30 días", reports30);
        push("avgPersonnel", "Personal promedio por parte", Number(reports._avg.personnelCount ?? 0));
        push("avgEquipment", "Equipos promedio por parte", Number(reports._avg.equipmentCount ?? 0));
        break;
      }
      case "certificates": {
        const agg = await this.prisma.certificate.aggregate({
          where: { work: workFilter, deletedAt: null, status: { not: RecordStatus.VOID } },
          _sum: { grossAmount: true, netAmount: true, collectedAmount: true },
          _count: true,
        });
        const net = amount(agg._sum.netAmount);
        const collected = amount(agg._sum.collectedAmount);
        push("certCount", "Certificados", agg._count);
        push("certGross", "Monto bruto certificado", amount(agg._sum.grossAmount), "currency");
        push("certNet", "Neto certificado", net, "currency");
        push("certCollected", "Cobrado", collected, "currency", "positive");
        push("certPending", "Pendiente de cobro", Math.max(0, net - collected), "currency", net > collected ? "warning" : "positive");
        break;
      }
      case "dossiers": {
        const [agg, stale] = await Promise.all([
          this.prisma.dossier.aggregate({
            where: {
              deletedAt: null,
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
            _sum: { amount: true, paidAmount: true },
            _count: true,
          }),
          this.prisma.dossier.count({
            where: {
              deletedAt: null,
              status: { in: [RecordStatus.PENDING, RecordStatus.ACTIVE] },
              lastMovementAt: { lt: since30 },
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
          }),
        ]);
        push("dossiers", "Expedientes", agg._count);
        push("dossierAmount", "Monto de expedientes", amount(agg._sum.amount), "currency");
        push("dossierPaid", "Monto pagado", amount(agg._sum.paidAmount), "currency");
        push("dossierStale", "Sin movimiento >30 días", stale, "number", stale ? "warning" : "positive");
        break;
      }
      case "purchases": {
        const [agg, pendingCount, overdue] = await Promise.all([
          this.prisma.purchaseOrder.aggregate({
            where: {
              deletedAt: null,
              status: { not: RecordStatus.VOID },
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
            _sum: { total: true },
            _count: true,
          }),
          this.prisma.purchaseOrder.count({
            where: {
              deletedAt: null,
              status: RecordStatus.PENDING,
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
          }),
          this.prisma.purchaseOrder.count({
            where: {
              deletedAt: null,
              receivedAt: null,
              expectedAt: { lt: new Date() },
              status: { in: [RecordStatus.PENDING, RecordStatus.APPROVED, RecordStatus.ACTIVE] },
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
          }),
        ]);
        push("poCount", "Órdenes de compra", agg._count);
        push("poTotal", "Compras comprometidas", amount(agg._sum.total), "currency");
        push("poPending", "Pendientes de aprobación", pendingCount, "number", pendingCount ? "warning" : "positive");
        push("poOverdue", "Entregas vencidas", overdue, "number", overdue ? "danger" : "positive");
        break;
      }
      case "suppliers": {
        const suppliers = await this.prisma.supplier.findMany({
          where: { active: true },
          select: { accountBalance: true },
        });
        push("suppliersActive", "Proveedores activos", suppliers.length);
        push("supplierBalance", "Saldo cuentas corrientes", suppliers.reduce((sum, item) => sum + amount(item.accountBalance), 0), "currency");
        break;
      }
      case "stock": {
        const items = await this.prisma.stockItem.findMany({
          where: { active: true },
          select: { currentStock: true, minimumStock: true, averageCost: true },
        });
        const belowMin = items.filter((item) => amount(item.currentStock) < amount(item.minimumStock)).length;
        const inventoryValue = items.reduce((sum, item) => sum + amount(item.currentStock) * amount(item.averageCost), 0);
        push("stockItems", "Ítems activos", items.length);
        push("stockBelowMin", "Bajo stock mínimo", belowMin, "number", belowMin ? "warning" : "positive");
        push("stockValue", "Stock valorizado", inventoryValue, "currency");
        break;
      }
      case "cash":
      case "banks":
      case "payments": {
        const [cashAgg, bankAgg, inflow, outflow] = await Promise.all([
          this.prisma.cashBox.aggregate({ where: { active: true }, _sum: { balance: true } }),
          this.prisma.bankAccount.aggregate({ where: { active: true }, _sum: { accountingBalance: true } }),
          this.prisma.financialMovement.aggregate({
            where: {
              deletedAt: null,
              direction: "IN",
              occurredAt: { gte: since30 },
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
            _sum: { amount: true },
          }),
          this.prisma.financialMovement.aggregate({
            where: {
              deletedAt: null,
              direction: "OUT",
              occurredAt: { gte: since30 },
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
            _sum: { amount: true },
          }),
        ]);
        const liquidity = amount(cashAgg._sum.balance) + amount(bankAgg._sum.accountingBalance);
        push("liquidity", "Caja + bancos", liquidity, "currency");
        push("inflow30", "Ingresos 30 días", amount(inflow._sum.amount), "currency", "positive");
        push("outflow30", "Egresos 30 días", amount(outflow._sum.amount), "currency");
        push("netFlow30", "Flujo neto 30 días", amount(inflow._sum.amount) - amount(outflow._sum.amount), "currency");
        break;
      }
      case "accounting": {
        const [entries, posted, draft] = await Promise.all([
          this.prisma.journalEntry.count(),
          this.prisma.journalEntry.count({ where: { status: { in: [RecordStatus.APPROVED, RecordStatus.CLOSED] } } }),
          this.prisma.journalEntry.count({ where: { status: RecordStatus.DRAFT } }),
        ]);
        push("journalEntries", "Asientos contables", entries);
        push("postedEntries", "Asientos contabilizados", posted, "number", "positive");
        push("draftEntries", "Asientos en borrador", draft, "number", draft ? "warning" : "positive");
        break;
      }
      case "taxes": {
        const [agg, overdue, dueSoon] = await Promise.all([
          this.prisma.taxEstimate.aggregate({
            where: { status: RecordStatus.PENDING },
            _sum: { estimatedDue: true },
            _count: true,
          }),
          this.prisma.taxEstimate.count({
            where: { status: RecordStatus.PENDING, dueDate: { lt: new Date() } },
          }),
          this.prisma.taxEstimate.count({
            where: { status: RecordStatus.PENDING, dueDate: { gte: new Date(), lte: next30 } },
          }),
        ]);
        push("taxPending", "Obligaciones pendientes", agg._count);
        push("taxEstimated", "Impuestos estimados", amount(agg._sum.estimatedDue), "currency");
        push("taxOverdue", "Vencidas", overdue, "number", overdue ? "danger" : "positive");
        push("taxDueSoon", "Vencen en 30 días", dueSoon, "number", dueSoon ? "warning" : "positive");
        break;
      }
      case "fleet": {
        const [active, insuranceDue, inspectionDue] = await Promise.all([
          this.prisma.vehicle.count({ where: { active: true } }),
          this.prisma.vehicle.count({ where: { active: true, insuranceDue: { lte: next30 } } }),
          this.prisma.vehicle.count({ where: { active: true, inspectionDue: { lte: next30 } } }),
        ]);
        push("vehicles", "Vehículos activos", active);
        push("insuranceDue", "Seguros vencen ≤30 días", insuranceDue, "number", insuranceDue ? "warning" : "positive");
        push("inspectionDue", "RTO/VTV vence ≤30 días", inspectionDue, "number", inspectionDue ? "warning" : "positive");
        break;
      }
      case "drivers": {
        const [active, due] = await Promise.all([
          this.prisma.driver.count({ where: { active: true } }),
          this.prisma.driver.count({ where: { active: true, licenseDue: { lte: next30 } } }),
        ]);
        push("drivers", "Choferes activos", active);
        push("licensesDue", "Licencias vencen ≤30 días", due, "number", due ? "warning" : "positive");
        break;
      }
      case "fuel": {
        const agg = await this.prisma.fuelLog.aggregate({
          where: {
            filledAt: { gte: since30 },
            ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
          },
          _sum: { liters: true, total: true },
          _avg: { unitPrice: true },
          _count: true,
        });
        push("fuelLoads", "Cargas 30 días", agg._count);
        push("fuelLiters", "Litros 30 días", amount(agg._sum.liters), "liters");
        push("fuelCost", "Costo combustible 30 días", amount(agg._sum.total), "currency");
        push("fuelAvgPrice", "Precio promedio / litro", amount(agg._avg.unitPrice), "currency");
        break;
      }
      case "machinery": {
        const machines = await this.prisma.machine.findMany({
          where: { active: true },
          select: { hourlyCost: true, operatorName: true },
        });
        push("machines", "Máquinas activas", machines.length);
        push("hourlyCost", "Costo horario teórico total", machines.reduce((sum, machine) => sum + amount(machine.hourlyCost), 0), "currency");
        push("withoutOperator", "Sin operador asignado", machines.filter((machine) => !machine.operatorName).length, "number", machines.some((machine) => !machine.operatorName) ? "warning" : "positive");
        break;
      }
      case "maintenance": {
        const [pendingMaint, overdueMaint, costAgg] = await Promise.all([
          this.prisma.maintenanceOrder.count({ where: { status: { in: [RecordStatus.PENDING, RecordStatus.ACTIVE] } } }),
          this.prisma.maintenanceOrder.count({
            where: { status: { in: [RecordStatus.PENDING, RecordStatus.ACTIVE] }, scheduledAt: { lt: new Date() } },
          }),
          this.prisma.maintenanceOrder.aggregate({ _sum: { partsCost: true, laborCost: true } }),
        ]);
        push("maintPending", "Órdenes abiertas", pendingMaint);
        push("maintOverdue", "Mantenimientos vencidos", overdueMaint, "number", overdueMaint ? "danger" : "positive");
        push("maintCost", "Costo mantenimiento acumulado", amount(costAgg._sum.partsCost) + amount(costAgg._sum.laborCost), "currency");
        break;
      }
      case "hr": {
        const activeEmployees = await this.prisma.employee.count({ where: { active: true } });
        push("employees", "Personal activo", activeEmployees);
        break;
      }
      case "payroll": {
        const agg = await this.prisma.payroll.aggregate({
          where: {
            ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
          },
          _sum: { companyCost: true },
          _count: true,
        });
        const drafts = await this.prisma.payroll.count({
          where: {
            status: { in: [RecordStatus.DRAFT, RecordStatus.PENDING] },
            ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
          },
        });
        push("payrollCount", "Liquidaciones", agg._count);
        push("payrollCost", "Costo empresa", amount(agg._sum.companyCost), "currency");
        push("payrollPending", "Pendientes / borrador", drafts, "number", drafts ? "warning" : "positive");
        break;
      }
      case "per-diems": {
        const agg = await this.prisma.perDiem.aggregate({
          where: {
            ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
          },
          _sum: { advance: true, expenses: true, balance: true },
          _count: true,
        });
        push("perDiemCount", "Viáticos", agg._count);
        push("perDiemAdvance", "Anticipos", amount(agg._sum.advance), "currency");
        push("perDiemExpenses", "Gastos rendidos", amount(agg._sum.expenses), "currency");
        push("perDiemBalance", "Saldo por rendir", amount(agg._sum.balance), "currency", amount(agg._sum.balance) ? "warning" : "positive");
        break;
      }
      case "lodging": {
        const agg = await this.prisma.lodging.aggregate({
          where: {
            ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
          },
          _sum: { total: true, nights: true, peopleCount: true },
          _count: true,
        });
        push("lodgings", "Reservas", agg._count);
        push("lodgingNights", "Noches contratadas", Number(agg._sum.nights ?? 0));
        push("lodgingPeople", "Personas alojadas", Number(agg._sum.peopleCount ?? 0));
        push("lodgingCost", "Costo alojamiento", amount(agg._sum.total), "currency");
        break;
      }
      case "concrete": {
        const agg = await this.prisma.concreteOrder.aggregate({
          where: { work: workFilter, status: { not: RecordStatus.VOID } },
          _sum: { cubicMeters: true, cementKg: true },
          _avg: { costPerM3: true },
          _count: true,
        });
        push("concreteOrders", "Órdenes de producción", agg._count);
        push("concreteM3", "Hormigón producido (m³)", amount(agg._sum.cubicMeters), "number");
        push("cementKg", "Cemento consumido (kg)", amount(agg._sum.cementKg), "number");
        push("concreteCostM3", "Costo promedio / m³", amount(agg._avg.costPerM3), "currency");
        break;
      }
      case "approvals": {
        const [pendingApprovals, totalApprovals] = await Promise.all([
          this.prisma.approvalInstance.count({
            where: {
              status: "PENDING",
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
          }),
          this.prisma.approvalInstance.count({
            where: {
              ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
            },
          }),
        ]);
        push("approvalsPending", "Aprobaciones pendientes", pendingApprovals, "number", pendingApprovals ? "warning" : "positive");
        push("approvalsTotal", "Instancias de aprobación", totalApprovals);
        break;
      }
      case "documents": {
        const totalDocuments = await this.prisma.document.count({
          where: {
            deletedAt: null,
            ...(restrictToAssignedWorks ? { OR: [{ workId: null }, { work: workFilter }] } : {}),
          },
        });
        push("documentTotal", "Documentos totales", totalDocuments);
        break;
      }
      default:
        break;
    }

    return {
      module: normalizedModule,
      generatedAt: new Date().toISOString(),
      authorized: true,
      cards,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        dueAt: alert.dueAt,
        workCode: alert.work?.code,
        workName: alert.work?.name,
      })),
      byWork,
    };
  }

}
