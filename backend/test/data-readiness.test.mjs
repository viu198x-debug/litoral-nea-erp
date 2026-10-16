import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  CORE_MODULES,
  EXPECTED_MIGRATIONS,
  DataReadinessService,
} = require("../dist/system/data-readiness.service.js");

const fixture = (migrationOverrides = [], moduleOverrides = []) => ({
  $queryRaw: async () => migrationOverrides.length ? migrationOverrides :
    EXPECTED_MIGRATIONS.map((migration_name) => ({
      migration_name, finished_at: new Date(), rolled_back_at: null,
    })),
  moduleConfiguration: {
    findMany: async () => moduleOverrides.length ? moduleOverrides :
      CORE_MODULES.map((slug) => ({
        slug, active: true, fields: ["dashboard", "management", "approvals", "system"].includes(slug)
          ? [] : [{ id: slug + "-field" }],
      })),
  },
});

test("la lista de migraciones se corresponde con las carpetas reales del esquema Prisma", async () => {
  const dirs = (await readdir(new URL("../../database/prisma/migrations/", import.meta.url), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual([...EXPECTED_MIGRATIONS].sort(), dirs);
});

test("los módulos del diagnóstico reflejan exactamente los 45 slugs de navegación", async () => {
  const source = await readFile(new URL("../../frontend/lib/modules.ts", import.meta.url), "utf8");
  const slugs = [...source.matchAll(/\bslug: "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.equal(slugs.length, 45);
  assert.deepEqual(CORE_MODULES, slugs);
});

test("el seed de permisos no conserva la lista vieja de 34 módulos", async () => {
  const source = await readFile(new URL("../../database/prisma/seed.ts", import.meta.url), "utf8");
  assert.match(source, /for \(const \{ slug: module \} of moduleUiDefinitions\)/);
});

test("diagnóstico listo si las migraciones y todos los módulos están presentes", async () => {
  const result = await new DataReadinessService(fixture()).assess();
  assert.equal(result.status, "READY_FOR_REVIEW");
  assert.equal(result.modules.expected, 45);
  assert.equal(result.modules.missing.length, 0);
  assert.equal(result.migrations.missing.length, 0);
  assert.equal(result.productionReady, false);
  assert.equal(result.migrationAppliedByThisRequest, false);
  assert.equal(JSON.stringify(result).includes("DATABASE_URL"), false);
});

test("diagnóstico detecta migraciones incompletas y módulos ausentes", async () => {
  const migrations = EXPECTED_MIGRATIONS.slice(0, -1).map((migration_name) => ({
    migration_name, finished_at: new Date(), rolled_back_at: null,
  }));
  migrations.push({ migration_name: EXPECTED_MIGRATIONS.at(-1), finished_at: null, rolled_back_at: null });
  const modules = CORE_MODULES.filter((slug) => slug !== "banks")
    .map((slug) => ({ slug, active: true, fields: [{ id: slug }] }));
  const result = await new DataReadinessService(fixture(migrations, modules)).assess();
  assert.equal(result.status, "ACTION_REQUIRED");
  assert.ok(result.modules.missing.includes("banks"));
  assert.ok(result.migrations.missing.includes(EXPECTED_MIGRATIONS.at(-1)));
  assert.ok(result.migrations.incomplete.includes(EXPECTED_MIGRATIONS.at(-1)));
});

test("diagnóstico falla cerrado si no puede consultar PostgreSQL", async () => {
  const database = fixture();
  database.$queryRaw = async () => { throw new Error("postgresql://sensitive:password@private-host/db"); };
  await assert.rejects(
    new DataReadinessService(database).assess(),
    (error) => error.getStatus() === 503 && !error.message.includes("private-host"),
  );
});

test("endpoint requiere permiso administrativo y sólo ofrece GET", async () => {
  const source = await readFile(new URL("../src/system/data-readiness.controller.ts", import.meta.url), "utf8");
  assert.match(source, /@RequirePermission\("system", "admin"\)/);
  assert.match(source, /@Get\(\)/);
  assert.doesNotMatch(source, /@Post\(|@Patch\(|@Delete\(/);
});
