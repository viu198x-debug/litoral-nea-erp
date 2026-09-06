import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermission("dashboard", "view")
  getGeneral(@CurrentUser() user: AuthUser) {
    return this.dashboard.general(
      user.companyId,
      user.id,
      user.roleCodes.some((code) => code.startsWith("TEC_")),
    );
  }

  @Get("sector/:module")
  @RequirePermission("dashboard", "view")
  getSector(
    @CurrentUser() user: AuthUser,
    @Param("module") module: string,
  ) {
    return this.dashboard.sector(
      user.companyId,
      user.id,
      user.roleCodes,
      module,
    );
  }
}
