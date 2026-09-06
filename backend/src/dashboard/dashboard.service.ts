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
}
