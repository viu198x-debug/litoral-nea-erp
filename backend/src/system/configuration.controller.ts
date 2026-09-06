import { Controller, Get } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { SystemService } from "./system.service";

@Controller("configuration")
export class ConfigurationController {
  constructor(private readonly system: SystemService) {}

  @Get("modules")
  modules(@CurrentUser() user: AuthUser) {
    return this.system.availableModules(user);
  }
}
