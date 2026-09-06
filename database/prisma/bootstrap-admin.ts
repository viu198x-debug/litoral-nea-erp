import "dotenv/config";
import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();


async function ensureOperationalModules() {
  const definitions = [
    ["mechanics", "Mecánicos", "Operaciones", "Wrench", "Mecánicos internos/externos, especialidades y OT asignadas."],
    ["spare-parts", "Repuestos", "Operaciones", "Boxes", "Repuestos, stock, mínimos, costos y consumos."],
    ["fuel-estimates", "Estimación combustible", "Operaciones", "Fuel", "Estimación de litros por vehículo, obra y período contra consumo real."],
    ["insurance", "Pólizas y cauciones", "Operaciones", "ShieldCheck", "Seguros y cauciones con vigencias, endosos, renovaciones y pagos."],
    ["unexpected-tasks", "Trabajos imprevistos", "Operaciones", "ListChecks", "Tareas imprevistas asignadas con prioridad, recursos, costo y cierre."],
    ["technical-workspace", "Mi trabajo técnico", "Principal", "ClipboardCheck", "Bandeja personal del técnico con tareas, vencimientos, obras y entregables."],
    ["notifications", "Notificaciones", "Principal", "Bell", "Centro de avisos in-app, email y push preparado."],
    ["personnel-control", "Control de personal", "Personas", "ClipboardCheck", "Asignación, asistencia, horas y novedades por obra."],
    ["safety", "Seguridad e Higiene", "Personas", "ShieldCheck", "EPP, capacitaciones, incidentes, inspecciones y vencimientos."],
    ["assets", "Inventario de activos", "Operaciones", "Boxes", "Bienes móviles y no móviles, herramientas, informática e instalaciones."],
    ["stakeholders", "Terceros y dependencias", "Abastecimiento", "Building2", "Comitentes, contratistas, proveedores, acreedores y aseguradoras."],
  ] as const;
  const actions = ["view", "create", "modify", "approve", "void", "download", "export", "admin"];
  for (const [slug, label, groupName, icon, summary] of definitions) {
    await prisma.moduleConfiguration.upsert({
      where: { slug },
      update: { label, groupName, icon, summary, active: true },
      create: { slug, label, groupName, icon, summary, active: true, requiresWork: false, isSystem: true },
    });
    for (const action of actions) {
      await prisma.permission.upsert({
        where: { module_action: { module: slug, action } },
        update: {},
        create: { module: slug, action },
      });
    }
  }
}

async function ensureCoreRoles() {
  const adminRole = await prisma.role.upsert({
    where: { code: "ADMIN_GENERAL" },
    update: {
      name: "Administrador del Sistema",
      isSystem: true,
    },
    create: {
      code: "ADMIN_GENERAL",
      name: "Administrador del Sistema",
      isSystem: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { code: "GERENTE_EMPRESA" },
    update: {
      name: "Gerente de Empresa",
      isSystem: true,
    },
    create: {
      code: "GERENTE_EMPRESA",
      name: "Gerente de Empresa",
      isSystem: true,
    },
  });

  const permissions = await prisma.permission.findMany();
  const businessPermissions = permissions.filter(
    (permission) =>
      permission.module !== "system" &&
      permission.module !== "approvals" ? true : permission.module === "approvals",
  );

  await prisma.rolePermission.deleteMany({
    where: { roleId: managerRole.id },
  });

  await prisma.rolePermission.createMany({
    data: businessPermissions.map((permission) => ({
      roleId: managerRole.id,
      permissionId: permission.id,
      allowed: true,
    })),
    skipDuplicates: true,
  });

  const systemPermissions = permissions.filter(
    (permission) => permission.module === "system",
  );
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: managerRole.id,
      permissionId: { in: systemPermissions.map((permission) => permission.id) },
    },
  });

  console.log(`Roles base sincronizados: ${adminRole.name} / ${managerRole.name}`);
}


async function ensureExtendedRolePermissions() {
  const roles = await prisma.role.findMany({
    where: {
      code: {
        in: [
          "ADMIN_GENERAL",
          "GERENTE_EMPRESA",
          "ADM_COMPRAS_TESORERIA",
          "ADM_CONTABLE_IMPOSITIVO",
          "ADM_RRHH_DOCUMENTAL",
          "TEC_JEFE_OBRA",
          "TEC_OFICINA_TECNICA",
          "TEC_EQUIPOS_LOGISTICA",
        ],
      },
    },
  });
  const roleByCode = new Map(roles.map((role) => [role.code, role]));

  const grant = async (roleCodes: string[], modules: string[], actions: string[]) => {
    const permissions = await prisma.permission.findMany({
      where: { module: { in: modules }, action: { in: actions } },
    });
    const rows = [];
    for (const roleCode of roleCodes) {
      const role = roleByCode.get(roleCode);
      if (!role) continue;
      for (const permission of permissions) {
        rows.push({ roleId: role.id, permissionId: permission.id, allowed: true });
      }
    }
    if (rows.length) {
      await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  };

  const allPermissions = await prisma.permission.findMany();
  const admin = roleByCode.get("ADMIN_GENERAL");
  if (admin) {
    await prisma.rolePermission.createMany({
      data: allPermissions.map((permission) => ({
        roleId: admin.id,
        permissionId: permission.id,
        allowed: true,
      })),
      skipDuplicates: true,
    });
  }

  await grant(
    roles.map((role) => role.code),
    ["notifications"],
    ["view", "modify"],
  );

  await grant(
    ["TEC_JEFE_OBRA", "TEC_OFICINA_TECNICA", "TEC_EQUIPOS_LOGISTICA"],
    ["technical-workspace"],
    ["view", "create", "modify", "download", "export"],
  );

  await grant(
    ["ADM_RRHH_DOCUMENTAL"],
    ["personnel-control", "safety", "assets"],
    ["view", "create", "modify", "approve", "void", "download", "export"],
  );

  await grant(
    ["TEC_JEFE_OBRA"],
    ["personnel-control", "safety", "assets"],
    ["view", "create", "modify", "download"],
  );

  await grant(
    ["TEC_EQUIPOS_LOGISTICA"],
    ["assets", "fleet", "machinery", "fuel", "fuel-estimates", "maintenance", "mechanics", "spare-parts", "insurance"],
    ["view", "create", "modify", "download", "export"],
  );

  await grant(
    ["ADM_COMPRAS_TESORERIA"],
    ["stakeholders", "suppliers", "purchases", "insurance"],
    ["view", "create", "modify", "approve", "void", "download", "export"],
  );
}

async function main() {
  await ensureOperationalModules();
  await ensureCoreRoles();
  await ensureExtendedRolePermissions();
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@litoralnea.com").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password) {
    console.log("Bootstrap admin omitido: BOOTSTRAP_ADMIN_PASSWORD no configurada");
    return;
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No existe el administrador ${email}`);
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      deletedAt: null,
    },
  });
  console.log(`Credenciales de administrador sincronizadas para ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
