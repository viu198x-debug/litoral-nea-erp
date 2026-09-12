import { Controller, Get, Query } from "@nestjs/common";
import { RecordStatus } from "@prisma/client";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { TreasuryService } from "./treasury.service";

@Controller("records/treasury")
export class TreasuryOverviewRecordsController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get()
  @RequirePermission("treasury", "view")
  async list(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
  ) {
    const rows = await this.treasury.recentMovements(user.companyId, 200);
    const term = search?.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (!term) return true;
        return [row.concept, row.counterparty, row.reference, row.type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .map((row) => ({
        id: row.id,
        code: `TES-${row.id.slice(-8).toUpperCase()}`,
        title: row.concept,
        status: RecordStatus.ACTIVE,
        amount: row.amount,
        occurredAt: row.occurredAt,
        updatedAt: row.occurredAt,
        createdById: row.createdById,
        work: row.work,
        data: {
          direction: row.direction === "IN" ? "Ingreso" : "Egreso",
          type: row.type,
          counterparty: row.counterparty,
          reference: row.reference,
          account: row.bankAccount
            ? `${row.bankAccount.bankName} · ${row.bankAccount.accountName}`
            : row.cashBox?.name ?? "",
        },
      }));
  }
}
