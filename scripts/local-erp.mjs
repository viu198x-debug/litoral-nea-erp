#!/usr/bin/env node
// Herramientas para ERP LOCAL. No conecta a Render, Neon, VPS ni redes públicas.
import { randomBytes, createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env.local");
const composeFile = join(root, "docker-compose.local.yml");
const backupsDir = join(root, "backups", "local");
const argsBase = ["compose", "--env-file", envFile, "-f", composeFile];

function fail(message) {
  console.error("ERROR:", message);
  process.exitCode = 1;
}
function compose(args, options = {}) {
  const result = spawnSync("docker", [...argsBase, ...args], {
    cwd: root, stdio: "inherit", ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Docker Compose terminó con error (" + result.status + ")");
}
async function env() {
  const text = await readFile(envFile, "utf8").catch(() => {
    throw new Error("Falta .env.local. Ejecutar primero: npm run local:init");
  });
  const parsed = Object.fromEntries(text.split(/\r?\n/).filter((line) =>
    /^[A-Z0-9_]+=/.test(line)
  ).map((line) => {
    const i = line.indexOf("=");
    return [line.slice(0, i), line.slice(i + 1)];
  }));
  // Guardrail contra un archivo manipulado: sólo se permite la base LOCAL.
  if (parsed.POSTGRES_DB !== "litoral_nea_erp_local" || parsed.POSTGRES_USER !== "lnea_local") {
    throw new Error("Este comando sólo opera con POSTGRES_DB=litoral_nea_erp_local y POSTGRES_USER=lnea_local");
  }
  if (!/^[a-f0-9]{48}$/.test(parsed.POSTGRES_PASSWORD ?? "")) {
    throw new Error("La contraseña local no corresponde al formato generado; revisar la configuración");
  }
  return parsed;
}
async function init() {
  const secret = (bytes) => randomBytes(bytes).toString("hex");
  const values = [
    "# ERP local: uso exclusivo en esta computadora; nunca subir este archivo a Git.",
    "APP_PORT=8080",
    "POSTGRES_DB=litoral_nea_erp_local",
    "POSTGRES_USER=lnea_local",
    "POSTGRES_PASSWORD=" + secret(24),
    "JWT_ACCESS_SECRET=" + secret(48),
    "JWT_REFRESH_SECRET=" + secret(48),
    "CSRF_SECRET=" + secret(48),
    "SEED_ADMIN_PASSWORD=" + secret(24),
    "SEED_USER_PASSWORD=" + secret(24),
    "LOCAL_ADMIN_PASSWORD=" + secret(24),
    "",
  ].join("\n");
  try {
    await writeFile(envFile, values, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(".env.local ya existe: no se modifica ni reemplaza.");
    throw error;
  }
  console.log("Configuración local creada en .env.local (permisos restringidos donde el SO lo admite).");
  console.log("No se muestra ninguna contraseña en pantalla.");
}
function child(args, options = {}) {
  return spawn("docker", [...argsBase, ...args], { cwd: root, ...options });
}
async function dumpBackup() {
  const config = await env();
  await mkdir(backupsDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "Z");
  const file = join(backupsDir, "lnea_local_" + stamp + ".dump");
  const checksum = createHash("sha256");
  const output = createWriteStream(file, { flags: "wx", mode: 0o600 });
  const processDump = child([
    "exec", "-T", "postgres", "pg_dump", "-Fc", "--no-owner",
    "--no-privileges", "-U", config.POSTGRES_USER, "-d", config.POSTGRES_DB,
  ], { stdio: ["ignore", "pipe", "inherit"] });
  const exit = new Promise((res, rej) => {
    processDump.once("error", rej);
    processDump.once("close", res);
  });
  try {
    await pipeline(processDump.stdout, new Transform({
      transform(chunk, _encoding, callback) {
        checksum.update(chunk);
        callback(null, chunk);
      },
    }), output);
    const code = await exit;
    if (code !== 0) throw new Error("pg_dump finalizó con estado " + code);
    await writeFile(file + ".sha256", checksum.digest("hex") + "  " + basename(file) + "\n", { flag: "wx", mode: 0o600 });
    console.log("Respaldo local creado:", file);
    return file;
  } catch (error) {
    await unlink(file).catch(() => {});
    throw error;
  }
}
async function verifyBackup(file) {
  const actualPath = resolve(file);
  if (dirname(actualPath) !== backupsDir || !/^lnea_local_[0-9TZ]+\.dump$/.test(basename(actualPath))) {
    throw new Error("El respaldo debe ser un archivo lnea_local_*.dump dentro de backups/local");
  }
  if (!(await stat(actualPath)).isFile()) throw new Error("Respaldo inválido");
  const manifest = (await readFile(actualPath + ".sha256", "utf8")).trim().split(/\s+/);
  if (manifest.length !== 2 || manifest[1] !== basename(actualPath)) throw new Error("Manifest SHA-256 incorrecto");
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(actualPath)) digest.update(chunk);
  if (digest.digest("hex") !== manifest[0]) throw new Error("El respaldo no supera la validación SHA-256");
  return actualPath;
}
async function restore(file, flag) {
  const config = await env();
  if (flag !== "--confirm-local-restore") {
    throw new Error("Restauración destructiva. Agregar --confirm-local-restore después del archivo (sólo BD local).");
  }
  const source = await verifyBackup(file);
  console.log("SHA-256 verificado. Se creará un respaldo de seguridad antes de restaurar.");
  await dumpBackup();
  compose(["stop", "backend"]);
  try {
    const processRestore = child([
      "exec", "-T", "postgres", "pg_restore", "--clean", "--if-exists",
      "--exit-on-error", "--no-owner", "--no-privileges",
      "-U", config.POSTGRES_USER, "-d", config.POSTGRES_DB,
    ], { stdio: ["pipe", "inherit", "inherit"] });
    const sourceStream = createReadStream(source);
    const io = pipeline(sourceStream, processRestore.stdin);
    const result = new Promise((res, rej) => {
      processRestore.once("error", rej);
      processRestore.once("close", res);
    });
    await io;
    const code = await result;
    if (code !== 0) throw new Error("La restauración terminó con errores (" + code + ")");
    console.log("Restauración del PostgreSQL LOCAL finalizada.");
  } finally {
    compose(["start", "backend"]);
  }
}
async function main() {
  const command = process.argv[2];
  if (command === "init") return init();
  await env();
  switch (command) {
    case "up": return compose(["up", "--build", "-d"]);
    case "down": return compose(["down"]); // Nunca -v: conserva volúmenes.
    case "ps": return compose(["ps"]);
    case "logs": return compose(["logs", "--tail", "120", "backend"]);
    case "bootstrap":
      return compose(["exec", "-T", "backend", "./node_modules/.bin/tsx", "database/prisma/bootstrap-local.ts"]);
    case "seed-demo": {
      const query = spawnSync("docker", [...argsBase, "exec", "-T", "postgres",
        "psql", "-U", "lnea_local", "-d", "litoral_nea_erp_local",
        "-tAc", 'SELECT count(*) FROM "Company"'], {
        cwd: root, encoding: "utf8",
      });
      if (query.error) throw query.error;
      if (query.status !== 0 || query.stdout.trim() !== "0") {
        throw new Error("El seed demo sólo se permite en una base vacía; no mezclar con el entorno local real.");
      }
      return compose(["exec", "-T", "backend", "./node_modules/.bin/tsx", "database/prisma/seed.ts"]);
    }
    case "backup": return dumpBackup();
    case "restore": return restore(process.argv[3], process.argv[4]);
    default: throw new Error("Comando disponible: init | up | down | ps | logs | bootstrap | seed-demo | backup | restore");
  }
}
main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
