import "dotenv/config";
import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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
