import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Post, Query } from "@nestjs/common";
import { RegistrationStatus, UserStatus } from "@prisma/client";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { SystemService } from "./system.service";
import { EntityIdPipe } from "../common/validation.pipes";
import {
  ApproveRegistrationDto,
  RejectRegistrationDto,
  SetUserStatusDto,
} from "./dto/registration-review.dto";

@Controller("system")
@RequirePermission("system", "admin")
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get("users")
  users(@CurrentUser() user: AuthUser) {
    return this.system.users(user.companyId);
  }

  @Patch("users/:id/status")
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: SetUserStatusDto,
  ) {
    return this.system.setUserStatus(user.companyId, id, dto.status, user.id);
  }

  @Get("roles")
  roles() {
    return this.system.roles();
  }

  @Get("registration-requests")
  registrationRequests(
    @CurrentUser() user: AuthUser,
    @Query("status", new ParseEnumPipe(RegistrationStatus, { optional: true }))
    status?: RegistrationStatus,
  ) {
    return this.system.registrationRequests(user.companyId, status);
  }

  @Post("registration-requests/:id/approve")
  approveRegistration(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: ApproveRegistrationDto,
  ) {
    return this.system.approveRegistration(
      user.companyId,
      id,
      user.id,
      dto.roleCode,
    );
  }

  @Post("registration-requests/:id/reject")
  rejectRegistration(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: RejectRegistrationDto,
  ) {
    return this.system.rejectRegistration(
      user.companyId,
      id,
      user.id,
      dto.reason,
    );
  }

  @Get("audit")
  audit(
    @Query("module") module?: string,
    @Query("userId") userId?: string,
    @Query("workId") workId?: string,
  ) {
    return this.system.audit({ module, userId, workId });
  }
}
