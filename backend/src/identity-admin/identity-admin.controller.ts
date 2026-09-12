import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { EntityIdPipe } from "../common/validation.pipes";
import {
  CreateManagedRoleDto,
  ReplaceUserPermissionsDto,
  ReplaceUserRolesDto,
  ResetManagedPasswordDto,
  UpdateManagedRoleDto,
  UpdateManagedUserDto,
} from "./identity-admin.dto";
import { IdentityAdminService } from "./identity-admin.service";

@Controller("identity-admin")
@RequirePermission("system", "admin")
export class IdentityAdminController {
  constructor(private readonly identity: IdentityAdminService) {}

  @Get("users")
  users(@CurrentUser() user: AuthUser) {
    return this.identity.listUsers(user.companyId);
  }

  @Patch("users/:id")
  updateUser(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: UpdateManagedUserDto) {
    return this.identity.updateUser(user, id, dto);
  }

  @Post("users/:id/password")
  resetPassword(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ResetManagedPasswordDto) {
    return this.identity.resetPassword(user, id, dto);
  }

  @Put("users/:id/roles")
  replaceRoles(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReplaceUserRolesDto) {
    return this.identity.replaceRoles(user, id, dto);
  }

  @Put("users/:id/permissions")
  replacePermissions(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: ReplaceUserPermissionsDto) {
    return this.identity.replacePermissions(user, id, dto);
  }

  @Delete("users/:id")
  disableUser(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string) {
    return this.identity.disableUser(user, id);
  }

  @Get("roles")
  roles() {
    return this.identity.listRoles();
  }

  @Post("roles")
  createRole(@CurrentUser() user: AuthUser, @Body() dto: CreateManagedRoleDto) {
    return this.identity.createRole(user, dto);
  }

  @Patch("roles/:id")
  updateRole(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string, @Body() dto: UpdateManagedRoleDto) {
    return this.identity.updateRole(user, id, dto);
  }

  @Delete("roles/:id")
  deleteRole(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string) {
    return this.identity.deleteRole(user, id);
  }
}
