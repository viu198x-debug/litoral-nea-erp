import { Module } from "@nestjs/common";
import { IdentityAdminController } from "./identity-admin.controller";
import { IdentityAdminService } from "./identity-admin.service";

@Module({
  controllers: [IdentityAdminController],
  providers: [IdentityAdminService],
})
export class IdentityAdminModule {}
