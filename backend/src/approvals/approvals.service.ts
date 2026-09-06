import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApprovalStatus, Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import type { DecisionDto } from "./dto/decision.dto";
import type { RequestApprovalDto } from "./dto/request-approval.dto";
import { ERP_MODULES } from "../common/validation.pipes";

interface WorkflowStep {
  role: string;
  label: string;
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  list(companyId: string, filters: { status?: ApprovalStatus; module?: string }) {
    if (filters.module && !ERP_MODULES.has(filters.module)) {
      throw new BadRequestException("Módulo no válido");
    }
    return this.prisma.approvalInstance.findMany({
      where: {
        module: filters.module,
        status: filters.status,
        OR: [{ workId: null }, { work: { companyId } }],
      },
      include: { workflow: true, work: true, decisions: true },
      orderBy: { requestedAt: "desc" },
      take: 200,
    });
  }

  async request(companyId: string, userId: string, dto: RequestApprovalDto) {
    if (!ERP_MODULES.has(dto.module)) {
      throw new BadRequestException("Módulo no válido");
    }
    if (dto.workId) await this.requireWork(companyId, dto.workId);
    const amount = new Prisma.Decimal(dto.amount ?? 0);
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: dto.workflowCode
        ? { code: dto.workflowCode, module: dto.module, active: true }
        : {
            module: dto.module,
            active: true,
            AND: [
              { OR: [{ minAmount: null }, { minAmount: { lte: amount } }] },
              { OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }] },
            ],
          },
      orderBy: { version: "desc" },
    });
    if (!workflow) {
      throw new NotFoundException("No existe un flujo aplicable");
    }
    return this.prisma.approvalInstance.create({
      data: {
        workflowId: workflow.id,
        workId: dto.workId,
        module: dto.module,
        entityType: dto.entityType,
        entityId: dto.entityId,
        requestedById: userId,
      },
      include: { workflow: true },
    });
  }

  async decide(
    companyId: string,
    id: string,
    user: AuthUser,
    dto: DecisionDto,
  ) {
    if (
      dto.decision !== ApprovalStatus.APPROVED &&
      dto.decision !== ApprovalStatus.REJECTED
    ) {
      throw new BadRequestException("La decisión debe aprobar o rechazar");
    }
    const instance = await this.prisma.approvalInstance.findFirst({
      where: { id, status: ApprovalStatus.PENDING },
      include: { workflow: true },
    });
    if (!instance) throw new NotFoundException("Aprobación pendiente no encontrada");
    if (instance.workId) await this.requireWork(companyId, instance.workId);
    if (
      instance.requestedById === user.id &&
      this.config.get("ALLOW_SELF_APPROVAL", "false") !== "true"
    ) {
      throw new ForbiddenException("Quien solicita no puede aprobar la misma operación");
    }

    const steps = instance.workflow.steps as unknown as WorkflowStep[];
    const current = steps[instance.currentStep - 1];
    if (!current) throw new BadRequestException("Flujo sin paso vigente");
    if (
      !user.roleCodes.includes("ADMIN_GENERAL") &&
      !user.roleCodes.includes(current.role)
    ) {
      throw new ForbiddenException(
        `El paso requiere el rol ${current.label ?? current.role}`,
      );
    }

    const rejected = dto.decision === ApprovalStatus.REJECTED;
    const isLastStep = instance.currentStep >= steps.length;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.approvalInstance.updateMany({
        where: {
          id,
          status: ApprovalStatus.PENDING,
          currentStep: instance.currentStep,
        },
        data: {
          status: rejected
            ? ApprovalStatus.REJECTED
            : isLastStep
              ? ApprovalStatus.APPROVED
              : ApprovalStatus.PENDING,
          currentStep: rejected || isLastStep
            ? instance.currentStep
            : instance.currentStep + 1,
          completedAt: rejected || isLastStep ? new Date() : undefined,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException("La aprobación ya fue procesada");
      }
      await tx.approvalDecision.create({
        data: {
          instanceId: id,
          step: instance.currentStep,
          approverId: user.id,
          decision: dto.decision,
          comments: dto.comments,
        },
      });
      return tx.approvalInstance.findUniqueOrThrow({
        where: { id },
        include: { workflow: true, decisions: true },
      });
    });
  }

  private async requireWork(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!work) throw new NotFoundException("Obra no encontrada");
  }
}
