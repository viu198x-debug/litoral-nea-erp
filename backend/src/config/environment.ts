const DEVELOPMENT_DEFAULTS = {
  JWT_ACCESS_SECRET: "reemplazar_por_64_caracteres_aleatorios",
  JWT_REFRESH_SECRET: "reemplazar_por_otro_secreto_64_caracteres",
  CSRF_SECRET: "reemplazar_por_un_tercer_secreto_64_caracteres",
};

function requireSecret(
  config: Record<string, unknown>,
  key: keyof typeof DEVELOPMENT_DEFAULTS,
  production: boolean,
) {
  const value = String(config[key] ?? DEVELOPMENT_DEFAULTS[key]);
  if (production && (value.length < 48 || value === DEVELOPMENT_DEFAULTS[key])) {
    throw new Error(`${key} debe ser un secreto aleatorio de al menos 48 caracteres`);
  }
  config[key] = value;
}

function integerInRange(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const value = Number(config[key] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} debe ser un entero entre ${minimum} y ${maximum}`);
  }
  config[key] = value;
}

export function validateEnvironment(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const config = { ...raw };
  const nodeEnv = String(config.NODE_ENV ?? "development");
  const production = nodeEnv === "production";

  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV debe ser development, test o production");
  }
  config.NODE_ENV = nodeEnv;

  requireSecret(config, "JWT_ACCESS_SECRET", production);
  requireSecret(config, "JWT_REFRESH_SECRET", production);
  requireSecret(config, "CSRF_SECRET", production);

  const secrets = [
    config.JWT_ACCESS_SECRET,
    config.JWT_REFRESH_SECRET,
    config.CSRF_SECRET,
  ];
  if (production && new Set(secrets).size !== secrets.length) {
    throw new Error("JWT_ACCESS_SECRET, JWT_REFRESH_SECRET y CSRF_SECRET deben ser distintos");
  }

  const databaseUrl = String(config.DATABASE_URL ?? "");
  if (!databaseUrl.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL debe usar PostgreSQL");
  }
  if (production && /cambiar_en_produccion|password|example/i.test(databaseUrl)) {
    throw new Error("DATABASE_URL contiene una credencial de ejemplo");
  }

  const origins = String(config.FRONTEND_URL ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!origins.length || origins.includes("*")) {
    throw new Error("FRONTEND_URL debe contener orígenes explícitos");
  }
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("FRONTEND_URL sólo admite orígenes, sin rutas");
    }
    if (production && parsed.protocol !== "https:") {
      throw new Error("FRONTEND_URL debe usar HTTPS en producción");
    }
  }
  config.FRONTEND_URL = origins.join(",");

  if (production && String(config.COOKIE_SECURE ?? "false") !== "true") {
    throw new Error("COOKIE_SECURE debe ser true en producción");
  }
  if (production && String(config.SEED_DEMO ?? "false") === "true") {
    throw new Error("SEED_DEMO debe ser false en producción");
  }

  const backendPublicUrl = String(
    config.BACKEND_PUBLIC_URL ?? "http://localhost:4000",
  ).replace(/\/$/, "");
  const parsedBackendUrl = new URL(backendPublicUrl);
  if (parsedBackendUrl.pathname !== "/" || parsedBackendUrl.search || parsedBackendUrl.hash) {
    throw new Error("BACKEND_PUBLIC_URL sólo admite un origen, sin rutas");
  }
  if (production && parsedBackendUrl.protocol !== "https:") {
    throw new Error("BACKEND_PUBLIC_URL debe usar HTTPS en producción");
  }
  config.BACKEND_PUBLIC_URL = backendPublicUrl;

  for (const [clientKey, secretKey] of [
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
  ] as const) {
    const client = String(config[clientKey] ?? "").trim();
    const secret = String(config[secretKey] ?? "").trim();
    if (Boolean(client) !== Boolean(secret)) {
      throw new Error(`${clientKey} y ${secretKey} deben configurarse juntos`);
    }
    config[clientKey] = client;
    config[secretKey] = secret;
  }
  const microsoftTenant = String(config.MICROSOFT_TENANT ?? "common").trim();
  if (
    !/^(?:common|organizations|consumers|[a-z0-9][a-z0-9.-]{0,253}[a-z0-9])$/i.test(
      microsoftTenant,
    ) ||
    microsoftTenant.includes("..")
  ) {
    throw new Error("MICROSOFT_TENANT no es válido");
  }
  config.MICROSOFT_TENANT = microsoftTenant;

  const maxUploadMb = Number(config.MAX_UPLOAD_MB ?? 50);
  if (!Number.isFinite(maxUploadMb) || maxUploadMb < 1 || maxUploadMb > 100) {
    throw new Error("MAX_UPLOAD_MB debe estar entre 1 y 100");
  }
  config.MAX_UPLOAD_MB = maxUploadMb;

  integerInRange(config, "MAX_LOGIN_ATTEMPTS", 5, 3, 20);
  integerInRange(config, "LOCK_MINUTES", 15, 1, 1_440);
  integerInRange(config, "MAX_ACTIVE_SESSIONS", 5, 1, 20);
  integerInRange(config, "REFRESH_TOKEN_DAYS", 7, 1, 90);
  integerInRange(config, "RATE_LIMIT_TTL_MS", 60_000, 1_000, 3_600_000);
  integerInRange(config, "RATE_LIMIT_MAX", 120, 10, 10_000);

  const prefix = String(config.API_PREFIX ?? "api/v1");
  if (!/^[a-z0-9/-]+$/i.test(prefix) || prefix.includes("..")) {
    throw new Error("API_PREFIX no es válido");
  }
  config.API_PREFIX = prefix.replace(/^\/+|\/+$/g, "");

  const trustProxy = String(config.TRUST_PROXY ?? (production ? "true" : "false"));
  if (!['true', 'false'].includes(trustProxy)) {
    throw new Error("TRUST_PROXY debe ser true o false");
  }
  config.TRUST_PROXY = trustProxy;

  return config;
}
