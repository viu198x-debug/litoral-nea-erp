import { Body, Controller, Delete, Get, Param, Patch, Query } from "@nestjs/common";
import { RecordStatus } from "@prisma/client";
import { RequirePermission } from "../common/permissions.decorator";
import { EntityIdPipe } from "../common/validation.pipes";
import { CreateRecordDto } from "../records/dto/create-record.dto";
import { UpdateRecordDto } from "../records/dto/update-record.dto";
import { TreasuryService } from "./treasury.service";

@Controller("records/treasury-accounts")
export class TreasuryRecordsController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get()
  @RequirePermission("treasury-accounts", "view")
  async list(@Query("search") search?: string) {
    const rows = await this.treasury.accounts(search);
    return rows.map((row) => ({
      id: row.id,
      code: row.accountNumber,
      title: `${row.institution} · ${row.accountName}`,
      status: row.active ? RecordStatus.ACTIVE : RecordStatus.VOID,
      amount: row.availableBalance,
      occurredAt: null,
      updatedAt: null,
      createdById: "treasury",
      work: null,
      data: {
        accountType: row.type === "WALLET" ? "Billetera virtual" : "Cuenta bancaria",
        institution: row.institution,
        accountName: row.accountName,
        accountNumber: row.accountNumber,
        cbuOrCvu: row.cbuOrCvu,
        alias: row.alias,
        currency: row.currency,
        openingBalance: row.availableBalance,
        accountingBalance: row.accountingBalance,
        difference: row.difference,
      },
    }));
  }

  @Get(":id")
  @RequirePermission("treasury-accounts", "view")
  async one(@Param("id", EntityIdPipe) id: string) {
    const rows = await this.treasury.accounts();
    const row = rows.find((item) => item.id === id);
    if (!row) return null;
    return row;
  }

  @Patch(":id")
  @RequirePermission("treasury-accounts", "modify")
  update(
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateRecordDto,
  ) {
    const data = dto.data ?? {};
    return this.treasury.updateAccount(id, {
      institution: data.institution === undefined ? undefined : String(data.institution),
      accountName: data.accountName === undefined ? undefined : String(data.accountName),
      cbuOrCvu: data.cbuOrCvu === undefined ? undefined : String(data.cbuOrCvu),
      alias: data.alias === undefined ? undefined : String(data.alias),
      currency: data.currency === undefined ? undefined : String(data.currency),
      active: dto.status === RecordStatus.VOID ? false : undefined,
    });
  }

  @Delete(":id")
  @RequirePermission("treasury-accounts", "void")
  remove(@Param("id", EntityIdPipe) id: string) {
    return this.treasury.updateAccount(id, { active: false });
  }
}
