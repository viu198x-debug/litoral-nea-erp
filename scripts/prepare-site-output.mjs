import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(projectRoot, "frontend", "out");
const destination = join(projectRoot, "out");

if (!existsSync(join(source, "index.html"))) {
  throw new Error("No se encontró frontend/out/index.html; ejecute primero el build del frontend.");
}

rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true, dereference: false });

if (!existsSync(join(destination, "index.html"))) {
  throw new Error("No se pudo preparar out/index.html para Sites.");
}

console.log("Salida estática preparada en out/.");
