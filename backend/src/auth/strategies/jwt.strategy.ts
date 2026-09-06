import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { UserStatus } from "@prisma/client";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthUser } from "../../common/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";

interface AccessPayload {
  sub: string;
  sid: string;
  companyId: string;
  username: string;
  email: string;
  roleCodes: string[];
  typ: "access";
}

const cookieExtractor = (request: Request): string | null =>
  request?.cookies?.["__Host-lnea_access"] ??
  request?.cookies?.lnea_access ??
  null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      algorithms: ["HS256"],
      issuer: config.get<string>("JWT_ISSUER", "litoral-nea-erp"),
      audience: config.get<string>("JWT_AUDIENCE", "litoral-nea-api"),
    });
  }

  async validate(payload: AccessPayload): Promise<AuthUser> {
    if (payload.typ !== "access") throw new UnauthorizedException();
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: UserStatus.ACTIVE, deletedAt: null },
      },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
    });
    if (!session) throw new UnauthorizedException("Sesión no válida");
    return {
      id: session.user.id,
      sessionId: session.id,
      companyId: session.user.companyId,
      username: session.user.username,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      roleCodes: session.user.roles.map(({ role }) => role.code),
    };
  }
}
