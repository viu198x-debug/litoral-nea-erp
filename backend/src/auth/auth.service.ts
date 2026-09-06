import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuditAction, Prisma, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { LoginDto } from "./dto/login.dto";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

type UserWithRoles = Prisma.UserGetPayload<{
  include: { roles: { include: { role: true } } };
}>;

const INVALID_PASSWORD_HASH =
  "$2b$12$HETxGvErDc.hsfcqsRNiceiYwyXQe3qooUyCjo5/CgY3vzJPljjwu";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async audit(
    action: AuditAction,
    module: string,
    meta: RequestMeta,
    userId?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        ipAddress: meta.ip,
        userAgent: meta.userAgent?.slice(0, 500),
      },
    });
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const identity = dto.username.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identity }, { email: identity }],
        deletedAt: null,
      },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      await bcrypt.compare(dto.password, INVALID_PASSWORD_HASH);
      await this.audit(AuditAction.LOGIN_FAILED, "auth", meta);
      throw new UnauthorizedException("Usuario o contraseña incorrectos");
    }

    const now = new Date();
    if (
      user.status === UserStatus.DISABLED ||
      (user.status === UserStatus.LOCKED && user.lockedUntil && user.lockedUntil > now)
    ) {
      await this.audit(AuditAction.LOGIN_FAILED, "auth", meta, user.id);
      throw new UnauthorizedException("Usuario o contraseña incorrectos");
    }
    if (user.status === UserStatus.LOCKED) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          lockedUntil: null,
          failedLoginAttempts: 0,
        },
      });
    }

    const passwordWithinBcryptLimit = Buffer.byteLength(dto.password, "utf8") <= 72;
    const valid =
      passwordWithinBcryptLimit &&
      (await bcrypt.compare(dto.password, user.passwordHash));
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const maxAttempts = this.config.get<number>("MAX_LOGIN_ATTEMPTS", 5);
      const lockMinutes = this.config.get<number>("LOCK_MINUTES", 15);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          ...(attempts >= maxAttempts
            ? {
                status: UserStatus.LOCKED,
                lockedUntil: new Date(Date.now() + lockMinutes * 60_000),
              }
            : {}),
        },
      });
      if (attempts >= maxAttempts) {
        await this.prisma.alert.create({
          data: {
            type: "SECURITY_ACCOUNT_LOCKOUT",
            severity: "HIGH",
            title: "Cuenta bloqueada por intentos fallidos",
            description: `${user.email} · IP ${meta.ip ?? "desconocida"} · ${attempts} intentos`,
          },
        });
      }
      await this.audit(AuditAction.LOGIN_FAILED, "auth", meta, user.id);
      throw new UnauthorizedException("Usuario o contraseña incorrectos");
    }

    if (user.mfaEnabled) {
      throw new ForbiddenException({
        code: "MFA_REQUIRED",
        message: "Se requiere segundo factor",
      });
    }

    return this.issueSession(user, meta);
  }

  async issueSessionForUser(userId: string, meta: RequestMeta) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException("Cuenta no habilitada");
    if (user.mfaEnabled) {
      throw new ForbiddenException({
        code: "MFA_REQUIRED",
        message: "Se requiere segundo factor",
      });
    }
    return this.issueSession(user, meta);
  }

  private async issueSession(user: UserWithRoles, meta: RequestMeta) {
    const now = new Date();
    const refreshDays = this.config.get<number>("REFRESH_TOKEN_DAYS", 7);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: "pending",
        ipAddress: meta.ip,
        userAgent: meta.userAgent?.slice(0, 500),
        expiresAt: new Date(Date.now() + refreshDays * 86_400_000),
      },
    });
    const tokens = await this.signTokens(user, session.id, refreshDays);
    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12) },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: UserStatus.ACTIVE,
          lastLoginAt: now,
        },
      }),
    ]);

    const maxSessions = this.config.get<number>("MAX_ACTIVE_SESSIONS", 5);
    const staleSessions = await this.prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      skip: maxSessions,
      select: { id: true },
    });
    if (staleSessions.length) {
      await this.prisma.session.updateMany({
        where: { id: { in: staleSessions.map(({ id }) => id) } },
        data: { revokedAt: now },
      });
    }

    await this.audit(AuditAction.LOGIN, "auth", meta, user.id);
    return {
      ...tokens,
      sessionId: session.id,
      user: this.publicUser(user),
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; sid: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        algorithms: ["HS256"],
        issuer: this.config.get<string>("JWT_ISSUER", "litoral-nea-erp"),
        audience: this.config.get<string>("JWT_AUDIENCE", "litoral-nea-api"),
      });
    } catch {
      throw new UnauthorizedException("Token de renovación no válido");
    }
    if (payload.typ !== "refresh") throw new UnauthorizedException();

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: { roles: { include: { role: true } } },
        },
      },
    });
    if (!session) throw new UnauthorizedException("Sesión vencida o revocada");

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );
    if (!tokenMatches || session.user.status !== UserStatus.ACTIVE) {
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Sesión vencida o revocada");
    }

    const remainingDays = Math.max(
      1,
      Math.ceil((session.expiresAt.getTime() - Date.now()) / 86_400_000),
    );
    const tokens = await this.signTokens(
      session.user,
      session.id,
      remainingDays,
    );
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date(),
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12),
      },
    });
    return { ...tokens, sessionId: session.id };
  }

  async logout(sessionId: string, userId: string, meta: RequestMeta) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit(AuditAction.LOGOUT, "auth", meta, userId);
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null },
    });
    if (!user) return { accepted: true };
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await this.prisma.$transaction([
      this.prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      }),
    ]);
    return {
      accepted: true,
      ...(this.config.get("NODE_ENV") !== "production" ? { resetToken: token } : {}),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    if (Buffer.byteLength(newPassword, "utf8") > 72) {
      throw new ForbiddenException("La contraseña supera el máximo seguro de 72 bytes");
    }
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const reset = await this.prisma.passwordReset.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!reset) throw new UnauthorizedException("Token vencido o no válido");
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 12),
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: UserStatus.ACTIVE,
        },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { changed: true };
  }

  private async signTokens(
    user: UserWithRoles,
    sessionId: string,
    refreshDays: number,
  ) {
    const roleCodes = user.roles.map(({ role }) => role.code);
    const common = {
      issuer: this.config.get<string>("JWT_ISSUER", "litoral-nea-erp"),
      audience: this.config.get<string>("JWT_AUDIENCE", "litoral-nea-api"),
      algorithm: "HS256" as const,
    };
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        sid: sessionId,
        companyId: user.companyId,
        username: user.username,
        email: user.email,
        roleCodes,
        typ: "access" as const,
      },
      {
        ...common,
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("ACCESS_TOKEN_TTL", "15m") as never,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, typ: "refresh" as const },
      {
        ...common,
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: `${refreshDays}d` as never,
      },
    );
    return { accessToken, refreshToken };
  }

  private publicUser(user: UserWithRoles) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleCodes: user.roles.map(({ role }) => role.code),
    };
  }
}
