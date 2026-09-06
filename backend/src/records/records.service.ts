import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateRecordDto } from "./dto/create-record.dto";
import type { UpdateRecordDto } from "./dto/update-record.dto";

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    companyId: string,
    module: string,
    filters: { workId?: string; status?: RecordStatus; search?: string },
  ) {
    return this.prisma.genericRecord.findMany({
      where: {
        module,
        deletedAt: null,
        workId: filters.workId,
        status: filters.status,
        AND: [
          { OR: [{ workId: null }, { work: { companyId } }] },
          ...(filters.search
            ? [
                {
                  OR: [
                    {
                      code: {
                        contains: filters.search.slice(0, 120),
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      title: {
                        contains: filters.search.slice(0, 120),
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: { work: { select: { code: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async create(
    companyId: string,
    module: string,
    userId: string,
    dto: CreateRecordDto,
  ) {
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    const { occurredAt, data, ...fields } = dto;
    const createData: Prisma.GenericRecordUncheckedCreateInput = {
      ...fields,
      module,
      createdById: userId,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      data: data as Prisma.InputJsonValue | undefined,
    };
    return this.prisma.genericRecord.create({
      data: createData,
    });
  }

  async update(companyId: string, module: string, id: string, dto: UpdateRecordDto) {
    await this.requireRecord(companyId, module, id);
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    const { occurredAt, data, ...fields } = dto;
    const updateData: Prisma.GenericRecordUncheckedUpdateInput = {
      ...fields,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      data: data as Prisma.InputJsonValue | undefined,
    };
    return this.prisma.genericRecord.update({
      where: { id },
      data: updateData,
    });
  }

  async softDelete(companyId: string, module: string, id: string) {
    await this.requireRecord(companyId, module, id);
    return this.prisma.genericRecord.update({
      where: { id },
      data: { deletedAt: new Date(), status: RecordStatus.VOID },
    });
  }

  private async requireRecord(companyId: string, module: string, id: string) {
    const record = await this.prisma.genericRecord.findFirst({
      where: {
        id,
        module,
        deletedAt: null,
        OR: [{ workId: null }, { work: { companyId } }],
      },
    });
    if (!record) throw new NotFoundException("Registro no encontrado");
    return record;
  }

  private async requireWork(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!work) throw new NotFoundException("Obra no encontrada");
  }
}
