import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { EntityIdPipe } from "../common/validation.pipes";
import {
  CreateCashCountDto,
  CreateDailyCloseDto,
  CreateReconciliationDto,
  CreateTreasuryAccountDto,
  CreateTreasuryChequeDto,
  CreateTreasuryMovementDto,
  MovementDecisionDto,
  UpdateChequeStatusDto,
  UpdateTreasuryAccountDto,
  VoidMovementDto,
} from "./treasury-control.dto";
import { TreasuryControlService } from "./treasury-control.service";

@Controller("treasury")
export class TreasuryControlController {
  constructor(private readonly treasury: TreasuryControlService) {}

  @Get("dashboard")
  @RequirePermission("treasury", "view")
  dashboard(@CurrentUser() user: AuthUser) {
    return this.treasury.dashboard(user.companyId);
  }

  @Get("accounts")
  @RequirePermission("treasury", "view")
  accounts(@CurrentUser() user: AuthUser, @Query("type") type?: string) {
    return this.treasury.accounts(user.companyId, type);
  }

  @Post("accounts")
  @RequirePermission("treasury", "create")
  createAccount(@CurrentUser() user: AuthUser, @Body() dto: CreateTreasuryAccountDto) {
    return this.treasury.createAccount(user.companyId, dto);
  }

  @Patch("accounts/:id")
  @RequirePermission("treasury", "modify")
  updateAccount(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: UpdateTreasuryAccountDto) {
    return this.treasury.updateAccount(user.companyId, id, dto);
  }

  @Get("movements")
  @RequirePermission("treasury", "view")
  movements(@CurrentUser() user: AuthUser, @Query("status") status?: string, @Query("accountId") accountId?: string) {
    return this.treasury.movements(user.companyId, { status, accountId });
  }

  @Post("movements")
  @RequirePermission("treasury", "create")
  createMovement(@CurrentUser() user: AuthUser, @Body() dto: CreateTreasuryMovementDto) {
    return this.treasury.createMovement(user.companyId, user.id, dto);
  }

  @Post("movements/:id/approve")
  @RequirePermission("treasury", "approve")
  approveMovement(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: MovementDecisionDto) {
    return this.treasury.approveMovement(user.companyId, id, user, dto.comments);
  }

  @Post("movements/:id/void")
  @RequirePermission("treasury", "void")
  voidMovement(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: VoidMovementDto) {
    return this.treasury.voidMovement(user.companyId, id, user.id, dto.reason);
  }

  @Get("cheques")
  @RequirePermission("treasury", "view")
  cheques(@CurrentUser() user: AuthUser, @Query("status") status?: string) {
    return this.treasury.cheques(user.companyId, status);
  }

  @Post("cheques")
  @RequirePermission("treasury", "create")
  createCheque(@CurrentUser() user: AuthUser, @Body() dto: CreateTreasuryChequeDto) {
    return this.treasury.createCheque(user.companyId, user.id, dto);
  }

  @Patch("cheques/:id/status")
  @RequirePermission("treasury", "modify")
  updateChequeStatus(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: UpdateChequeStatusDto) {
    return this.treasury.updateChequeStatus(user.companyId, id, dto);
  }

  @Get("reconciliations")
  @RequirePermission("treasury", "view")
  reconciliations(@CurrentUser() user: AuthUser) {
    return this.treasury.reconciliations(user.companyId);
  }

  @Post("reconciliations")
  @RequirePermission("treasury", "create")
  createReconciliation(@CurrentUser() user: AuthUser, @Body() dto: CreateReconciliationDto) {
    return this.treasury.createReconciliation(user.companyId, user.id, dto);
  }

  @Post("cash-counts")
  @RequirePermission("treasury", "create")
  createCashCount(@CurrentUser() user: AuthUser, @Body() dto: CreateCashCountDto) {
    return this.treasury.createCashCount(user.companyId, user.id, dto);
  }

  @Post("daily-closes")
  @RequirePermission("treasury", "create")
  createDailyClose(@CurrentUser() user: AuthUser, @Body() dto: CreateDailyCloseDto) {
    return this.treasury.createDailyClose(user.companyId, user.id, dto);
  }
}
