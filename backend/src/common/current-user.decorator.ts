import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface AuthUser {
  id: string;
  sessionId: string;
  companyId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roleCodes: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);
