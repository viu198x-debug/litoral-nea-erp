import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { ERP_MODULES } from "../common/validation.pipes";

// Versioned migrations committed to database/prisma/migrations.
// Keep this list synchronized with the migration directory via backend tests.
export const EXPECTED_MIGRATIONS = [
  "20260904150000_initial",
  "20260904170000_security_oauth",
  "20260906013000_module_configurator",
  "20260906103000_operational_control_expansion",
  "20260906110000_people_technical_safety_assets_notifications",
  "20260906133000_fleet_work_links_and_fuel_voiding",
  "20260906140000_purchase_order_metadata",
  "20260906143000_construction_workforce_metadata",
  "20260912002000_treasury_modules_permissions",
  "20260924130000_treasury_control",
] as const;

// The auxiliary 'treasury-accounts' permission is not a top-level navigation module.
export const CORE_MODULES = [...ERP_MODULES]
  .filter((module) => module !== "treasury-accounts")
  .sort();

const SPECIALIZED_MODULES = new Set(["dashboard", "management", "approvals", "system"]);

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

@Injectable()
export class DataReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async assess() {
    // Queries are read-only; no connection strings, credentials, or user records
    // are returned by this endpoint.
    let migrations: MigrationRow[];
    let modules: Array<{
      slug: string;
      active: boolean;
      fields: Array<{ id: string }>;
    }>;

    try {
      [migrations, modules] = await Promise.all([
        this.prisma.$queryRaw<MigrationRow[]>`
          SELECT migration_name, finished_at, rolled_back_at
          FROM "_prisma_migrations"
          ORDER BY started_at ASC
        `,
        this.prisma.moduleConfiguration.findMany({
          select: {
            slug: true,
            active: true,
            fields: { where: { active: true }, select: { id: true } },
          },
        }),
      ]);
    } catch {
      // Fail closed without echoing sensitive database hostnames or DSNs.
      throw new ServiceUnavailableException(
        "No se pudo verificar el esquema y las migraciones desde la conexión segura del backend.",
      );
    }

    const applied = new Set(migrations
      .filter((migration) => migration.finished_at !== null && migration.rolled_back_at === null)
      .map((migration) => migration.migration_name));
    const missingMigrations = EXPECTED_MIGRATIONS.filter((name) => !applied.has(name));
    const failedMigrations = migrations
      .filter((migration) => migration.finished_at === null && migration.rolled_back_at === null)
      .map((migration) => migration.migration_name);

    const configured = new Map(modules.map((module) => [module.slug, module]));
    const missingModules = CORE_MODULES.filter((slug) => !configured.has(slug));
    const inactiveModules = CORE_MODULES.filter((slug) => configured.get(slug)?.active === false);
    const modulesWithoutFields = CORE_MODULES.filter((slug) => {
      const definition = configured.get(slug);
      return definition?.active && !SPECIALIZED_MODULES.has(slug) && definition.fields.length === 0;
    });

    const ready = missingMigrations.length === 0 &&
      failedMigrations.length === 0 &&
      missingModules.length === 0 &&
      inactiveModules.length === 0 &&
      modulesWithoutFields.length === 0;

    return {
      status: ready ? "READY_FOR_REVIEW" : "ACTION_REQUIRED",
      generatedAt: new Date().toISOString(),
      connection: "verified_by_server",
      migrations: {
        expected: EXPECTED_MIGRATIONS.length,
        applied: applied.size,
        missing: missingMigrations,
        incomplete: failedMigrations,
      },
      modules: {
        expected: CORE_MODULES.length,
        configured: modules.filter((module) => CORE_MODULES.includes(module.slug)).length,
        active: modules.filter((module) => CORE_MODULES.includes(module.slug) && module.active).length,
        fieldDefinitions: modules.reduce((sum, module) => sum + module.fields.length, 0),
        missing: missingModules,
        inactive: inactiveModules,
        withoutFields: modulesWithoutFields,
      },
      migrationAppliedByThisRequest: false,
      productionReady: false,
      note: "Este diagnóstico no prueba respaldos, aislamiento por empresa, integridad transaccional ni preparación para producción.",
    };
  }
}
