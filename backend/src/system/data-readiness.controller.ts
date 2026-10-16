import { Controller, Get } from "@nestjs/common";
import { RequirePermission } from "../common/permissions.decorator";
import { DataReadinessService } from "./data-readiness.service";

/** Admin-only read-only database/schema diagnostics; no secrets or row contents. */
@Controller("system/data-readiness")
@RequirePermission("system", "admin")
export class DataReadinessController {
  constructor(private readonly readiness: DataReadinessService) {}

  @Get()
  check() {
    return this.readiness.assess();
  }
}
