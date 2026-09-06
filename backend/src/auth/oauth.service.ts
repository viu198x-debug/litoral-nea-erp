import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IdentityProvider, RegistrationStatus, UserStatus } from "@prisma/client";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService, type RequestMeta } from "./auth.service";

export type OAuthProviderSlug = "google" | "microsoft";

interface OAuthState {
  provider: OAuthProviderSlug;
  state: string;
  nonce: string;
  verifier: string;
  expiresAt: number;
}

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  redirectUri: string;
}

interface IdentityClaims {
  provider: IdentityProvider;
  subject: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class OAuthService {
  private readonly googleJwks = createRemoteJWKSet(
    new URL("https://www.googleapis.com/oauth2/v3/certs"),
  );
  private readonly microsoftJwks = createRemoteJWKSet(
    new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"),
  );

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  createAuthorization(provider: OAuthProviderSlug) {
    const providerConfig = this.providerConfig(provider);
    const state: OAuthState = {
      provider,
      state: randomBytes(32).toString("base64url"),
      nonce: randomBytes(32).toString("base64url"),
      verifier: randomBytes(48).toString("base64url"),
      expiresAt: Date.now() + 10 * 60_000,
    };
    const challenge = createHash("sha256")
      .update(state.verifier)
      .digest("base64url");
    const url = new URL(providerConfig.authorizeUrl);
    url.search = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: providerConfig.redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: "openid email profile",
      state: state.state,
      nonce: state.nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return { url: url.toString(), sealedState: this.seal(state) };
  }

  async complete(
    provider: OAuthProviderSlug,
    code: string,
    returnedState: string,
    sealedState: string,
    meta: RequestMeta,
  ) {
    const state = this.open(sealedState);
    if (
      state.provider !== provider ||
      state.expiresAt < Date.now() ||
      !this.constantTimeEquals(state.state, returnedState)
    ) {
      throw new UnauthorizedException("Estado OAuth no válido o vencido");
    }
    const providerConfig = this.providerConfig(provider);
    const idToken = await this.exchangeCode(
      providerConfig,
      code,
      state.verifier,
    );
    const identity = await this.verifyIdentity(
      provider,
      providerConfig,
      idToken,
      state.nonce,
    );

    const linked = await this.prisma.externalIdentity.findUnique({
      where: {
        provider_subject: {
          provider: identity.provider,
          subject: identity.subject,
        },
      },
      include: { user: true },
    });
    if (linked) {
      if (linked.user.status !== UserStatus.ACTIVE || linked.user.deletedAt) {
        throw new UnauthorizedException("Cuenta no habilitada");
      }
      await this.prisma.externalIdentity.update({
        where: { id: linked.id },
        data: { email: identity.email, lastLoginAt: new Date() },
      });
      const session = await this.auth.issueSessionForUser(linked.userId, meta);
      return { status: "approved" as const, session };
    }

    const company = await this.prisma.company.findFirst({ select: { id: true } });
    if (!company) throw new ServiceUnavailableException("Empresa no configurada");
    await this.prisma.registrationRequest.upsert({
      where: {
        provider_providerSubject: {
          provider: identity.provider,
          providerSubject: identity.subject,
        },
      },
      create: {
        companyId: company.id,
        provider: identity.provider,
        providerSubject: identity.subject,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
      },
      update: {
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        status: RegistrationStatus.PENDING,
        requestedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
      },
    });
    return { status: "pending" as const };
  }

  private async exchangeCode(
    provider: ProviderConfig,
    code: string,
    verifier: string,
  ) {
    let response: Response;
    try {
      response = await fetch(provider.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          redirect_uri: provider.redirectUri,
          code_verifier: verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException("El proveedor de identidad no respondió");
    }
    if (!response.ok) {
      throw new UnauthorizedException("El código OAuth no pudo validarse");
    }
    const payload = (await response.json()) as { id_token?: string };
    if (!payload.id_token) {
      throw new UnauthorizedException("El proveedor no emitió un ID token");
    }
    return payload.id_token;
  }

  private async verifyIdentity(
    provider: OAuthProviderSlug,
    config: ProviderConfig,
    idToken: string,
    nonce: string,
  ): Promise<IdentityClaims> {
    let payload: JWTPayload;
    try {
      if (provider === "google") {
        ({ payload } = await jwtVerify(idToken, this.googleJwks, {
          algorithms: ["RS256"],
          audience: config.clientId,
          issuer: ["https://accounts.google.com", "accounts.google.com"],
        }));
      } else {
        ({ payload } = await jwtVerify(idToken, this.microsoftJwks, {
          algorithms: ["RS256"],
          audience: config.clientId,
        }));
        const tenant = typeof payload.tid === "string" ? payload.tid : "";
        const expectedIssuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
        if (!tenant || payload.iss !== expectedIssuer) {
          throw new Error("issuer mismatch");
        }
      }
    } catch {
      throw new UnauthorizedException("ID token no válido");
    }
    if (
      typeof payload.nonce !== "string" ||
      !this.constantTimeEquals(payload.nonce, nonce) ||
      typeof payload.sub !== "string"
    ) {
      throw new UnauthorizedException("Nonce o sujeto OIDC no válido");
    }
    if (provider === "google" && payload.email_verified !== true) {
      throw new UnauthorizedException("Google no verificó el correo");
    }
    const emailValue =
      provider === "microsoft"
        ? payload.email ?? payload.preferred_username
        : payload.email;
    const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new BadRequestException("El proveedor no entregó un correo válido");
    }
    const displayName = typeof payload.name === "string" ? payload.name.trim() : "";
    const parts = displayName.split(/\s+/).filter(Boolean);
    const firstName = this.cleanName(
      typeof payload.given_name === "string" ? payload.given_name : parts[0] ?? "Usuario",
    );
    const lastName = this.cleanName(
      typeof payload.family_name === "string"
        ? payload.family_name
        : parts.slice(1).join(" ") || "Externo",
    );
    return {
      provider: provider === "google" ? IdentityProvider.GOOGLE : IdentityProvider.MICROSOFT,
      subject: payload.sub.slice(0, 255),
      email,
      firstName,
      lastName,
    };
  }

  private providerConfig(provider: OAuthProviderSlug): ProviderConfig {
    const backend = this.config.get<string>("BACKEND_PUBLIC_URL", "http://localhost:4000").replace(/\/$/, "");
    const prefix = this.config.get<string>("API_PREFIX", "api/v1");
    const microsoftTenant = this.config.get<string>("MICROSOFT_TENANT", "common");
    const isGoogle = provider === "google";
    const clientId = this.config.get<string>(isGoogle ? "GOOGLE_CLIENT_ID" : "MICROSOFT_CLIENT_ID", "");
    const clientSecret = this.config.get<string>(isGoogle ? "GOOGLE_CLIENT_SECRET" : "MICROSOFT_CLIENT_SECRET", "");
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(`Inicio con ${provider} no configurado`);
    }
    return {
      clientId,
      clientSecret,
      authorizeUrl: isGoogle
        ? "https://accounts.google.com/o/oauth2/v2/auth"
        : `https://login.microsoftonline.com/${microsoftTenant}/oauth2/v2.0/authorize`,
      tokenUrl: isGoogle
        ? "https://oauth2.googleapis.com/token"
        : `https://login.microsoftonline.com/${microsoftTenant}/oauth2/v2.0/token`,
      jwksUrl: isGoogle
        ? "https://www.googleapis.com/oauth2/v3/certs"
        : "https://login.microsoftonline.com/common/discovery/v2.0/keys",
      redirectUri: `${backend}/${prefix}/auth/oauth/${provider}/callback`,
    };
  }

  private seal(value: OAuthState) {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  }

  private open(sealed: string): OAuthState {
    try {
      const value = Buffer.from(sealed, "base64url");
      if (value.length < 29) throw new Error("short state");
      const iv = value.subarray(0, 12);
      const tag = value.subarray(12, 28);
      const ciphertext = value.subarray(28);
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
      return JSON.parse(plaintext) as OAuthState;
    } catch {
      throw new UnauthorizedException("Estado OAuth no válido");
    }
  }

  private encryptionKey() {
    return createHash("sha256")
      .update(`${this.config.getOrThrow<string>("CSRF_SECRET")}:oauth-state`)
      .digest();
  }

  private constantTimeEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private cleanName(value: string) {
    return value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 100) || "Usuario";
  }
}
