import { SetMetadata } from "@nestjs/common";

export interface RequiredPermission {
  module: string;
  action: string;
}

export const PERMISSIONS_KEY = "permissions";
export const RequirePermission = (module: string, action: string) =>
  SetMetadata(PERMISSIONS_KEY, { module, action } satisfies RequiredPermission);
