import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { EntityIdPipe } from "../common/validation.pipes";
import {
  CreateCashBoxDto,
  CreateTreasuryAccountDto,
  ReconcileAccountDto,
  TreasuryTransferDto,
  UpdateTreasuryAccountDto,
} from "./treasury.dto";
import { TreasuryService } from "./treasury.service";

@Controller("treasury")
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get("dashboard")
  @RequirePermission("banks", "view")
  dashboard(@CurrentUser() user: AuthUser) {
    return this.treasury.dashboard(user.companyId);
  }

  @Get("accounts")
  @RequirePermission("banks", "view")
  accounts(@Query("search") search?: string) {
    return this.treasury.accounts(search);
  }

  @Post("accounts")
  @RequirePermission("banks", "create")
  createAccount(@Body() dto: CreateTreasuryAccountDto) {
    return this.treasury.createAccount(dto);
  }

  @Patch("accounts/:id")
  @RequirePermission("banks", "modify")
  updateAccount(
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateTreasuryAccountDto,
  ) {
    return this.treasury.updateAccount(id, dto);
  }

  @Get("cash-boxes")
  @RequirePermission("cash", "view")
  cashBoxes() {
    return this.treasury.cashBoxes();
  }

  @Post("cash-boxes")
  @RequirePermission("cash", "create")
  createCashBox(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCashBoxDto,
  ) {
    return this.treasury.createCashBox(user.companyId, dto);
  }

  @Post("transfers")
  @RequirePermission("payments", "create")
  transfer(
    @CurrentUser() user: AuthUser,
    @Body() dto: TreasuryTransferDto,
  ) {
    return this.treasury.transfer(user.companyId, user.id, dto);
  }

  @Post("accounts/:id/reconcile")
  @RequirePermission("banks", "approve")
  reconcile(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: ReconcileAccountDto,
  ) {
    return this.treasury.reconcile(user.id, id, dto);
  }

  @Get("movements")
  @RequirePermission("payments", "view")
  movements(
    @CurrentUser() user: AuthUser,
    @Query("limit") limit?: string,
  ) {
    return this.treasury.recentMovements(user.companyId, Number(limit ?? 100));
  }
}
