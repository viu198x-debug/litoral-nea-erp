import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MovementDirection, RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCashBoxDto,
  CreateTreasuryAccountDto,
  ReconcileAccountDto,
  TreasuryTransferDto,
  UpdateTreasuryAccountDto,
} from "./treasury.dto";

@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(companyId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [accounts, boxes, movements] = await Promise.all([
      this.prisma.bankAccount.findMany({ where: { active: true } }),
      this.prisma.cashBox.findMany({ where: { active: true } }),
      this.prisma.financialMovement.findMany({
        where: {
          deletedAt: null,
          occurredAt: { gte: since },
          OR: [{ workId: null }, { work: { companyId } }],
        },
        select: { direction: true, amount: true },
      }),
    ]);

    const incomes = movements
      .filter((row) => row.direction === MovementDirection.IN)
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const expenses = movements
      .filter((row) => row.direction === MovementDirection.OUT)
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const bankAvailable = accounts.reduce((sum, row) => sum + Number(row.bankBalance), 0);
    const accountingBank = accounts.reduce((sum, row) => sum + Number(row.accountingBalance), 0);
    const cashAvailable = boxes.reduce((sum, row) => sum + Number(row.balance), 0);
    const reconciliationDifference = accounts.reduce(
      (sum, row) => sum + Math.abs(Number(row.bankBalance) - Number(row.accountingBalance)),
      0,
    );

    return {
      generatedAt: new Date().toISOString(),
      balances: {
        bankAndWallets: bankAvailable,
        cash: cashAvailable,
        totalAvailable: bankAvailable + cashAvailable,
        accountingBank,
        reconciliationDifference,
      },
      flow30d: {
        incomes,
        expenses,
        net: incomes - expenses,
      },
      counters: {
        accounts: accounts.length,
        cashBoxes: boxes.length,
        unreconciledAccounts: accounts.filter(
          (row) => Math.abs(Number(row.bankBalance) - Number(row.accountingBalance)) > 0.005,
        ).length,
      },
    };
  }

  async accounts(search?: string) {
    const term = search?.trim();
    const rows = await this.prisma.bankAccount.findMany({
      where: term
        ? {
            OR: [
              { bankName: { contains: term, mode: "insensitive" } },
              { accountName: { contains: term, mode: "insensitive" } },
              { accountNumber: { contains: term, mode: "insensitive" } },
              { cbu: { contains: term, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: [{ active: "desc" }, { bankName: "asc" }, { accountName: "asc" }],
    });
    return rows.map((row) => {
      const wallet = row.bankName.startsWith("WALLET:");
      const encoded = this.decodeBankDetails(row.cbu);
      return {
        id: row.id,
        type: wallet ? "WALLET" : "BANK",
        institution: wallet ? row.bankName.slice(7) : row.bankName,
        accountName: row.accountName,
        accountNumber: row.accountNumber,
        cbuOrCvu: encoded.cbuOrCvu,
        alias: encoded.alias,
        currency: row.currency,
        availableBalance: Number(row.bankBalance),
        accountingBalance: Number(row.accountingBalance),
        difference: Number(row.bankBalance) - Number(row.accountingBalance),
        active: row.active,
      };
    });
  }

  async createAccount(dto: CreateTreasuryAccountDto) {
    const accountNumber = dto.accountNumber.trim();
    const existing = await this.prisma.bankAccount.findUnique({ where: { accountNumber } });
    if (existing) throw new BadRequestException("Ya existe una cuenta con ese número / identificador");
    const openingBalance = dto.openingBalance ?? 0;
    const row = await this.prisma.bankAccount.create({
      data: {
        bankName: dto.type === "WALLET" ? `WALLET:${dto.institution.trim()}` : dto.institution.trim(),
        accountName: dto.accountName.trim(),
        accountNumber,
        cbu: this.encodeBankDetails(dto.cbuOrCvu, dto.alias),
        currency: dto.currency?.trim().toUpperCase() || "ARS",
        bankBalance: openingBalance,
        accountingBalance: openingBalance,
        active: true,
      },
    });
    return { id: row.id, accountNumber: row.accountNumber };
  }

  async updateAccount(id: string, dto: UpdateTreasuryAccountDto) {
    const current = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Cuenta de tesorería no encontrada");
    const currentDetails = this.decodeBankDetails(current.cbu);
    const wallet = current.bankName.startsWith("WALLET:");
    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        bankName: dto.institution === undefined
          ? undefined
          : wallet
            ? `WALLET:${dto.institution.trim()}`
            : dto.institution.trim(),
        accountName: dto.accountName?.trim(),
        cbu: dto.cbuOrCvu === undefined && dto.alias === undefined
          ? undefined
          : this.encodeBankDetails(
              dto.cbuOrCvu ?? currentDetails.cbuOrCvu,
              dto.alias ?? currentDetails.alias,
            ),
        currency: dto.currency?.trim().toUpperCase(),
        active: dto.active,
      },
    });
  }

  cashBoxes() {
    return this.prisma.cashBox.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  }

  async createCashBox(companyId: string, dto: CreateCashBoxDto) {
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    const existing = await this.prisma.cashBox.findUnique({ where: { code: dto.code.trim().toUpperCase() } });
    if (existing) throw new BadRequestException("Ya existe una caja con ese código");
    return this.prisma.cashBox.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        workId: dto.workId,
        balance: dto.openingBalance ?? 0,
        active: true,
      },
    });
  }

  async transfer(companyId: string, userId: string, dto: TreasuryTransferDto) {
    if (dto.source === dto.destination) throw new BadRequestException("Origen y destino deben ser diferentes");
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    const source = await this.resolveTreasuryRef(dto.source);
    const destination = await this.resolveTreasuryRef(dto.destination);
    const amount = Number(dto.amount);
    const concept = dto.concept?.trim() || "Transferencia interna de tesorería";
    const reference = dto.reference?.trim() || `TR-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const sourceBalance = source.kind === "BANK"
        ? Number(source.account.bankBalance)
        : Number(source.box.balance);
      if (sourceBalance < amount) throw new BadRequestException("Saldo insuficiente en la cuenta/caja de origen");

      if (source.kind === "BANK") {
        await tx.bankAccount.update({
          where: { id: source.account.id },
          data: {
            bankBalance: { decrement: amount },
            accountingBalance: { decrement: amount },
          },
        });
      } else {
        await tx.cashBox.update({ where: { id: source.box.id }, data: { balance: { decrement: amount } } });
      }

      if (destination.kind === "BANK") {
        await tx.bankAccount.update({
          where: { id: destination.account.id },
          data: {
            bankBalance: { increment: amount },
            accountingBalance: { increment: amount },
          },
        });
      } else {
        await tx.cashBox.update({ where: { id: destination.box.id }, data: { balance: { increment: amount } } });
      }

      const out = await tx.financialMovement.create({
        data: {
          workId: dto.workId,
          cashBoxId: source.kind === "CASH" ? source.box.id : undefined,
          bankAccountId: source.kind === "BANK" ? source.account.id : undefined,
          direction: MovementDirection.OUT,
          type: "TRANSFER_INTERNAL",
          concept,
          amount,
          counterparty: this.refLabel(destination),
          reference,
          createdById: userId,
        },
      });
      const incoming = await tx.financialMovement.create({
        data: {
          workId: dto.workId,
          cashBoxId: destination.kind === "CASH" ? destination.box.id : undefined,
          bankAccountId: destination.kind === "BANK" ? destination.account.id : undefined,
          direction: MovementDirection.IN,
          type: "TRANSFER_INTERNAL",
          concept,
          amount,
          counterparty: this.refLabel(source),
          reference,
          createdById: userId,
        },
      });
      await tx.genericRecord.create({
        data: {
          module: "treasury-transfer",
          workId: dto.workId,
          code: reference,
          title: concept,
          status: RecordStatus.CLOSED,
          amount,
          occurredAt: new Date(),
          data: {
            source: dto.source,
            destination: dto.destination,
            sourceMovementId: out.id,
            destinationMovementId: incoming.id,
          },
          createdById: userId,
        },
      });
      return { reference, sourceMovementId: out.id, destinationMovementId: incoming.id };
    });
  }

  async reconcile(userId: string, id: string, dto: ReconcileAccountDto) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException("Cuenta bancaria / billetera no encontrada");
    const previous = Number(account.bankBalance);
    const statementBalance = Number(dto.statementBalance);
    const difference = statementBalance - Number(account.accountingBalance);
    const date = dto.statementDate ? new Date(dto.statementDate) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException("Fecha de extracto inválida");

    return this.prisma.$transaction(async (tx) => {
      await tx.bankAccount.update({ where: { id }, data: { bankBalance: statementBalance } });
      const record = await tx.genericRecord.create({
        data: {
          module: "treasury-reconciliation",
          code: `CONC-${Date.now()}`,
          title: `Conciliación · ${account.bankName} · ${account.accountName}`,
          status: Math.abs(difference) <= 0.005 ? RecordStatus.CLOSED : RecordStatus.PENDING,
          amount: Math.abs(difference),
          occurredAt: date,
          data: {
            accountId: id,
            previousBankBalance: previous,
            statementBalance,
            accountingBalance: Number(account.accountingBalance),
            difference,
            reference: dto.reference ?? null,
            notes: dto.notes ?? null,
          },
          createdById: userId,
        },
      });
      return { reconciliationId: record.id, difference, reconciled: Math.abs(difference) <= 0.005 };
    });
  }

  async recentMovements(companyId: string, limit = 100) {
    return this.prisma.financialMovement.findMany({
      where: {
        deletedAt: null,
        OR: [{ workId: null }, { work: { companyId } }],
      },
      include: {
        work: { select: { code: true, name: true } },
        bankAccount: { select: { id: true, bankName: true, accountName: true, accountNumber: true } },
        cashBox: { select: { id: true, code: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  private async resolveTreasuryRef(ref: string) {
    const [kind, id] = ref.split(":", 2);
    if (!id) throw new BadRequestException("Referencia de tesorería inválida");
    if (kind === "BANK") {
      const account = await this.prisma.bankAccount.findFirst({ where: { id, active: true } });
      if (!account) throw new NotFoundException("Cuenta bancaria / billetera no encontrada");
      return { kind: "BANK" as const, account };
    }
    if (kind === "CASH") {
      const box = await this.prisma.cashBox.findFirst({ where: { id, active: true } });
      if (!box) throw new NotFoundException("Caja no encontrada");
      return { kind: "CASH" as const, box };
    }
    throw new BadRequestException("Referencia de tesorería inválida");
  }

  private refLabel(ref: Awaited<ReturnType<TreasuryService["resolveTreasuryRef"]>>) {
    return ref.kind === "BANK"
      ? `${ref.account.bankName} · ${ref.account.accountName}`
      : ref.box.name;
  }

  private encodeBankDetails(cbuOrCvu?: string, alias?: string) {
    const cbu = cbuOrCvu?.trim() || "";
    const a = alias?.trim() || "";
    if (!cbu && !a) return undefined;
    return `ID:${cbu}|ALIAS:${a}`;
  }

  private decodeBankDetails(encoded?: string | null) {
    if (!encoded) return { cbuOrCvu: "", alias: "" };
    if (!encoded.startsWith("ID:")) return { cbuOrCvu: encoded, alias: "" };
    const [idPart = "", aliasPart = ""] = encoded.split("|", 2);
    return {
      cbuOrCvu: idPart.replace(/^ID:/, ""),
      alias: aliasPart.replace(/^ALIAS:/, ""),
    };
  }

  private async requireWork(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({ where: { id: workId, companyId, deletedAt: null }, select: { id: true } });
    if (!work) throw new NotFoundException("Obra no encontrada");
  }
}
