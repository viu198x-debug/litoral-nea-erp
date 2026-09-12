import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { EntityIdPipe } from "../common/validation.pipes";
import { CreateAssetComplianceDto, CreateVehicleFineDto, UpdateAssetLiveStateDto } from "./fleet-control.dto";
import { FleetControlService } from "./fleet-control.service";

@Controller("fleet-control")
export class FleetControlController {
  constructor(private readonly fleet: FleetControlService) {}

  @Get("dashboard")
  @RequirePermission("fleet", "view")
  dashboard(@CurrentUser() user: AuthUser) {
    return this.fleet.dashboard(user.companyId);
  }

  @Get("vehicles/:id")
  @RequirePermission("fleet", "view")
  vehicle(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string) {
    return this.fleet.vehicleDetail(user.companyId, id);
  }

  @Patch("vehicles/:id/live")
  @RequirePermission("fleet", "modify")
  updateVehicleLive(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateAssetLiveStateDto,
  ) {
    return this.fleet.updateVehicleLive(user.companyId, user.id, id, dto);
  }

  @Post("vehicles/:id/fines")
  @RequirePermission("fleet", "create")
  createFine(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: CreateVehicleFineDto,
  ) {
    return this.fleet.createFine(user.companyId, user.id, id, dto);
  }

  @Post("vehicles/:id/compliance")
  @RequirePermission("fleet", "create")
  createVehicleCompliance(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: CreateAssetComplianceDto,
  ) {
    return this.fleet.createVehicleCompliance(user.companyId, user.id, id, dto);
  }

  @Get("machines/:id")
  @RequirePermission("machinery", "view")
  machine(@CurrentUser() user: AuthUser, @Param("id", EntityIdPipe) id: string) {
    return this.fleet.machineDetail(user.companyId, id);
  }

  @Patch("machines/:id/live")
  @RequirePermission("machinery", "modify")
  updateMachineLive(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateAssetLiveStateDto,
  ) {
    return this.fleet.updateMachineLive(user.companyId, user.id, id, dto);
  }

  @Post("machines/:id/compliance")
  @RequirePermission("machinery", "create")
  createMachineCompliance(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: CreateAssetComplianceDto,
  ) {
    return this.fleet.createMachineCompliance(user.companyId, user.id, id, dto);
  }
}
