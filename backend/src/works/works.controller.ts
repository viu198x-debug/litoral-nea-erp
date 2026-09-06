import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { WorkStatus } from "@prisma/client";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { CreateWorkDto } from "./dto/create-work.dto";
import { UpdateWorkDto } from "./dto/update-work.dto";
import { WorksService } from "./works.service";
import { EntityIdPipe } from "../common/validation.pipes";

@Controller("works")
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @Get()
  @RequirePermission("works", "view")
  list(
    @CurrentUser() user: AuthUser,
    @Query("status", new ParseEnumPipe(WorkStatus, { optional: true }))
    status?: WorkStatus,
    @Query("search") search?: string,
  ) {
    return this.works.list(user.companyId, { status, search });
  }

  @Get(":id")
  @RequirePermission("works", "view")
  get(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string) {
    return this.works.get(user.companyId, id);
  }

  @Get(":id/dashboard")
  @RequirePermission("works", "view")
  dashboard(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string) {
    return this.works.dashboard(user.companyId, id);
  }

  @Post()
  @RequirePermission("works", "create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkDto) {
    return this.works.create(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermission("works", "modify")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateWorkDto,
  ) {
    return this.works.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermission("works", "void")
  remove(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string) {
    return this.works.softDelete(user.companyId, id);
  }
}
