import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { EntityIdPipe } from "../common/validation.pipes";
import { WorkspaceService } from "./workspace.service";
import { CreateTechnicalTaskDto, UpdateTechnicalTaskDto } from "./workspace.dto";

@Controller("workspace")
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get("technical")
  @RequirePermission("technical-workspace", "view")
  technical(@CurrentUser() user: AuthUser) {
    return this.workspace.technicalWorkspace(user);
  }

  @Post("technical/tasks")
  @RequirePermission("technical-workspace", "create")
  createTechnicalTask(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTechnicalTaskDto,
  ) {
    return this.workspace.createTechnicalTask(user, dto);
  }

  @Patch("technical/tasks/:id")
  @RequirePermission("technical-workspace", "modify")
  updateTechnicalTask(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateTechnicalTaskDto,
  ) {
    return this.workspace.updateTechnicalTask(user, id, dto);
  }

  @Get("notifications")
  @RequirePermission("notifications", "view")
  notifications(@CurrentUser() user: AuthUser) {
    return this.workspace.notifications(user.id);
  }

  @Patch("notifications/:id/read")
  @RequirePermission("notifications", "modify")
  markNotificationRead(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
  ) {
    return this.workspace.markNotificationRead(user.id, id);
  }
}
