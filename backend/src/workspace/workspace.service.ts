import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RecordStatus } from "@prisma/client";
import type { AuthUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateTechnicalTaskDto, UpdateTechnicalTaskDto } from "./workspace.dto";

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async technicalWorkspace(user: AuthUser) {
    const [tasks, unexpectedTasks, works, notifications] = await Promise.all([
      this.prisma.technicalTask.findMany({
        where: {
          assignedUserId: user.id,
          status: { notIn: [RecordStatus.VOID] },
          OR: [{ workId: null }, { work: { companyId: user.companyId } }],
        },
        include: { work: { select: { code: true, name: true } } },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { priority: "desc" }],
        take: 100,
      }),
      this.prisma.unexpectedTask.findMany({
        where: {
          assignedUserId: user.id,
          status: { notIn: [RecordStatus.CLOSED, RecordStatus.VOID] },
          OR: [{ workId: null }, { work: { companyId: user.companyId } }],
        },
        include: { work: { select: { code: true, name: true } } },
        orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
        take: 50,
      }),
      this.prisma.workMember.findMany({
        where: { userId: user.id, endDate: null, work: { companyId: user.companyId, deletedAt: null } },
        include: {
          work: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              city: true,
              physicalProgress: true,
              contractualEndDate: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
      }),
      this.prisma.notification.findMany({
        where: { userId: user.id, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const now = new Date();
    const overdue = tasks.filter((task) => task.dueAt && task.dueAt < now && task.status !== RecordStatus.CLOSED).length;
    const inProgress = tasks.filter((task) => task.status === RecordStatus.ACTIVE).length;

    return {
      generatedAt: now.toISOString(),
      summary: {
        assignedTasks: tasks.length,
        inProgress,
        overdue,
        unexpectedOpen: unexpectedTasks.length,
        activeWorks: works.length,
        unreadNotifications: notifications.length,
      },
      tasks,
      unexpectedTasks,
      works: works.map((row) => row.work),
      notifications,
    };
  }

  async createTechnicalTask(user: AuthUser, dto: CreateTechnicalTaskDto) {
    const [assignee, reviewer, work] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: dto.assignedUserId, companyId: user.companyId, deletedAt: null },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
      dto.reviewerUserId
        ? this.prisma.user.findFirst({
            where: { id: dto.reviewerUserId, companyId: user.companyId, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.workId
        ? this.prisma.work.findFirst({
            where: { id: dto.workId, companyId: user.companyId, deletedAt: null },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve(null),
    ]);
    if (!assignee) throw new NotFoundException("Técnico asignado no encontrado");
    if (dto.reviewerUserId && !reviewer) throw new NotFoundException("Revisor no encontrado");
    if (dto.workId && !work) throw new NotFoundException("Obra no encontrada");

    const code = `TEC-${Date.now().toString(36).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.technicalTask.create({
        data: {
          code,
          workId: dto.workId,
          discipline: dto.discipline,
          taskType: dto.taskType,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? "NORMAL",
          assignedUserId: dto.assignedUserId,
          reviewerUserId: dto.reviewerUserId,
          requestedBy: user.id,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          progressPct: dto.progressPct ?? 0,
          notes: dto.notes,
        },
      });

      const notification = await tx.notification.create({
        data: {
          userId: assignee.id,
          type: "TECHNICAL_TASK_ASSIGNED",
          title: "Nueva tarea técnica asignada",
          message: `${task.code} · ${task.title}${work ? ` · ${work.code} ${work.name}` : ""}`,
          severity: task.priority === "CRITICAL" ? "CRITICAL" : task.priority === "HIGH" ? "HIGH" : "INFO",
          module: "technical-workspace",
          entityType: "TechnicalTask",
          entityId: task.id,
          actionUrl: "/technical-workspace",
        },
      });

      await tx.notificationDelivery.createMany({
        data: [
          {
            notificationId: notification.id,
            channel: "IN_APP",
            destination: assignee.id,
            status: "DELIVERED",
            deliveredAt: new Date(),
          },
          {
            notificationId: notification.id,
            channel: "EMAIL",
            destination: assignee.email,
            status: "PENDING",
          },
          {
            notificationId: notification.id,
            channel: "PUSH",
            destination: assignee.id,
            status: "PENDING",
          },
        ],
      });

      return task;
    });
  }

  async updateTechnicalTask(user: AuthUser, id: string, dto: UpdateTechnicalTaskDto) {
    const current = await this.prisma.technicalTask.findFirst({
      where: {
        id,
        OR: [{ assignedUserId: user.id }, { reviewerUserId: user.id }],
        OR: [{ workId: null }, { work: { companyId: user.companyId } }],
      },
    });
    if (!current && !user.roleCodes.some((role) => ["ADMIN_GENERAL", "GERENTE_EMPRESA"].includes(role))) {
      throw new ForbiddenException("No puede modificar esta tarea técnica");
    }
    const existing = current ?? await this.prisma.technicalTask.findFirst({
      where: { id, OR: [{ workId: null }, { work: { companyId: user.companyId } }] },
    });
    if (!existing) throw new NotFoundException("Tarea técnica no encontrada");

    const data: Prisma.TechnicalTaskUpdateInput = {};
    if (dto.status) {
      data.status = dto.status as RecordStatus;
      if (dto.status === "ACTIVE" && !existing.startedAt) data.startedAt = new Date();
      if (dto.status === "CLOSED") data.completedAt = new Date();
    }
    if (dto.progressPct !== undefined) data.progressPct = dto.progressPct;
    if (dto.dueAt !== undefined) data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.prisma.technicalTask.update({ where: { id }, data });
  }

  notifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      include: { deliveries: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markNotificationRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException("Notificación no encontrada");
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }
}
