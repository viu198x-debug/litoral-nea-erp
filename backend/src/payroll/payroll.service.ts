import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreatePayrollExtraDto,
  PayPayrollBatchDto,
  UpdateEmployeePaymentScheduleDto,
} from "./payroll.dto";

const asObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async employeesWithPaymentSchedule() {
    const employees = await this.prisma.employee.findMany({
      where: { active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return employees.map((employee) => {
      const metadata = asObject(employee.metadata);
      const payment = asObject(metadata.paymentSchedule as Prisma.JsonValue | undefined);
      return {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: `${employee.lastName}, ${employee.firstName}`,
        category: employee.category,
        position: employee.position,
        baseSalary: employee.baseSalary,
        paymentSchedule: {
          frequency: payment.frequency ?? "MONTHLY",
          monthlyDay: payment.monthlyDay ?? 5,
          firstFortnightDay: payment.firstFortnightDay ?? 15,
          secondFortnightDay: payment.secondFortnightDay ?? 30,
          paymentNotes: payment.paymentNotes ?? null,
        },
      };
    });
  }

  async updatePaymentSchedule(employeeId: string, dto: UpdateEmployeePaymentScheduleDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException("Empleado no encontrado");

    const metadata = asObject(employee.metadata);
    const paymentSchedule = {
      frequency: dto.frequency,
      monthlyDay: dto.monthlyDay ?? 5,
      firstFortnightDay: dto.firstFortnightDay ?? 15,
      secondFortnightDay: dto.secondFortnightDay ?? 30,
      paymentNotes: dto.paymentNotes ?? null,
    };

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { metadata: { ...metadata, paymentSchedule } as Prisma.InputJsonValue },
    });
  }

  async createExtra(userId: string, dto: CreatePayrollExtraDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException("Empleado no encontrado");

    const code = `EXT-${dto.period}-${employee.employeeNumber}-${Date.now()}`;
    return this.prisma.genericRecord.create({
      data: {
        module: "payroll-extras",
        workId: dto.workId ?? null,
        code,
        title: dto.concept,
        status: dto.requiresApproval === false ? RecordStatus.APPROVED : RecordStatus.PENDING,
        amount: new Prisma.Decimal(dto.amount),
        occurredAt: new Date(dto.dueDate),
        createdById: userId,
        data: {
          employeeId: dto.employeeId,
          employeeNumber: employee.employeeNumber,
          employeeName: `${employee.lastName}, ${employee.firstName}`,
          period: dto.period,
          concept: dto.concept,
          dueDate: dto.dueDate,
          outsideReceipt: true,
          notes: dto.notes ?? null,
        },
      },
    });
  }

  async extras(period?: string, employeeId?: string) {
    const rows = await this.prisma.genericRecord.findMany({
      where: {
        module: "payroll-extras",
        deletedAt: null,
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    });

    return rows.filter((row) => {
      const data = asObject(row.data);
      return (!period || data.period === period) && (!employeeId || data.employeeId === employeeId);
    });
  }

  async calendar(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(fromDate.getTime() + 45 * 86400000);

    const [payrolls, extras, employees] = await Promise.all([
      this.prisma.payroll.findMany({
        where: { status: { in: [RecordStatus.DRAFT, RecordStatus.PENDING, RecordStatus.APPROVED] } },
        include: { employee: true },
      }),
      this.prisma.genericRecord.findMany({
        where: {
          module: "payroll-extras",
          deletedAt: null,
          status: { in: [RecordStatus.PENDING, RecordStatus.APPROVED, RecordStatus.ACTIVE] },
          occurredAt: { gte: fromDate, lte: toDate },
        },
      }),
      this.prisma.employee.findMany({ where: { active: true } }),
    ]);

    const scheduled = employees.flatMap((employee) => {
      const metadata = asObject(employee.metadata);
      const schedule = asObject(metadata.paymentSchedule as Prisma.JsonValue | undefined);
      const frequency = String(schedule.frequency ?? "MONTHLY");
      const monthlyDay = Number(schedule.monthlyDay ?? 5);
      const first = Number(schedule.firstFortnightDay ?? 15);
      const second = Number(schedule.secondFortnightDay ?? 30);
      const entries: Array<Record<string, unknown>> = [];

      const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      const last = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
      while (cursor <= last) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const maxDay = new Date(year, month + 1, 0).getDate();
        const make = (day: number, label: string) => {
          const date = new Date(year, month, Math.min(day, maxDay));
          if (date >= fromDate && date <= toDate) {
            entries.push({
              type: "SCHEDULED_PAYROLL",
              employeeId: employee.id,
              employeeNumber: employee.employeeNumber,
              employeeName: `${employee.lastName}, ${employee.firstName}`,
              frequency,
              label,
              dueDate: date.toISOString(),
              estimatedAmount: employee.baseSalary,
            });
          }
        };
        if (frequency === "FORTNIGHTLY") {
          make(first, "1ª quincena");
          make(second, "2ª quincena");
        } else {
          make(monthlyDay, "Mensual");
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return entries;
    });

    const payrollRows = payrolls.map((row) => {
      const net = Number(row.baseAmount) + Number(row.additions) + Number(row.overtime) + Number(row.perDiemsAmount) - Number(row.advances) - Number(row.deductions);
      const data = asObject(row.metadata);
      return {
        type: "PAYROLL",
        id: row.id,
        employeeId: row.employeeId,
        employeeName: `${row.employee.lastName}, ${row.employee.firstName}`,
        period: row.period,
        dueDate: data.dueDate ?? null,
        amount: net,
        status: row.status,
      };
    });

    const extraRows = extras.map((row) => ({
      type: "EXTRA",
      id: row.id,
      employeeId: asObject(row.data).employeeId ?? null,
      employeeName: asObject(row.data).employeeName ?? null,
      period: asObject(row.data).period ?? null,
      dueDate: row.occurredAt,
      amount: row.amount,
      status: row.status,
      concept: row.title,
    }));

    return [...scheduled, ...payrollRows, ...extraRows].sort((a, b) =>
      String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")),
    );
  }

  async totals(period?: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: period ? { period } : undefined,
      include: { employee: true },
    });
    const extras = await this.extras(period);

    const payrollTotal = payrolls.reduce((sum, row) =>
      sum + Number(row.baseAmount) + Number(row.additions) + Number(row.overtime) + Number(row.perDiemsAmount) - Number(row.advances) - Number(row.deductions), 0);
    const extrasTotal = extras.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

    const byEmployee = payrolls.map((row) => {
      const receipt = Number(row.baseAmount) + Number(row.additions) + Number(row.overtime) + Number(row.perDiemsAmount) - Number(row.advances) - Number(row.deductions);
      const employeeExtras = extras
        .filter((extra) => asObject(extra.data).employeeId === row.employeeId && extra.status !== RecordStatus.CLOSED)
        .reduce((sum, extra) => sum + Number(extra.amount ?? 0), 0);
      return {
        employeeId: row.employeeId,
        employeeName: `${row.employee.lastName}, ${row.employee.firstName}`,
        receipt,
        extras: employeeExtras,
        total: receipt + employeeExtras,
        status: row.status,
      };
    });

    return { period: period ?? null, payrollTotal, extrasTotal, grandTotal: payrollTotal + extrasTotal, byEmployee };
  }

  async payBatch(companyId: string, userId: string, dto: PayPayrollBatchDto) {
    if (!(["BANK", "CASH"] as const).includes(dto.sourceType)) {
      throw new BadRequestException("Origen de pago no válido");
    }

    const payrollIds = dto.lines.map((line) => line.payrollId);
    const extraIds = dto.lines.flatMap((line) => line.extraIds ?? []);
    const [payrolls, extras] = await Promise.all([
      this.prisma.payroll.findMany({ where: { id: { in: payrollIds } }, include: { employee: true } }),
      extraIds.length ? this.prisma.genericRecord.findMany({ where: { id: { in: extraIds }, module: "payroll-extras", deletedAt: null } }) : Promise.resolve([]),
    ]);

    if (payrolls.length !== payrollIds.length) throw new BadRequestException("Hay recibos inexistentes en el lote");
    if (extraIds.length && extras.length !== extraIds.length) throw new BadRequestException("Hay extras inexistentes en el lote");

    const batchCode = `NOM-${new Date(dto.paidAt).toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now()}`;
    const totals = dto.lines.map((line) => {
      const payroll = payrolls.find((item) => item.id === line.payrollId)!;
      const receipt = Number(payroll.baseAmount) + Number(payroll.additions) + Number(payroll.overtime) + Number(payroll.perDiemsAmount) - Number(payroll.advances) - Number(payroll.deductions);
      const lineExtras = extras.filter((extra) => (line.extraIds ?? []).includes(extra.id));
      const extrasAmount = lineExtras.reduce((sum, extra) => sum + Number(extra.amount ?? 0), 0);
      return { payroll, receipt, extrasAmount, total: receipt + extrasAmount, lineExtras };
    });
    const batchTotal = totals.reduce((sum, line) => sum + line.total, 0);

    return this.prisma.$transaction(async (tx) => {
      if (dto.sourceType === "BANK") {
        const account = await tx.bankAccount.findUnique({ where: { id: dto.sourceId } });
        if (!account || !account.active) throw new BadRequestException("Cuenta bancaria de origen no válida");
        if (Number(account.accountingBalance) < batchTotal) throw new BadRequestException("Saldo bancario insuficiente");
        await tx.bankAccount.update({
          where: { id: dto.sourceId },
          data: { accountingBalance: { decrement: new Prisma.Decimal(batchTotal) }, bankBalance: { decrement: new Prisma.Decimal(batchTotal) } },
        });
      } else {
        const cash = await tx.cashBox.findUnique({ where: { id: dto.sourceId } });
        if (!cash || !cash.active) throw new BadRequestException("Caja de origen no válida");
        if (Number(cash.balance) < batchTotal) throw new BadRequestException("Saldo de caja insuficiente");
        await tx.cashBox.update({ where: { id: dto.sourceId }, data: { balance: { decrement: new Prisma.Decimal(batchTotal) } } });
      }

      const batch = await tx.genericRecord.create({
        data: {
          module: "payroll-batches",
          code: batchCode,
          title: `Lote de pago de personal · ${totals.length} empleado(s)`,
          status: RecordStatus.CLOSED,
          amount: new Prisma.Decimal(batchTotal),
          occurredAt: new Date(dto.paidAt),
          createdById: userId,
          data: {
            companyId,
            sourceType: dto.sourceType,
            sourceId: dto.sourceId,
            employeeCount: totals.length,
            payrollIds,
            extraIds,
            reference: dto.reference ?? null,
            notes: dto.notes ?? null,
          },
        },
      });

      for (const line of totals) {
        await tx.financialMovement.create({
          data: {
            workId: line.payroll.workId,
            bankAccountId: dto.sourceType === "BANK" ? dto.sourceId : null,
            cashBoxId: dto.sourceType === "CASH" ? dto.sourceId : null,
            direction: "OUT",
            type: "PAYROLL_BATCH",
            concept: `Pago de personal ${line.payroll.period} · ${line.payroll.employee.lastName}, ${line.payroll.employee.firstName}`,
            amount: new Prisma.Decimal(line.total),
            occurredAt: new Date(dto.paidAt),
            counterparty: `${line.payroll.employee.lastName}, ${line.payroll.employee.firstName}`,
            reference: `${batchCode}:${line.payroll.id}`,
            createdById: userId,
          },
        });
        await tx.payroll.update({
          where: { id: line.payroll.id },
          data: {
            status: RecordStatus.CLOSED,
            metadata: {
              ...asObject(line.payroll.metadata),
              paidAt: dto.paidAt,
              batchId: batch.id,
              batchCode,
              paidReceiptAmount: line.receipt,
              paidExtrasAmount: line.extrasAmount,
            } as Prisma.InputJsonValue,
          },
        });
        for (const extra of line.lineExtras) {
          await tx.genericRecord.update({
            where: { id: extra.id },
            data: {
              status: RecordStatus.CLOSED,
              data: { ...asObject(extra.data), paidAt: dto.paidAt, batchId: batch.id, batchCode } as Prisma.InputJsonValue,
            },
          });
        }
      }

      await tx.alert.updateMany({
        where: {
          type: { in: ["PAYROLL_DUE", "PAYROLL_AMOUNT"] },
          resolvedAt: null,
          description: { contains: payrollIds[0] ?? "__none__" },
        },
        data: { resolvedAt: new Date(dto.paidAt) },
      });

      return { batchId: batch.id, batchCode, employeeCount: totals.length, total: batchTotal };
    });
  }

  async refreshAlerts(daysAhead = 10) {
    const now = new Date();
    const horizon = new Date(now.getTime() + Math.max(1, Math.min(daysAhead, 60)) * 86400000);
    const payrolls = await this.prisma.payroll.findMany({
      where: { status: { in: [RecordStatus.PENDING, RecordStatus.APPROVED] } },
      include: { employee: true },
    });

    const created = [] as unknown[];
    for (const payroll of payrolls) {
      const metadata = asObject(payroll.metadata);
      const dueDate = metadata.dueDate ? new Date(String(metadata.dueDate)) : null;
      if (!dueDate || dueDate < now || dueDate > horizon) continue;
      const net = Number(payroll.baseAmount) + Number(payroll.additions) + Number(payroll.overtime) + Number(payroll.perDiemsAmount) - Number(payroll.advances) - Number(payroll.deductions);
      const title = `Pago de personal próximo · ${payroll.employee.lastName}, ${payroll.employee.firstName}`;
      const exists = await this.prisma.alert.findFirst({ where: { type: "PAYROLL_DUE", title, dueAt: dueDate, resolvedAt: null } });
      if (!exists) {
        created.push(await this.prisma.alert.create({
          data: {
            workId: payroll.workId,
            type: "PAYROLL_DUE",
            severity: dueDate.getTime() - now.getTime() <= 3 * 86400000 ? "HIGH" : "MEDIUM",
            title,
            description: `Recibo ${payroll.id} · período ${payroll.period} · total previsto $${net.toFixed(2)}`,
            dueAt: dueDate,
          },
        }));
      }
    }
    return { generated: created.length, through: horizon.toISOString() };
  }
}
