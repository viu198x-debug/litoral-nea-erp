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
import {
  CreateModuleDto,
  CreateModuleFieldDto,
  SetRoleModulePermissionDto,
  UpdateModuleDto,
  UpdateModuleFieldDto,
} from "./dto/module-config.dto";
import { CreateWorkflowDto, UpdateWorkflowDto } from "./dto/workflow-config.dto";
import { CreateManualUserDto } from "./dto/create-manual-user.dto";
import { StarterImportDto } from "./dto/starter-import.dto";

@Controller("system")
@RequirePermission("system", "admin")
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get("users")
  users(@CurrentUser() user: AuthUser) {
    return this.system.users(user.companyId);
  }

  @Post("users")
  createUser(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateManualUserDto,
  ) {
    return this.system.createManualUser(user.companyId, dto, user.id);
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

  @Get("modules")
  modules() {
    return this.system.modules();
  }

  @Post("modules")
  createModule(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateModuleDto,
  ) {
    return this.system.createModule(dto, user.id);
  }

  @Patch("modules/:id")
  updateModule(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.system.updateModule(id, dto, user.id);
  }

  @Post("modules/:id/fields")
  createModuleField(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: CreateModuleFieldDto,
  ) {
    return this.system.createModuleField(id, dto, user.id);
  }

  @Patch("module-fields/:id")
  updateModuleField(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateModuleFieldDto,
  ) {
    return this.system.updateModuleField(id, dto, user.id);
  }

  @Patch("role-permissions")
  setRolePermission(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetRoleModulePermissionDto,
  ) {
    return this.system.setRolePermission(dto, user.id);
  }

  @Get("workflows")
  workflows() {
    return this.system.workflows();
  }

  @Post("workflows")
  createWorkflow(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkflowDto) {
    return this.system.createWorkflow(dto, user.id);
  }

  @Patch("workflows/:id")
  updateWorkflow(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.system.updateWorkflow(id, dto, user.id);
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

  @Post("starter-import")
  starterImport(
    @CurrentUser() user: AuthUser,
    @Body() dto: StarterImportDto,
  ) {
    return this.system.starterImport(user.companyId, user.id, dto);
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
