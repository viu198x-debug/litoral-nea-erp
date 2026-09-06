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
import { RecordStatus } from "@prisma/client";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { CreateRecordDto } from "./dto/create-record.dto";
import { UpdateRecordDto } from "./dto/update-record.dto";
import { RecordsService } from "./records.service";
import { EntityIdPipe, ModuleSlugPipe } from "../common/validation.pipes";

@Controller("records")
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get(":module")
  @RequirePermission(":module", "view")
  list(
    @CurrentUser() user: AuthUser,
    @Param("module", ModuleSlugPipe) module: string,
    @Query("workId") workId?: string,
    @Query("status", new ParseEnumPipe(RecordStatus, { optional: true }))
    status?: RecordStatus,
    @Query("search") search?: string,
  ) {
    return this.records.list(user.companyId, module, { workId, status, search });
  }

  @Post(":module")
  @RequirePermission(":module", "create")
  create(
    @CurrentUser() user: AuthUser,
    @Param("module", ModuleSlugPipe) module: string,
    @Body() dto: CreateRecordDto,
  ) {
    return this.records.create(user.companyId, module, user.id, dto);
  }

  @Patch(":module/:id")
  @RequirePermission(":module", "modify")
  update(
    @CurrentUser() user: AuthUser,
    @Param("module", ModuleSlugPipe) module: string,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateRecordDto,
  ) {
    return this.records.update(user.companyId, module, id, dto);
  }

  @Delete(":module/:id")
  @RequirePermission(":module", "void")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("module", ModuleSlugPipe) module: string,
    @Param("id", EntityIdPipe) id: string,
  ) {
    return this.records.softDelete(user.companyId, module, id);
  }
}
