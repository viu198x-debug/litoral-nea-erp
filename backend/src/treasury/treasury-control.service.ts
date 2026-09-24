import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  RecordStatus,
  TreasuryAccountType,
  TreasuryCashCountStatus,
  TreasuryChequeKind,
  TreasuryChequeStatus,
  TreasuryMovementStatus,
  TreasuryMovementType,
  TreasuryReconciliationStatus,
} from "@prisma/client";
import type { AuthUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateCashCountDto,
  CreateDailyCloseDto,
  CreateReconciliationDto,
  CreateTreasuryAccountDto,
  CreateTreasuryChequeDto,
  CreateTreasuryMovementDto,
  UpdateChequeStatusDto,
  UpdateTreasuryAccountDto,
} from "./treasury-control.dto";

const debitTypes = new Set<TreasuryMovementType>([
  TreasuryMovementType.EXPENSE,
  TreasuryMovementType.TRANSFER,
  TreasuryMovementType.WITHDRAWAL,
  TreasuryMovementType.FEE,
  TreasuryMovementType.CHECK_ISSUE,
  TreasuryMovementType.CHECK_PAYMENT,
]);

const creditTypes = new Set<TreasuryMovementType>([
  TreasuryMovementType.INCOME,
  TreasuryMovementType.TRANSFER,
  TreasuryMovementType.DEPOSIT,
  TreasuryMovementType.INTEREST,
  TreasuryMovementType.CHECK_RECEIPT,
  TreasuryMovementType.CHECK_DEPOSIT,
]);

const postedStatuses = new Set<TreasuryMovementStatus>([
  TreasuryMovementStatus.EXECUTED,
  TreasuryMovementStatus.RECONCILED,
]);

const chequeTransitions: Record<TreasuryChequeStatus, TreasuryChequeStatus[]> = {
  PORTFOLIO: [TreasuryChequeStatus.DEPOSITED, TreasuryChequeStatus.ENDORSED, TreasuryChequeStatus.CANCELLED],
  ISSUED: [TreasuryChequeStatus.CLEARED, TreasuryChequeStatus.REJECTED, TreasuryChequeStatus.CANCELLED, TreasuryChequeStatus.DEFERRED],
  RECEIVED: [TreasuryChequeStatus.PORTFOLIO, TreasuryChequeStatus.DEPOSITED, TreasuryChequeStatus.ENDORSED, TreasuryChequeStatus.REJECTED],
  DEPOSITED: [TreasuryChequeStatus.CLEARED, TreasuryChequeStatus.REJECTED],
  DEFERRED: [TreasuryChequeStatus.CLEARED, TreasuryChequeStatus.REJECTED, TreasuryChequeStatus.CANCELLED],
  CLEARED: [],
  REJECTED: [],
  CANCELLED: [],
  ENDORSED: [TreasuryChequeStatus.CLEARED, TreasuryChequeStatus.REJECTED],
};

const decimal = (value: Prisma.Decimal | number | string | null | undefined) =>
  Number(value ?? 0);

