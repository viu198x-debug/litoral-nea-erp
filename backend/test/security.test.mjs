import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la API aplica autenticación, autorización, CSRF, límites y auditoría globales", async () => {
  const source = await readFile(new URL("../src/app.module.ts", import.meta.url), "utf8");
  const audit = await readFile(new URL("../src/common/audit.interceptor.ts", import.meta.url), "utf8");
  assert.match(source, /ThrottlerGuard/);
  assert.match(source, /JwtAuthGuard/);
  assert.match(source, /CsrfGuard/);
  assert.match(source, /PermissionsGuard/);
  assert.match(source, /AuditInterceptor/);
  assert.match(audit, /before/);
  assert.match(audit, /await this\.prisma\.auditLog\.create/);
  assert.match(audit, /\[REDACTED\]/);
});

test("el servidor limita cuerpos y agrega cabeceras defensivas", async () => {
  const source = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
  assert.match(source, /bodyParser: false/);
  assert.match(source, /helmet\(/);
  assert.match(source, /contentSecurityPolicy/);
  assert.match(source, /x-powered-by/);
  assert.match(source, /JSON_BODY_LIMIT/);
  assert.match(source, /forbidNonWhitelisted: true/);
});

test("las sesiones validan estado, rotan refresh y fijan JWT", async () => {
  const source = await readFile(new URL("../src/auth/auth.service.ts", import.meta.url), "utf8");
  assert.match(source, /INVALID_PASSWORD_HASH/);
  assert.match(source, /Buffer\.byteLength\(dto\.password/);
  assert.match(source, /refreshTokenHash: await bcrypt\.hash/);
  assert.match(source, /algorithms: \["HS256"\]/);
  assert.match(source, /MAX_ACTIVE_SESSIONS/);
  assert.match(source, /session\.updateMany/);
});

test("OAuth usa Authorization Code, PKCE, state, nonce y aprobación previa", async () => {
  const source = await readFile(new URL("../src/auth/oauth.service.ts", import.meta.url), "utf8");
  assert.match(source, /code_challenge_method: "S256"/);
  assert.match(source, /state\.nonce/);
  assert.match(source, /jwtVerify/);
  assert.match(source, /RegistrationStatus\.PENDING/);
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /timingSafeEqual/);
});

test("la protección CSRF está firmada, vinculada y admite Bearer sin cookie", async () => {
  const service = await readFile(new URL("../src/security/csrf.service.ts", import.meta.url), "utf8");
  const guard = await readFile(new URL("../src/security/csrf.guard.ts", import.meta.url), "utf8");
  assert.match(service, /createHmac/);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /__Host-/);
  assert.match(guard, /sec-fetch-site/);
  assert.match(guard, /x-csrf-token/);
  assert.match(guard, /Bearer/);
});

test("los documentos se validan por firma, ruta y hash en streaming", async () => {
  const source = await readFile(new URL("../src/documents/documents.service.ts", import.meta.url), "utf8");
  const controller = await readFile(new URL("../src/documents/documents.controller.ts", import.meta.url), "utf8");
  assert.match(source, /matchesSignature/);
  assert.match(source, /createReadStream/);
  assert.match(source, /sha256/);
  assert.match(source, /storageRoot/);
  assert.match(controller, /randomUUID/);
  assert.match(controller, /fileSize/);
});

test("producción rechaza secretos débiles, HTTP y OAuth incompleto", async () => {
  const source = await readFile(new URL("../src/config/environment.ts", import.meta.url), "utf8");
  assert.match(source, /al menos 48 caracteres/);
  assert.match(source, /FRONTEND_URL debe usar HTTPS/);
  assert.match(source, /BACKEND_PUBLIC_URL debe usar HTTPS/);
  assert.match(source, /deben configurarse juntos/);
  assert.match(source, /COOKIE_SECURE debe ser true/);
  assert.match(source, /SEED_DEMO debe ser false/);
});

test("la migración vuelve inmutables auditoría y eventos históricos", async () => {
  const migration = await readFile(
    new URL("../../database/prisma/migrations/20260904170000_security_oauth/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /AuditLog_append_only/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "AuditLog"/);
  assert.match(migration, /FinancialMovement_no_delete/);
  assert.match(migration, /DocumentVersion_no_delete/);
  assert.match(migration, /RegistrationRequest/);
});

test("los técnicos quedan limitados a las obras asignadas", async () => {
  const guard = await readFile(new URL("../src/auth/guards/permissions.guard.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../src/dashboard/dashboard.service.ts", import.meta.url), "utf8");
  assert.match(guard, /code\.startsWith\("TEC_"\)/);
  assert.match(guard, /workMember\.findFirst/);
  assert.match(guard, /El técnico no está asignado a esta obra/);
  assert.match(dashboard, /restrictToAssignedWorks/);
  assert.match(dashboard, /members: \{ some: \{ userId, endDate: null \} \}/);
});
