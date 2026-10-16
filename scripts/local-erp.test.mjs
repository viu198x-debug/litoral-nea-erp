import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(file, import.meta.url), "utf8");

test("Compose local tiene gateway limitado a loopback y BD/API no expuestas", async () => {
  const compose = await read("../docker-compose.local.yml");
  assert.match(compose, /name: litoral-nea-erp-local/);
  assert.match(compose, /127\.0\.0\.1:\$\{APP_PORT:-8080\}:8080/);
  assert.match(compose, /internal: true/);
  assert.match(compose, /DATABASE_URL: postgresql:\/\/\$\{POSTGRES_USER:/);
  assert.match(compose, /@postgres:5432\//);
  assert.match(compose, /SEED_DEMO: "false"/);
  const parts = compose.split(/^  (?=postgres:|backend:|frontend:|gateway:)/m);
  for (const part of parts) {
    if (/^(postgres:|backend:|frontend:)/.test(part)) {
      assert.doesNotMatch(part, /^    ports:/m);
    }
  }
  assert.match(compose, /volumes:[\s\S]*postgres_local_data/);
  assert.match(compose, /document_local_data/);
  assert.doesNotMatch(compose, /fromDatabase|onrender\.com|neon\.tech/);
});

test("el mecanismo de arranque original no se publica por defecto en toda la red", async () => {
  const compose = await read("../docker-compose.yml");
  assert.match(compose, /127\.0\.0\.1:\$\{APP_PORT:-8080\}:8080/);
  assert.match(compose, /SEED_DEMO: \$\{SEED_DEMO:-false\}/);
});

test("setup local no sobrescribe secretos ni admite credenciales remotas", async () => {
  const script = await read("./local-erp.mjs");
  assert.match(script, /flag: "wx", mode: 0o600/);
  assert.match(script, /POSTGRES_DB !== "litoral_nea_erp_local"/);
  assert.match(script, /POSTGRES_USER !== "lnea_local"/);
  assert.match(script, /pg_dump/);
  assert.match(script, /bootstrap-local\.ts/);
  assert.match(script, /El seed demo sólo se permite en una base vacía/);
  assert.match(script, /pg_restore/);
  assert.match(script, /--confirm-local-restore/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.match(script, /compose\(\["down"\]\)/);
  assert.doesNotMatch(script, /down", "-v"/);
  assert.doesNotMatch(script, /onrender\.com|neon\.tech|https?:\/\//);
});

test("el runtime del backend contiene el catálogo TypeScript requerido por seed-demo", async () => {
  const docker = await read("../backend/Dockerfile");
  assert.match(docker, /COPY frontend\/lib \.\/frontend\/lib/);
  assert.match(docker, /COPY --from=build \/app\/frontend\/lib \.\/frontend\/lib/);
});

test("Docker ignora secretos y respaldos", async () => {
  const ignore = await read("../.dockerignore");
  for (const entry of [".env.*", "backups", "storage", "node_modules", ".git"]) {
    assert.ok(ignore.split(/\r?\n/).includes(entry), entry);
  }
});