@Injectable()
export class TreasuryControlService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(companyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [accounts, movements, cheques, pendingApprovals, unreconciled] = await Promise.all([
      this.prisma.treasuryAccount.findMany({
        where: { companyId, active: true, deletedAt: null },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      this.prisma.treasuryMovement.findMany({
        where: { companyId, deletedAt: null, occurredAt: { gte: today } },
        orderBy: { occurredAt: "desc" },
        include: { sourceAccount: true, destinationAccount: true, work: { select: { code: true, name: true } } },
        take: 30,
      }),
      this.prisma.treasuryCheque.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: { in: [TreasuryChequeStatus.PORTFOLIO, TreasuryChequeStatus.ISSUED, TreasuryChequeStatus.RECEIVED, TreasuryChequeStatus.DEPOSITED, TreasuryChequeStatus.DEFERRED] },
        },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),
      this.prisma.treasuryMovement.count({ where: { companyId, status: TreasuryMovementStatus.PENDING, deletedAt: null } }),
      this.prisma.treasuryMovement.count({ where: { companyId, status: TreasuryMovementStatus.EXECUTED, deletedAt: null } }),
    ]);
    const totals = Object.fromEntries(Object.values(TreasuryAccountType).map((type) => [
      type,
      accounts.filter((account) => account.type === type && account.includeInCashPosition).reduce((sum, account) => sum + decimal(account.balance), 0),
    ]));
    return {
      position: {
        total: Object.values(totals).reduce((sum, value) => sum + Number(value), 0),
        byType: totals,
        available: accounts.reduce((sum, account) => sum + decimal(account.availableBalance), 0),
      },
      today: {
        income: movements.filter((movement) => postedStatuses.has(movement.status) && creditTypes.has(movement.type) && movement.type !== TreasuryMovementType.TRANSFER).reduce((sum, movement) => sum + decimal(movement.amount), 0),
        expense: movements.filter((movement) => postedStatuses.has(movement.status) && debitTypes.has(movement.type) && movement.type !== TreasuryMovementType.TRANSFER).reduce((sum, movement) => sum + decimal(movement.amount), 0),
      },
      pendingApprovals,
      unreconciled,
      accounts,
      movements,
      cheques,
    };
  }

  accounts(companyId: string, type?: string) {
    const accountType = type && Object.values(TreasuryAccountType).includes(type as TreasuryAccountType)
      ? type as TreasuryAccountType
      : undefined;
    if (type && !accountType) throw new BadRequestException("Tipo de cuenta no válido");
    return this.prisma.treasuryAccount.findMany({
      where: { companyId, type: accountType, deletedAt: null },
      orderBy: [{ active: "desc" }, { type: "asc" }, { name: "asc" }],
    });
  }

  createAccount(companyId: string, dto: CreateTreasuryAccountDto) {
    const opening = new Prisma.Decimal(dto.openingBalance ?? 0);
    const overdraft = new Prisma.Decimal(dto.overdraftLimit ?? 0);
    return this.prisma.treasuryAccount.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        institution: dto.institution,
        accountNumber: dto.accountNumber,
        cbu: dto.cbu,
        alias: dto.alias,
        holderName: dto.holderName,
        holderTaxId: dto.holderTaxId,
        currency: dto.currency ?? "ARS",
        balance: opening,
        availableBalance: opening.plus(overdraft),
        overdraftLimit: overdraft,
        treasurerId: dto.treasurerId,
        includeInCashPosition: dto.includeInCashPosition ?? true,
        active: dto.active ?? true,
      },
    });
  }

  async updateAccount(companyId: string, id: string, dto: UpdateTreasuryAccountDto) {
    await this.requireAccount(companyId, id, false);
    const { openingBalance: _openingBalance, overdraftLimit, ...changes } = dto;
    if (_openingBalance !== undefined) {
      throw new BadRequestException("El saldo sólo se modifica mediante movimientos o ajustes auditados");
    }
    const current = await this.prisma.treasuryAccount.findUniqueOrThrow({ where: { id } });
    return this.prisma.treasuryAccount.update({
      where: { id },
      data: {
        ...changes,
        overdraftLimit,
        availableBalance: overdraftLimit === undefined
          ? undefined
          : new Prisma.Decimal(current.balance).plus(overdraftLimit),
      },
    });
  }

  movements(companyId: string, filters: { status?: string; accountId?: string }) {
    const status = filters.status && Object.values(TreasuryMovementStatus).includes(filters.status as TreasuryMovementStatus)
      ? filters.status as TreasuryMovementStatus
      : undefined;
    if (filters.status && !status) throw new BadRequestException("Estado de movimiento no válido");
    return this.prisma.treasuryMovement.findMany({
      where: {
        companyId,
        status,
        deletedAt: null,
        ...(filters.accountId ? { OR: [{ sourceAccountId: filters.accountId }, { destinationAccountId: filters.accountId }] } : {}),
      },
      include: { sourceAccount: true, destinationAccount: true, cheque: true, work: { select: { code: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 300,
    });
  }

  async createMovement(companyId: string, userId: string, dto: CreateTreasuryMovementDto) {
    const needsSource = debitTypes.has(dto.type);
    const needsDestination = creditTypes.has(dto.type);
    if (needsSource && !dto.sourceAccountId) throw new BadRequestException("El movimiento requiere una cuenta de origen");
    if (needsDestination && !dto.destinationAccountId) throw new BadRequestException("El movimiento requiere una cuenta de destino");
    if (dto.type === TreasuryMovementType.ADJUSTMENT && !dto.sourceAccountId && !dto.destinationAccountId) {
      throw new BadRequestException("El ajuste requiere una cuenta afectada");
    }
    if (dto.sourceAccountId && dto.sourceAccountId === dto.destinationAccountId) {
      throw new BadRequestException("Las cuentas de origen y destino deben ser diferentes");
    }
    await Promise.all([
      dto.sourceAccountId ? this.requireAccount(companyId, dto.sourceAccountId) : null,
      dto.destinationAccountId ? this.requireAccount(companyId, dto.destinationAccountId) : null,
      dto.workId ? this.requireWork(companyId, dto.workId) : null,
      dto.chequeId ? this.requireCheque(companyId, dto.chequeId) : null,
    ]);
    return this.prisma.treasuryMovement.create({
      data: {
        companyId,
        workId: dto.workId,
        sourceAccountId: dto.sourceAccountId,
        destinationAccountId: dto.destinationAccountId,
        chequeId: dto.chequeId,
        type: dto.type,
        status: TreasuryMovementStatus.PENDING,
        concept: dto.concept,
        amount: dto.amount,
        currency: dto.currency ?? "ARS",
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        valueDate: dto.valueDate ? new Date(dto.valueDate) : undefined,
        counterpartyType: dto.counterpartyType,
        counterparty: dto.counterparty,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        receiptNumber: dto.receiptNumber,
        notes: dto.notes,
        createdById: userId,
      },
      include: { sourceAccount: true, destinationAccount: true },
    });
  }

  async approveMovement(companyId: string, id: string, user: AuthUser, comments?: string) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.treasuryMovement.findFirst({
        where: { id, companyId, status: TreasuryMovementStatus.PENDING, deletedAt: null },
      });
      if (!movement) throw new NotFoundException("Movimiento pendiente no encontrado");
      if (movement.createdById === user.id && !user.roleCodes.includes("ADMIN_GENERAL")) {
        throw new ForbiddenException("Quien registra el movimiento no puede aprobarlo");
      }
      const amount = new Prisma.Decimal(movement.amount);
      if (movement.sourceAccountId) {
        const source = await tx.treasuryAccount.findFirst({ where: { id: movement.sourceAccountId, companyId, active: true, deletedAt: null } });
        if (!source) throw new NotFoundException("Cuenta de origen no disponible");
        if (new Prisma.Decimal(source.balance).minus(amount).lt(new Prisma.Decimal(source.overdraftLimit).negated())) {
          throw new BadRequestException("Saldo y descubierto insuficientes");
        }
        await tx.treasuryAccount.update({ where: { id: source.id }, data: { balance: { decrement: amount }, availableBalance: { decrement: amount } } });
      }
      if (movement.destinationAccountId) {
        const destination = await tx.treasuryAccount.findFirst({ where: { id: movement.destinationAccountId, companyId, active: true, deletedAt: null } });
        if (!destination) throw new NotFoundException("Cuenta de destino no disponible");
        await tx.treasuryAccount.update({ where: { id: destination.id }, data: { balance: { increment: amount }, availableBalance: { increment: amount } } });
      }
      return tx.treasuryMovement.update({
        where: { id },
        data: {
          status: TreasuryMovementStatus.EXECUTED,
          approvedById: user.id,
          approvedAt: new Date(),
          notes: comments ? [movement.notes, `Aprobación: ${comments}`].filter(Boolean).join("\n") : movement.notes,
        },
        include: { sourceAccount: true, destinationAccount: true, cheque: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async voidMovement(companyId: string, id: string, userId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.treasuryMovement.findFirst({
        where: { id, companyId, status: TreasuryMovementStatus.EXECUTED, deletedAt: null },
      });
      if (!movement) throw new NotFoundException("Movimiento ejecutado no encontrado o ya conciliado");
      const amount = new Prisma.Decimal(movement.amount);
      if (movement.sourceAccountId) {
        await tx.treasuryAccount.update({ where: { id: movement.sourceAccountId }, data: { balance: { increment: amount }, availableBalance: { increment: amount } } });
      }
      if (movement.destinationAccountId) {
        const destination = await tx.treasuryAccount.findFirst({ where: { id: movement.destinationAccountId, companyId, active: true, deletedAt: null } });
        if (!destination) throw new NotFoundException("Cuenta de destino no disponible");
        if (new Prisma.Decimal(destination.balance).minus(amount).lt(new Prisma.Decimal(destination.overdraftLimit).negated())) {
          throw new BadRequestException("La reversión excede el saldo y descubierto de la cuenta de destino");
        }
        await tx.treasuryAccount.update({ where: { id: movement.destinationAccountId }, data: { balance: { decrement: amount }, availableBalance: { decrement: amount } } });
      }
      return tx.treasuryMovement.update({
        where: { id },
        data: { status: TreasuryMovementStatus.VOID, voidedById: userId, voidedAt: new Date(), voidReason: reason },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  cheques(companyId: string, status?: string) {
    const chequeStatus = status && Object.values(TreasuryChequeStatus).includes(status as TreasuryChequeStatus)
      ? status as TreasuryChequeStatus
      : undefined;
    if (status && !chequeStatus) throw new BadRequestException("Estado de cheque no válido");
    return this.prisma.treasuryCheque.findMany({
      where: { companyId, status: chequeStatus, deletedAt: null },
      include: { account: true, work: { select: { code: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { amount: "desc" }],
      take: 300,
    });
  }

  async createCheque(companyId: string, userId: string, dto: CreateTreasuryChequeDto) {
    if (dto.accountId) await this.requireAccount(companyId, dto.accountId);
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    if (new Date(dto.dueDate) < new Date(dto.issueDate)) {
      throw new BadRequestException("La fecha de pago no puede ser anterior a la emisión");
    }
    const initialStatus = dto.status ?? (dto.kind === TreasuryChequeKind.OWN ? TreasuryChequeStatus.ISSUED : TreasuryChequeStatus.RECEIVED);
    const allowedInitial: TreasuryChequeStatus[] = dto.kind === TreasuryChequeKind.OWN
      ? [TreasuryChequeStatus.ISSUED, TreasuryChequeStatus.DEFERRED]
      : [TreasuryChequeStatus.RECEIVED, TreasuryChequeStatus.PORTFOLIO];
    if (!allowedInitial.includes(initialStatus)) {
      throw new BadRequestException("Estado inicial incompatible con el tipo de cheque");
    }
    return this.prisma.treasuryCheque.create({
      data: {
        companyId,
        accountId: dto.accountId,
        workId: dto.workId,
        kind: dto.kind,
        status: initialStatus,
        number: dto.number,
        bankName: dto.bankName,
        branch: dto.branch,
        accountNumber: dto.accountNumber,
        issuerName: dto.issuerName,
        issuerTaxId: dto.issuerTaxId,
        beneficiary: dto.beneficiary,
        amount: dto.amount,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : dto.kind === TreasuryChequeKind.THIRD_PARTY ? new Date() : undefined,
        endorsementChain: (dto.endorsementChain ?? []) as Prisma.InputJsonValue,
        notes: dto.notes,
        createdById: userId,
      },
    });
  }

  async updateChequeStatus(companyId: string, id: string, dto: UpdateChequeStatusDto) {
    const cheque = await this.requireCheque(companyId, id);
    if (!chequeTransitions[cheque.status].includes(dto.status)) {
      throw new BadRequestException(`Transición de ${cheque.status} a ${dto.status} no permitida`);
    }
    const now = new Date();
    return this.prisma.treasuryCheque.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes ? [cheque.notes, dto.notes].filter(Boolean).join("\n") : cheque.notes,
        depositedAt: dto.status === TreasuryChequeStatus.DEPOSITED ? now : undefined,
        clearedAt: dto.status === TreasuryChequeStatus.CLEARED ? now : undefined,
        rejectedAt: dto.status === TreasuryChequeStatus.REJECTED ? now : undefined,
      },
    });
  }

  reconciliations(companyId: string) {
    return this.prisma.treasuryReconciliation.findMany({
      where: { account: { companyId, deletedAt: null } },
      include: { account: true, items: true },
      orderBy: { periodTo: "desc" },
      take: 100,
    });
  }

  async createReconciliation(companyId: string, userId: string, dto: CreateReconciliationDto) {
    await this.requireAccount(companyId, dto.accountId);
    if (new Date(dto.periodTo) < new Date(dto.periodFrom)) {
      throw new BadRequestException("El fin de la conciliación no puede ser anterior al inicio");
    }
    const difference = new Prisma.Decimal(dto.statementClosing).minus(dto.bookClosing);
    const matchedIds = dto.items.filter((item) => item.matched && item.movementId).map((item) => item.movementId as string);
    return this.prisma.$transaction(async (tx) => {
      if (matchedIds.length) {
        const matched = await tx.treasuryMovement.count({
          where: {
            id: { in: matchedIds }, companyId, status: TreasuryMovementStatus.EXECUTED, deletedAt: null,
            OR: [{ sourceAccountId: dto.accountId }, { destinationAccountId: dto.accountId }],
          },
        });
        if (matched !== new Set(matchedIds).size) throw new BadRequestException("Hay movimientos conciliados que no pertenecen a la cuenta");
      }
      const reconciliation = await tx.treasuryReconciliation.create({
        data: {
          accountId: dto.accountId,
          periodFrom: new Date(dto.periodFrom),
          periodTo: new Date(dto.periodTo),
          statementOpening: dto.statementOpening,
          statementClosing: dto.statementClosing,
          bookOpening: dto.bookOpening,
          bookClosing: dto.bookClosing,
          difference,
          status: difference.abs().lt(0.01) ? TreasuryReconciliationStatus.BALANCED : TreasuryReconciliationStatus.OPEN,
          createdById: userId,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({
              movementId: item.movementId,
              occurredAt: new Date(item.occurredAt),
              description: item.description,
              statementAmount: item.statementAmount,
              bookAmount: item.bookAmount,
              difference: new Prisma.Decimal(item.statementAmount).minus(item.bookAmount),
              matched: item.matched ?? false,
              notes: item.notes,
            })),
          },
        },
        include: { account: true, items: true },
      });
      if (matchedIds.length) {
        await tx.treasuryMovement.updateMany({
          where: { id: { in: matchedIds }, companyId, status: TreasuryMovementStatus.EXECUTED },
          data: { status: TreasuryMovementStatus.RECONCILED, reconciledAt: new Date() },
        });
      }
      return reconciliation;
    });
  }

  async createCashCount(companyId: string, userId: string, dto: CreateCashCountDto) {
    const account = await this.requireAccount(companyId, dto.accountId);
    if (account.type !== TreasuryAccountType.CASH) throw new BadRequestException("El arqueo sólo corresponde a cuentas de efectivo");
    const denominationTotal = dto.denominations.reduce((sum, item) => {
      const calculated = Number(item.denomination) * Number(item.quantity);
      if (Math.abs(calculated - Number(item.subtotal)) > 0.01) {
        throw new BadRequestException("El subtotal de una denominación no coincide con cantidad por valor");
      }
      return sum + calculated;
    }, 0);
    if (Math.abs(denominationTotal - Number(dto.countedBalance)) > 0.01) {
      throw new BadRequestException("El detalle de denominaciones no coincide con el total contado");
    }
    const difference = new Prisma.Decimal(dto.countedBalance).minus(account.balance);
    return this.prisma.treasuryCashCount.create({
      data: {
        accountId: account.id,
        expectedBalance: account.balance,
        countedBalance: dto.countedBalance,
        difference,
        denominations: dto.denominations as unknown as Prisma.InputJsonValue,
        status: TreasuryCashCountStatus.CLOSED,
        countedById: userId,
        notes: dto.notes,
      },
      include: { account: true },
    });
  }

  async createDailyClose(companyId: string, userId: string, dto: CreateDailyCloseDto) {
    const closedDate = new Date(dto.closedDate);
    closedDate.setUTCHours(0, 0, 0, 0);
    const end = new Date(closedDate);
    end.setUTCDate(end.getUTCDate() + 1);
    const [accounts, movements, pendingCheques] = await Promise.all([
      this.prisma.treasuryAccount.findMany({ where: { companyId, active: true, deletedAt: null, includeInCashPosition: true } }),
      this.prisma.treasuryMovement.findMany({ where: { companyId, occurredAt: { gte: closedDate, lt: end }, status: { in: [TreasuryMovementStatus.EXECUTED, TreasuryMovementStatus.RECONCILED] }, deletedAt: null } }),
      this.prisma.treasuryCheque.aggregate({ where: { companyId, status: { in: [TreasuryChequeStatus.PORTFOLIO, TreasuryChequeStatus.ISSUED, TreasuryChequeStatus.RECEIVED, TreasuryChequeStatus.DEPOSITED, TreasuryChequeStatus.DEFERRED] }, deletedAt: null }, _sum: { amount: true } }),
    ]);
    const byType = (type: TreasuryAccountType) => accounts.filter((account) => account.type === type).reduce((sum, account) => sum + decimal(account.balance), 0);
    const totalIncome = movements.filter((movement) => creditTypes.has(movement.type) && movement.type !== TreasuryMovementType.TRANSFER).reduce((sum, movement) => sum + decimal(movement.amount), 0);
    const totalExpense = movements.filter((movement) => debitTypes.has(movement.type) && movement.type !== TreasuryMovementType.TRANSFER).reduce((sum, movement) => sum + decimal(movement.amount), 0);
    const closingPosition = accounts.reduce((sum, account) => sum + decimal(account.balance), 0);
    return this.prisma.treasuryDailyClose.upsert({
      where: { companyId_closedDate: { companyId, closedDate } },
      update: {
        openingPosition: closingPosition - totalIncome + totalExpense,
        totalIncome, totalExpense, closingPosition,
        bankBalance: byType(TreasuryAccountType.BANK_CURRENT),
        savingsBalance: byType(TreasuryAccountType.BANK_SAVINGS),
        walletBalance: byType(TreasuryAccountType.VIRTUAL_WALLET),
        cashBalance: byType(TreasuryAccountType.CASH),
        pendingCheques: decimal(pendingCheques._sum.amount),
        closedById: userId, notes: dto.notes, status: RecordStatus.CLOSED,
      },
      create: {
        companyId, closedDate,
        openingPosition: closingPosition - totalIncome + totalExpense,
        totalIncome, totalExpense, closingPosition,
        bankBalance: byType(TreasuryAccountType.BANK_CURRENT),
        savingsBalance: byType(TreasuryAccountType.BANK_SAVINGS),
        walletBalance: byType(TreasuryAccountType.VIRTUAL_WALLET),
        cashBalance: byType(TreasuryAccountType.CASH),
        pendingCheques: decimal(pendingCheques._sum.amount),
        closedById: userId, notes: dto.notes, status: RecordStatus.CLOSED,
      },
    });
  }

  private async requireAccount(companyId: string, id: string, active = true) {
    const account = await this.prisma.treasuryAccount.findFirst({
      where: { id, companyId, deletedAt: null, ...(active ? { active: true } : {}) },
    });
    if (!account) throw new NotFoundException("Cuenta de tesorería no encontrada");
    return account;
  }

  private async requireCheque(companyId: string, id: string) {
    const cheque = await this.prisma.treasuryCheque.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!cheque) throw new NotFoundException("Cheque no encontrado");
    return cheque;
  }

  private async requireWork(companyId: string, id: string) {
    const work = await this.prisma.work.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!work) throw new NotFoundException("Obra no encontrada");
  }
}
