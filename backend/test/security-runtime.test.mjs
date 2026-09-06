import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { validateEnvironment } = require("../dist/config/environment.js");
const { CsrfService } = require("../dist/security/csrf.service.js");

test("CSRF emite cookies endurecidas y rechaza manipulación", () => {
  const values = new Map();
  const config = {
    get: (key, fallback) =>
      key === "COOKIE_SECURE"
        ? "true"
        : key === "CSRF_SECRET"
          ? "C".repeat(64)
          : fallback,
    getOrThrow: (key) => {
      if (key === "CSRF_SECRET") return "C".repeat(64);
      throw new Error(`missing ${key}`);
    },
  };
  const response = {
    cookie: (name, value) => {
      values.set(name, value);
      return response;
    },
    clearCookie: () => response,
  };
  const csrf = new CsrfService(config);
  const token = csrf.issue(response, "session-binding");

  assert.equal(csrf.cookieNames.access, "__Host-lnea_access");
  assert.equal(values.get("__Host-lnea_csrf"), token);
  assert.equal(csrf.verify("session-binding", token), true);
  assert.equal(csrf.verify("another-session", token), false);
  assert.equal(csrf.verify("session-binding", `${token}x`), false);
});

test("el entorno productivo falla cerrado ante una configuración insegura", () => {
  const secure = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://lnea:Clave-Segura@postgres:5432/litoral",
    FRONTEND_URL: "https://erp.example.com",
    BACKEND_PUBLIC_URL: "https://erp.example.com",
    COOKIE_SECURE: "true",
    JWT_ACCESS_SECRET: "A".repeat(64),
    JWT_REFRESH_SECRET: "B".repeat(64),
    CSRF_SECRET: "C".repeat(64),
  };
  const parsed = validateEnvironment(secure);
  assert.equal(parsed.RATE_LIMIT_MAX, 120);
  assert.throws(
    () => validateEnvironment({ ...secure, COOKIE_SECURE: "false" }),
    /COOKIE_SECURE/,
  );
  assert.throws(
    () => validateEnvironment({ ...secure, SEED_DEMO: "true" }),
    /SEED_DEMO/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...secure,
        GOOGLE_CLIENT_ID: "configured-client",
        GOOGLE_CLIENT_SECRET: "",
      }),
    /deben configurarse juntos/,
  );
});
