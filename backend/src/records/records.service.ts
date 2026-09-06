import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
    return this.listConfigured(companyId, module, filters);
  }

  private async listConfigured(
    companyId: string,
    module: string,
    filters: { workId?: string; status?: RecordStatus; search?: string },
  ) {
    await this.requireModule(module);
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
    const configuration = await this.requireModule(module);
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    if (configuration.requiresWork && !dto.workId) {
      throw new NotFoundException("Este módulo requiere seleccionar una obra");
    }
    await this.validateConfiguredData(configuration.id, dto.data ?? {});
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
    const configuration = await this.requireModule(module);
    await this.requireRecord(companyId, module, id);
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    if (dto.data) await this.validateConfiguredData(configuration.id, dto.data);
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

  private async requireModule(slug: string) {
    const module = await this.prisma.moduleConfiguration.findFirst({
      where: { slug, active: true },
      select: { id: true, requiresWork: true },
    });
    if (!module) throw new NotFoundException("Módulo no configurado o inactivo");
    return module;
  }

  private async validateConfiguredData(moduleId: string, value: Record<string, unknown>) {
    const fields = await this.prisma.moduleFieldConfiguration.findMany({
      where: { moduleId, active: true },
      select: { fieldKey: true, label: true, fieldType: true, required: true },
    });
    const allowed = new Set(fields.map((field) => field.fieldKey));
    const unknown = Object.keys(value).filter((key) => key !== "source" && !allowed.has(key));
    if (unknown.length) {
      throw new BadRequestException(`Campos no configurados: ${unknown.join(", ")}`);
    }
    const missing = fields.filter(
      (field) => field.required && (value[field.fieldKey] === undefined || value[field.fieldKey] === ""),
    );
    if (missing.length) {
      throw new BadRequestException(`Faltan campos obligatorios: ${missing.map((field) => field.label).join(", ")}`);
    }
    for (const field of fields) {
      const current = value[field.fieldKey];
      if (current === undefined || current === "") continue;
      if (["number", "currency"].includes(field.fieldType) && !Number.isFinite(Number(current))) {
        throw new BadRequestException(`${field.label} debe ser numérico`);
      }
      if (field.fieldType === "boolean" && typeof current !== "boolean") {
        throw new BadRequestException(`${field.label} debe ser verdadero o falso`);
      }
    }
  }
}
