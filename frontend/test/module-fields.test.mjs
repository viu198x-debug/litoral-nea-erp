import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("los 45 módulos cuentan con definición explícita y sin slugs duplicados", async () => {
  const navigation = await read("../lib/modules.ts");
  const records = await read("../lib/record-definitions.ts");
  const specialized = await read("../lib/module-field-catalog.ts");

  const moduleSlugs = [...navigation.matchAll(/\bslug: "([^"]+)"/g)].map((match) => match[1]);
  const recordSlugs = [...records.matchAll(/^  (?:"([^"]+)"|([a-z][\w-]*)): \{\s*codePrefix:/gm)]
    .map((match) => match[1] || match[2]);
  const specializedSlugs = [...specialized.matchAll(/^  (dashboard|management|approvals|system): \{/gm)]
    .map((match) => match[1]);

  assert.equal(moduleSlugs.length, 45);
  assert.equal(new Set(moduleSlugs).size, 45);
  assert.equal(recordSlugs.length, 41);
  assert.equal(new Set(recordSlugs).size, 41);
  assert.deepEqual(specializedSlugs.sort(), ["approvals", "dashboard", "management", "system"]);
  assert.equal(new Set([...recordSlugs, ...specializedSlugs]).size, 45);
  assert.deepEqual([...new Set([...recordSlugs, ...specializedSlugs])].sort(), [...moduleSlugs].sort());
  assert.match(specialized, /moduleFieldCatalog: ModuleFieldCatalogEntry\[\] = modules\.map/);
  assert.match(specialized, /mode: "specialized"/);
});

test("los módulos de gestión usan endpoints específicos sin registrar CRUD genérico", async () => {
  const app = await read("../components/erp-app.tsx");
  const approvals = await read("../components/approvals-page.tsx");

  assert.match(app, /activeSlug === "approvals" \?/);
  assert.match(app, /<ApprovalsPage/);
  assert.match(app, /module\.slug === "management" \|\| module\.slug === "system"/);
  assert.match(app, /<SpecializedFieldOverview slug=\{module\.slug\}/);
  assert.match(app, /"management", "system", "approvals"\]\.includes\(module\.slug\)/);
  assert.match(approvals, /request\(\`\/approvals\$\{query\}\`/);
  assert.match(approvals, /request\(\`\/approvals\/\$\{encodeURIComponent\(item\.id\)\}\/decision\`/);
  assert.match(approvals, /decision === "REJECTED" && !reason/);
  assert.match(approvals, /!canApprove \|\| busyId \|\| demoMode/);
});
