import "dotenv/config";
import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();


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

async function main() {
  await ensureCoreRoles();
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
