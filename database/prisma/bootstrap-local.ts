/**
 * Aprovisionamiento mínimo de ERP LOCAL vacío. No crea obras, personal,
 * saldos, transacciones ni credenciales conocidas.
 *
 * Requiere NODE_ENV=development, LOCAL_BOOTSTRAP_ONLY=true y DATABASE_URL
 * apuntando al contenedor privado postgres/litoral_nea_erp_local.
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { modules } from "../../frontend/lib/modules";
import { recordDefinitions } from "../../frontend/lib/record-definitions";

const prisma = new PrismaClient();
const ACTIONS = ["view", "create", "modify", "approve", "void", "download", "export", "admin"] as const;
const LOCAL_TAX_ID = "LOCAL-ONLY-NO-CUIT";
const ADMIN_EMAIL = "admin.local@litoralnea.invalid";

function assertLocalConfiguration() {
  const address = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.LOCAL_BOOTSTRAP_ONLY !== "true" ||
    address.protocol !== "postgresql:" ||
    address.hostname !== "postgres" ||
    address.pathname !== "/litoral_nea_erp_local"
  ) {
    throw new Error("Aprovisionamiento permitido únicamente en el PostgreSQL local aislado.");
  }
  const password = process.env.LOCAL_ADMIN_PASSWORD ?? "";
  if (!/^[a-f0-9]{48}$/.test(password)) {
    throw new Error("LOCAL_ADMIN_PASSWORD debe generarse con npm run local:init.");
  }
  return password;
}

async function main() {
  const password = assertLocalConfiguration();
  const existing = await prisma.company.findMany({ select: { taxId: true } });
  if (existing.some((company) => company.taxId !== LOCAL_TAX_ID)) {
    throw new Error("La base ya contiene otra empresa: se prohíbe mezclar el inicio limpio con datos demo/reales.");
  }
  const count = await prisma.user.count();
  if (count && !(await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } }))) {
    throw new Error("Existen usuarios ajenos al aprovisionamiento local limpio.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { taxId: LOCAL_TAX_ID },
      update: {},
      create: {
        legalName: "LITORAL NEA SRL — DESARROLLO LOCAL",
        tradeName: "LITORAL NEA LOCAL",
        taxId: LOCAL_TAX_ID,
        settings: {
          locale: "es-AR", currency: "ARS",
          timezone: "America/Argentina/Cordoba",
          localDevelopment: true,
          demoData: false,
        },
      },
    });
    const role = await tx.role.upsert({
      where: { code: "ADMIN_GENERAL" },
      update: {},
      create: { code: "ADMIN_GENERAL", name: "Administrador General", isSystem: true },
    });

    let fieldCount = 0;
    for (const [sortOrder, definition] of modules.entries()) {
      const record = recordDefinitions[definition.slug];
      const module = await tx.moduleConfiguration.upsert({
        where: { slug: definition.slug },
        update: {},
        create: {
          slug: definition.slug,
          label: definition.label,
          groupName: definition.group,
          icon: definition.icon,
          summary: definition.summary,
          active: true,
          requiresWork: record?.requiresWork ?? false,
          isSystem: true,
          sortOrder,
        },
      });
      for (const [index, field] of (record?.fields ?? []).entries()) {
        await tx.moduleFieldConfiguration.upsert({
          where: { moduleId_fieldKey: { moduleId: module.id, fieldKey: field.key } },
          update: {},
          create: {
            moduleId: module.id, fieldKey: field.key,
            label: field.label,
            fieldType: field.type === "datetime-local" ? "datetime" : field.type,
            required: field.required ?? false,
            options: (field.options ?? []) as Prisma.InputJsonValue,
            settings: {
              placeholder: field.placeholder ?? null,
              section: field.section ?? null,
            },
            sortOrder: index,
          },
        });
        fieldCount++;
      }
      for (const action of ACTIONS) {
        const permission = await tx.permission.upsert({
          where: { module_action: { module: definition.slug, action } },
          update: {},
          create: { module: definition.slug, action },
        });
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id, allowed: true },
        });
      }
    }

    const admin = await tx.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {},
      create: {
        companyId: company.id,
        username: "localadmin",
        email: ADMIN_EMAIL,
        firstName: "Administrador",
        lastName: "Local",
        passwordHash,
      },
      select: { id: true, email: true },
    });
    const assignment = await tx.userRole.findFirst({
      where: { userId: admin.id, roleId: role.id, workId: null },
    });
    if (!assignment) await tx.userRole.create({ data: { userId: admin.id, roleId: role.id } });

    return { adminEmail: admin.email, modules: modules.length, fields: fieldCount };
  }, { timeout: 120_000, maxWait: 20_000 });

  console.log("Aprovisionamiento local completo:", result.modules, "módulos,",
    result.fields, "campos, administrador:", result.adminEmail);
  console.log("Contraseña: valor privado LOCAL_ADMIN_PASSWORD de .env.local (no se imprime).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
