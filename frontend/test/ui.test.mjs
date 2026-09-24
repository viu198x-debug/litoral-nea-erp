import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la navegación expone los 45 módulos definidos", async () => {
  const source = await readFile(new URL("../lib/modules.ts", import.meta.url), "utf8");
  const entries = source.match(/slug: "/g) ?? [];
  assert.equal(entries.length, 45);
});

test("el frontend conserva las ocho obras demo", async () => {
  const source = await readFile(new URL("../lib/demo-data.ts", import.meta.url), "utf8");
  const works = source.match(/code: "OB-2026-/g) ?? [];
  assert.equal(works.length, 8);
});

test("la portada institucional presenta empresa, servicios, obras y contacto", async () => {
  const source = await readFile(new URL("../components/erp-app.tsx", import.meta.url), "utf8");
  assert.match(source, /function LandingPage/);
  assert.match(source, /QUIÉNES SOMOS/);
  assert.match(source, /QUÉ HACEMOS/);
  assert.match(source, /OBRAS Y PROYECTOS/);
  assert.match(source, /CONTACTO/);
  assert.match(source, /Iniciar sesión/);
});

test("el login ofrece Google y Microsoft con aprobación administrativa", async () => {
  const source = await readFile(new URL("../components/erp-app.tsx", import.meta.url), "utf8");
  assert.match(source, /startOAuth\("google"\)/);
  assert.match(source, /startOAuth\("microsoft"\)/);
  assert.match(source, /requiere aprobación del Administrador General/);
  assert.match(source, /function RegistrationRequestsPanel/);
  assert.match(source, /Aprobar usuario/);
});

test("los siete usuarios demo tienen roles y contraseñas diferentes", async () => {
  const source = await readFile(new URL("../lib/demo-users.ts", import.meta.url), "utf8");
  assert.equal((source.match(/username: "/g) ?? []).length, 7);
  assert.equal(new Set([...source.matchAll(/password: "([^"]+)"/g)].map((match) => match[1])).size, 7);
  for (const role of ["ADMIN_GENERAL", "ADM_COMPRAS_TESORERIA", "ADM_CONTABLE_IMPOSITIVO", "ADM_RRHH_DOCUMENTAL", "TEC_JEFE_OBRA", "TEC_OFICINA_TECNICA", "TEC_EQUIPOS_LOGISTICA"]) {
    assert.match(source, new RegExp(role));
  }
});

test("las mutaciones del frontend incluyen CSRF y credenciales", async () => {
  const source = await readFile(new URL("../components/erp-app.tsx", import.meta.url), "utf8");
  assert.match(source, /X-CSRF-Token/);
  assert.match(source, /credentials: "include"/);
  assert.match(source, /apiFetch/);
});

test("las vistas institucionales y ERP tienen cortes responsive", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.mobile-sheet \{\s*position: fixed !important;\s*inset: 0 auto 0 0 !important;/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /\.public-service-grid/);
  assert.match(css, /\.registration-actions/);
});

test("la navegación de escritorio ocupa la primera columna con ancho fijo", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../components/erp-app.tsx", import.meta.url), "utf8");
  assert.match(css, /--sidebar-width: 270px/);
  assert.match(css, /\.desktop-sidebar \{[\s\S]*?grid-column: 1;[\s\S]*?width: var\(--sidebar-width\)/);
  assert.match(css, /\.erp-main \{\s*grid-column: 2;/);
  assert.match(source, /<Toaster richColors position="top-right" \/>\s*<div className="erp-app">\s*<aside className="desktop-sidebar">/);
});

test("los 41 módulos registrables tienen formularios con datos característicos", async () => {
  const source = await readFile(new URL("../lib/record-definitions.ts", import.meta.url), "utf8");
  assert.equal((source.match(/codePrefix:/g) ?? []).length - 1, 41);
  for (const characteristic of [
    "Monto contractual", "Número de plano", "Curva S", "Fondo de reparo",
    "CUIT", "Stock mínimo", "Conciliado", "Débito fiscal", "RTO / VTV",
    "Horómetro", "Costo por m³", "Cargas sociales", "Comprobantes",
  ]) assert.match(source, new RegExp(characteristic.replace("/", "\\/")));
});

test("Tesorería integra bancos, ahorros, billeteras, efectivo, cheques y controles", async () => {
  const source = await readFile(new URL("../components/treasury-page.tsx", import.meta.url), "utf8");
  const modules = await readFile(new URL("../lib/modules.ts", import.meta.url), "utf8");
  const users = await readFile(new URL("../lib/demo-users.ts", import.meta.url), "utf8");
  for (const capability of [
    "Cuentas corrientes", "Cajas de ahorro", "Billeteras virtuales", "Efectivo",
    "Registrar cheque", "Conciliación bancaria", "Arqueo de caja", "Cierre diario",
  ]) assert.match(source, new RegExp(capability));
  assert.match(modules, /slug: "treasury"/);
  assert.match(users, /ADM_COMPRAS_TESORERIA[\s\S]*?"treasury"/);
  assert.match(source, /Quien registra no aprueba su propio movimiento/);
});

test("el configurador convierte módulos dinámicos en formularios operativos", async () => {
  const source = await readFile(new URL("../components/erp-app.tsx", import.meta.url), "utf8");
  assert.match(source, /recordDefinition: module\.fields/);
  assert.match(source, /module\.recordDefinition \?\?/);
  assert.match(source, /updateField/);
  assert.match(source, /function WorkflowConfiguratorPanel/);
});
