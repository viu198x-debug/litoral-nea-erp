import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { EntityIdPipe } from "../common/validation.pipes";
import {
  ApproveMaterialRequestDto,
  CreateDeliveryNoteDto,
  CreateMaterialRequestDto,
  CreateMaterialTakeoffDto,
} from "./procurement.dto";
import { ProcurementService } from "./procurement.service";

@Controller("procurement")
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Get("takeoffs")
  @RequirePermission("documents", "view")
  takeoffs(
    @CurrentUser() user: AuthUser,
    @Query("workId", EntityIdPipe) workId: string,
  ) {
    return this.procurement.listTakeoffs(user.companyId, workId);
  }

  @Post("takeoffs")
  @RequirePermission("documents", "create")
  createTakeoff(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMaterialTakeoffDto,
  ) {
    return this.procurement.createTakeoff(user, dto);
  }

  @Get("requests")
  @RequirePermission("documents", "view")
  requests(
    @CurrentUser() user: AuthUser,
    @Query("workId") workId?: string,
  ) {
    return this.procurement.listRequests(user.companyId, workId);
  }

  @Post("requests")
  @RequirePermission("documents", "create")
  createRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMaterialRequestDto,
  ) {
    return this.procurement.createRequest(user, dto);
  }

  @Post("requests/:id/approve")
  @RequirePermission("purchases", "approve")
  approveRequest(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: ApproveMaterialRequestDto,
  ) {
    return this.procurement.approveRequest(user, id, dto);
  }

  @Get("delivery-notes")
  @RequirePermission("logistics", "view")
  deliveryNotes(
    @CurrentUser() user: AuthUser,
    @Query("workId") workId?: string,
    @Query("requestId") requestId?: string,
  ) {
    return this.procurement.listDeliveryNotes(user.companyId, workId, requestId);
  }

  @Post("delivery-notes")
  @RequirePermission("logistics", "create")
  createDeliveryNote(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDeliveryNoteDto,
  ) {
    return this.procurement.createDeliveryNote(user, dto);
  }

  @Get("work/:workId/summary")
  @RequirePermission("works", "view")
  summary(
    @CurrentUser() user: AuthUser,
    @Param("workId", EntityIdPipe) workId: string,
  ) {
    return this.procurement.workSummary(user.companyId, workId);
  }
}
