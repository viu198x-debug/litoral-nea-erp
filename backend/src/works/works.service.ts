import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, WorkStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateWorkDto } from "./dto/create-work.dto";
import type { UpdateWorkDto } from "./dto/update-work.dto";

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    companyId: string,
    filters: { status?: WorkStatus; search?: string },
  ) {
    const search = filters.search?.trim().slice(0, 120);
    return this.prisma.work.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: filters.status,
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { client: true },
      orderBy: { code: "asc" },
    });
  }

  async get(companyId: string, id: string) {
    const work = await this.prisma.work.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        client: true,
        members: { include: { user: true } },
        documents: {
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 10,
        },
      },
    });
    if (!work) throw new NotFoundException("Obra no encontrada");
    return work;
  }

  async create(companyId: string, dto: CreateWorkDto) {
    const { clientName, organizationType, ...workData } = dto;
    return this.prisma.$transaction(async (tx) => {
      let clientId = dto.clientId;
      if (!clientId && clientName) {
        const existing = await tx.organization.findFirst({
          where: {
            legalName: { equals: clientName, mode: "insensitive" },
            deletedAt: null,
          },
          select: { id: true },
        });
        clientId = existing?.id ?? (await tx.organization.create({
          data: {
            legalName: clientName,
            type: organizationType ?? "PRIVATE",
          },
          select: { id: true },
        })).id;
      }
      return tx.work.create({
        data: {
          ...workData,
          clientId,
          companyId,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          contractualEndDate: dto.contractualEndDate
            ? new Date(dto.contractualEndDate)
            : undefined,
        },
      });
    });
  }

  async update(companyId: string, id: string, dto: UpdateWorkDto) {
    await this.get(companyId, id);
    const { clientName, organizationType, ...workData } = dto;
    const data: Prisma.WorkUpdateInput = {
      ...workData,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      contractualEndDate: dto.contractualEndDate
        ? new Date(dto.contractualEndDate)
        : undefined,
    };
    return this.prisma.work.update({ where: { id }, data });
  }

  async softDelete(companyId: string, id: string) {
    await this.get(companyId, id);
    return this.prisma.work.update({
      where: { id },
      data: { deletedAt: new Date(), status: WorkStatus.CANCELLED },
    });
  }

  async dashboard(companyId: string, id: string) {
    const work = await this.get(companyId, id);
    const [
      certificates,
      purchaseOrders,
      dailyReports,
      fuel,
      documents,
      alerts,
      payroll,
    ] = await Promise.all([
      this.prisma.certificate.findMany({
        where: { workId: id, deletedAt: null },
        orderBy: { number: "desc" },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { workId: id, deletedAt: null },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.dailyReport.findMany({
        where: { workId: id, deletedAt: null },
        orderBy: { reportDate: "desc" },
        take: 14,
      }),
      this.prisma.fuelLog.aggregate({
        where: { workId: id },
        _sum: { total: true, liters: true },
      }),
      this.prisma.document.count({
        where: { workId: id, deletedAt: null },
      }),
      this.prisma.alert.findMany({
        where: { workId: id, resolvedAt: null },
        orderBy: { dueAt: "asc" },
      }),
      this.prisma.payroll.aggregate({
        where: { workId: id },
        _sum: { companyCost: true },
      }),
    ]);
    return {
      work,
      certificates,
      metrics: {
        purchases: Number(purchaseOrders._sum.total ?? 0),
        purchaseOrders: purchaseOrders._count,
        fuelCost: Number(fuel._sum.total ?? 0),
        fuelLiters: Number(fuel._sum.liters ?? 0),
        payrollCost: Number(payroll._sum.companyCost ?? 0),
        documents,
      },
      progress: dailyReports,
      alerts,
    };
  }
}
