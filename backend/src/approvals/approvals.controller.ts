import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query } from "@nestjs/common";
import { ApprovalStatus } from "@prisma/client";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { ApprovalsService } from "./approvals.service";
import { DecisionDto } from "./dto/decision.dto";
import { RequestApprovalDto } from "./dto/request-approval.dto";
import { EntityIdPipe } from "../common/validation.pipes";

@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @RequirePermission("approvals", "view")
  list(
    @CurrentUser() user: AuthUser,
    @Query("status", new ParseEnumPipe(ApprovalStatus, { optional: true }))
    status?: ApprovalStatus,
    @Query("module") module?: string,
  ) {
    return this.approvals.list(user.companyId, { status, module });
  }

  @Post()
  @RequirePermission("approvals", "create")
  request(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestApprovalDto,
  ) {
    return this.approvals.request(user.companyId, user.id, dto);
  }

  @Post(":id/decision")
  @RequirePermission("approvals", "approve")
  decide(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.approvals.decide(user.companyId, id, user, dto);
  }
}
