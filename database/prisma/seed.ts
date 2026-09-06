import "dotenv/config";
import {
  ApprovalStatus,
  DocumentStatus,
  IdentityProvider,
  MovementDirection,
  OrganizationType,
  PrismaClient,
  RecordStatus,
  UserStatus,
  WorkStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { modules as moduleUiDefinitions } from "../../frontend/lib/modules";
import { recordDefinitions } from "../../frontend/lib/record-definitions";

const prisma = new PrismaClient();

const modules = [
  "dashboard",
  "works",
  "architecture",
  "engineering",
  "documents",
  "budgets",
  "planning",
  "progress",
  "public-works",
  "certificates",
  "dossiers",
  "purchases",
  "suppliers",
  "logistics",
  "stock",
  "cash",
  "banks",
  "payments",
  "accounting",
  "taxes",
  "fleet",
  "drivers",
  "fuel",
  "machinery",
  "concrete",
  "maintenance",
  "hr",
  "payroll",
  "per-diems",
  "lodging",
  "management",
  "system",
  "approvals",
] as const;

const actions = [
  "view",
  "create",
  "modify",
  "approve",
  "void",
  "download",
  "export",
  "admin",
] as const;

const worksSeed = [
  {
    code: "OB-2026-001",
    name: "SENASA El Sombrero · Oficina y Laboratorio",
    client: "SENASA",
    city: "El Sombrero",
    contractAmount: 178_000_000,
    targetBudget: 143_200_000,
    actualCost: 144_358_000,
    physicalProgress: 61,
    financialProgress: 58,
    collectedAmount: 92_000_000,
    latitude: -27.7032,
    longitude: -58.7664,
    responsibleName: "Ing. Martín Gómez",
  },
  {
    code: "OB-2026-002",
    name: "Hospital San Juan Bautista · Adecuación eléctrica",
    client: "Ministerio de Salud Pública de Corrientes",
    city: "Santo Tomé",
    contractAmount: 242_000_000,
    targetBudget: 204_000_000,
    actualCost: 210_056_000,
    physicalProgress: 74,
    financialProgress: 72,
    collectedAmount: 151_000_000,
    latitude: -28.5494,
    longitude: -56.0401,
    responsibleName: "Ing. Víctor Encina",
  },
  {
    code: "OB-2026-003",
    name: "Cordón cuneta y desagües urbanos",
    client: "Municipalidad de Perugorría",
    city: "Perugorría",
    contractAmount: 98_000_000,
    targetBudget: 88_500_000,
    actualCost: 90_062_000,
    physicalProgress: 47,
    financialProgress: 53,
    collectedAmount: 31_000_000,
    latitude: -29.3416,
    longitude: -58.6108,
    responsibleName: "Téc. Carlos Ruiz",
  },
  {
    code: "OB-2026-004",
    name: "Escuela rural · Cerramiento perimetral",
    client: "Ministerio de Educación de Corrientes",
    city: "Ituzaingó",
    contractAmount: 126_000_000,
    targetBudget: 103_000_000,
    actualCost: 104_958_000,
    physicalProgress: 82,
    financialProgress: 78,
    collectedAmount: 84_000_000,
    latitude: -27.5816,
    longitude: -56.6823,
    responsibleName: "Arq. Laura Benítez",
  },
  {
    code: "OB-2026-005",
    name: "Loteo El Perichón · Infraestructura MT/BT",
    client: "Desarrollos El Perichón SA",
    city: "Corrientes",
    contractAmount: 310_000_000,
    targetBudget: 251_000_000,
    actualCost: 246_760_000,
    physicalProgress: 35,
    financialProgress: 31,
    collectedAmount: 76_000_000,
    latitude: -27.4373,
    longitude: -58.8341,
    responsibleName: "Ing. José Biloni",
  },
  {
    code: "OB-2026-006",
    name: "Ampliación Centro de Salud",
    client: "Ministerio de Salud Pública de Corrientes",
    city: "Bella Vista",
    contractAmount: 112_000_000,
    targetBudget: 93_000_000,
    actualCost: 94_640_000,
    physicalProgress: 68,
    financialProgress: 64,
    collectedAmount: 53_000_000,
    latitude: -28.5095,
    longitude: -59.0452,
    responsibleName: "Arq. Laura Benítez",
  },
  {
    code: "OB-2026-007",
    name: "Pavimento urbano · Etapa II",
    client: "Municipalidad de Goya",
    city: "Goya",
    contractAmount: 94_000_000,
    targetBudget: 79_000_000,
    actualCost: 80_652_000,
    physicalProgress: 56,
    financialProgress: 52,
    collectedAmount: 39_000_000,
    latitude: -29.1399,
    longitude: -59.2634,
    responsibleName: "Téc. Diego Silva",
  },
  {
    code: "OB-2026-008",
    name: "Parque Industrial · Red MT/BT",
    client: "Parque Industrial Corrientes SA",
    city: "Corrientes",
    contractAmount: 80_000_000,
    targetBudget: 65_000_000,
    actualCost: 66_320_000,
    physicalProgress: 43,
    financialProgress: 40,
    collectedAmount: 24_000_000,
    latitude: -27.3959,
    longitude: -58.7568,
    responsibleName: "Ing. Víctor Encina",
  },
] as const;

async function ensureOrganization(
  legalName: string,
  type: OrganizationType,
) {
  return (
    (await prisma.organization.findFirst({ where: { legalName } })) ??
    prisma.organization.create({
      data: {
        legalName,
        type,
        vatCondition: "Responsable Inscripto",
      },
    })
  );
}

async function main() {
  const company = await prisma.company.upsert({
    where: { taxId: "30-00000000-0" },
    update: {},
    create: {
      legalName: "LITORAL NEA SRL",
      tradeName: "LITORAL NEA",
      taxId: "30-00000000-0",
      settings: {
        currency: "ARS",
        locale: "es-AR",
        timezone: "America/Argentina/Buenos_Aires",
        demoData: true,
      },
    },
  });

  for (const module of modules) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action },
      });
    }
  }

  for (const [sortOrder, definition] of moduleUiDefinitions.entries()) {
    const recordDefinition = recordDefinitions[definition.slug];
    const configured = await prisma.moduleConfiguration.upsert({
      where: { slug: definition.slug },
      update: {
        label: definition.label,
        groupName: definition.group,
        icon: definition.icon,
        summary: definition.summary,
        active: true,
        requiresWork: recordDefinition?.requiresWork ?? false,
        sortOrder,
      },
      create: {
        slug: definition.slug,
        label: definition.label,
        groupName: definition.group,
        icon: definition.icon,
        summary: definition.summary,
        active: true,
        requiresWork: recordDefinition?.requiresWork ?? false,
        isSystem: true,
        sortOrder,
      },
    });
    for (const [fieldOrder, field] of (recordDefinition?.fields ?? []).entries()) {
      await prisma.moduleFieldConfiguration.upsert({
        where: {
          moduleId_fieldKey: { moduleId: configured.id, fieldKey: field.key },
        },
        update: {
          label: field.label,
          fieldType: field.type === "datetime-local" ? "datetime" : field.type,
          required: field.required ?? false,
          options: field.options ?? [],
          settings: {
            placeholder: field.placeholder ?? null,
            section: field.section ?? null,
          },
          sortOrder: fieldOrder,
          active: true,
        },
        create: {
          moduleId: configured.id,
          fieldKey: field.key,
          label: field.label,
          fieldType: field.type === "datetime-local" ? "datetime" : field.type,
          required: field.required ?? false,
          options: field.options ?? [],
          settings: {
            placeholder: field.placeholder ?? null,
            section: field.section ?? null,
          },
          sortOrder: fieldOrder,
          active: true,
        },
      });
    }
  }

  const roles = {
    admin: await prisma.role.upsert({
      where: { code: "ADMIN_GENERAL" },
      update: {},
      create: {
        code: "ADMIN_GENERAL",
        name: "Gerente General / Administrador",
        isSystem: true,
      },
    }),
    purchasing: await prisma.role.upsert({
      where: { code: "ADM_COMPRAS_TESORERIA" },
      update: {},
      create: {
        code: "ADM_COMPRAS_TESORERIA",
        name: "Administración · Compras y Tesorería",
        isSystem: true,
      },
    }),
    accounting: await prisma.role.upsert({
      where: { code: "ADM_CONTABLE_IMPOSITIVO" },
      update: {},
      create: { code: "ADM_CONTABLE_IMPOSITIVO", name: "Administración · Contabilidad e Impuestos", isSystem: true },
    }),
    people: await prisma.role.upsert({
      where: { code: "ADM_RRHH_DOCUMENTAL" },
      update: {},
      create: { code: "ADM_RRHH_DOCUMENTAL", name: "Administración · RR.HH. y Documentación", isSystem: true },
    }),
    siteLead: await prisma.role.upsert({
      where: { code: "TEC_JEFE_OBRA" },
      update: {},
      create: { code: "TEC_JEFE_OBRA", name: "Técnico · Jefe de Obra", isSystem: true },
    }),
    technicalOffice: await prisma.role.upsert({
      where: { code: "TEC_OFICINA_TECNICA" },
      update: {},
      create: { code: "TEC_OFICINA_TECNICA", name: "Técnico · Oficina Técnica", isSystem: true },
    }),
    equipment: await prisma.role.upsert({
      where: { code: "TEC_EQUIPOS_LOGISTICA" },
      update: {},
      create: { code: "TEC_EQUIPOS_LOGISTICA", name: "Técnico · Equipos y Logística", isSystem: true },
    }),
  };

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: Object.values(roles).map((role) => role.id) } },
  });
  const roleRules = [
    { roleId: roles.purchasing.id, modules: ["dashboard", "works", "documents", "purchases", "suppliers", "logistics", "stock", "cash", "banks", "payments", "dossiers", "per-diems", "lodging"], createModules: ["documents", "purchases", "suppliers", "logistics", "stock", "cash", "banks", "payments", "dossiers", "per-diems", "lodging"], actions: ["view", "create", "modify", "download", "export"] },
    { roleId: roles.accounting.id, modules: ["dashboard", "works", "documents", "budgets", "public-works", "certificates", "dossiers", "payments", "accounting", "taxes", "banks"], createModules: ["documents", "budgets", "public-works", "certificates", "dossiers", "payments", "accounting", "taxes", "banks"], actions: ["view", "create", "modify", "download", "export"] },
    { roleId: roles.people.id, modules: ["dashboard", "works", "documents", "dossiers", "hr", "payroll", "per-diems", "lodging", "drivers", "maintenance"], createModules: ["documents", "dossiers", "hr", "payroll", "per-diems", "lodging", "drivers", "maintenance"], actions: ["view", "create", "modify", "download", "export"] },
    { roleId: roles.siteLead.id, modules: ["dashboard", "works", "documents", "planning", "progress", "public-works", "certificates", "dossiers", "purchases", "logistics", "stock", "fleet", "fuel", "machinery"], createModules: ["documents", "progress", "certificates", "dossiers", "purchases", "logistics", "stock", "fuel"], actions: ["view", "create", "modify", "download"] },
    { roleId: roles.technicalOffice.id, modules: ["dashboard", "works", "documents", "architecture", "engineering", "budgets", "planning", "progress", "public-works", "certificates"], createModules: ["documents", "architecture", "engineering", "budgets", "planning", "progress", "public-works", "certificates"], actions: ["view", "create", "modify", "download"] },
    { roleId: roles.equipment.id, modules: ["dashboard", "works", "documents", "logistics", "stock", "fleet", "drivers", "fuel", "machinery", "concrete", "maintenance"], createModules: ["documents", "logistics", "stock", "fleet", "drivers", "fuel", "machinery", "concrete", "maintenance"], actions: ["view", "create", "modify", "download"] },
];

function demoFieldValue(
  field: (typeof recordDefinitions)[string]["fields"][number],
  index: number,
) {
  if (field.options?.length) return field.options[0];
  if (field.type === "boolean") return false;
  if (field.type === "number") return index + 1;
  if (field.type === "currency") return 125_000 * (index + 1);
  if (field.type === "date") return `2026-09-${String((index % 20) + 1).padStart(2, "0")}`;
  if (field.type === "datetime-local") return `2026-09-${String((index % 20) + 1).padStart(2, "0")}T08:00`;
  if (field.type === "email") return `contacto${index + 1}@proveedor.example`;
  if (field.type === "tax-id") return `30-${String(71000000 + index).padStart(8, "0")}-${index % 10}`;
  if (field.type === "textarea") return `Detalle demostrativo para ${field.label.toLowerCase()}.`;
  return `${field.label} demo ${index + 1}`;
}
  await prisma.rolePermission.createMany({
    data: [
      ...allPermissions.map((permission) => ({
        roleId: roles.admin.id,
        permissionId: permission.id,
        allowed: true,
      })),
      ...roleRules.flatMap((rule) =>
        allPermissions
          .filter(
            (permission) =>
              rule.modules.includes(permission.module) &&
              rule.actions.includes(permission.action) &&
              (!["create", "modify"].includes(permission.action) ||
                rule.createModules.includes(permission.module)),
          )
          .map((permission) => ({ roleId: rule.roleId, permissionId: permission.id, allowed: true })),
      ),
    ],
  });

  const userSeeds = [
    {
      username: "admin",
      email: "admin@litoralnea.com",
      firstName: "Administrador",
      lastName: "General",
      roleId: roles.admin.id,
      password: "Litoral#Admin26",
    },
    {
      username: "administracion1",
      email: "administracion1@litoralnea.com",
      firstName: "Ana",
      lastName: "Gómez",
      roleId: roles.purchasing.id,
      password: "Compras#LNEA26",
    },
    {
      username: "administracion2",
      email: "administracion2@litoralnea.com",
      firstName: "María",
      lastName: "López",
      roleId: roles.accounting.id,
      password: "Contable#LNEA26",
    },
    {
      username: "administracion3",
      email: "administracion3@litoralnea.com",
      firstName: "Pablo",
      lastName: "Ramírez",
      roleId: roles.people.id,
      password: "Personal#LNEA26",
    },
    {
      username: "tecnico1",
      email: "tecnico1@litoralnea.com",
      firstName: "Víctor",
      lastName: "Encina",
      roleId: roles.siteLead.id,
      password: "Obra#LNEA26",
    },
    {
      username: "tecnico2",
      email: "tecnico2@litoralnea.com",
      firstName: "Carlos",
      lastName: "Ruiz",
      roleId: roles.technicalOffice.id,
      password: "Ingenieria#LNEA26",
    },
    {
      username: "tecnico3",
      email: "tecnico3@litoralnea.com",
      firstName: "Diego",
      lastName: "Silva",
      roleId: roles.equipment.id,
      password: "Equipos#LNEA26",
    },
  ];

  const users = [];
  for (const seed of userSeeds) {
    const passwordHash = await bcrypt.hash(seed.password, 12);
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        passwordHash,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        companyId: company.id,
        username: seed.username,
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        passwordHash,
      },
    });
    await prisma.userRole.deleteMany({
      where: { userId: user.id, workId: null, roleId: { not: seed.roleId } },
    });
    const assignment = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: seed.roleId, workId: null },
    });
    if (!assignment) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: seed.roleId },
      });
    }
    users.push(user);
  }
  const admin = users[0];

  await prisma.registrationRequest.upsert({
    where: {
      provider_providerSubject: {
        provider: IdentityProvider.GOOGLE,
        providerSubject: "demo-google-subject-pending",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      provider: IdentityProvider.GOOGLE,
      providerSubject: "demo-google-subject-pending",
      email: "postulante.demo@litoralnea.example",
      firstName: "Usuario",
      lastName: "Pendiente",
    },
  });

  const typeByClient: Record<string, OrganizationType> = {
    SENASA: OrganizationType.PUBLIC_AGENCY,
    "Ministerio de Salud Pública de Corrientes": OrganizationType.MINISTRY,
    "Municipalidad de Perugorría": OrganizationType.MUNICIPALITY,
    "Ministerio de Educación de Corrientes": OrganizationType.MINISTRY,
    "Desarrollos El Perichón SA": OrganizationType.PRIVATE,
    "Municipalidad de Bella Vista": OrganizationType.MUNICIPALITY,
    "Municipalidad de Goya": OrganizationType.MUNICIPALITY,
    "Parque Industrial Corrientes SA": OrganizationType.PRIVATE,
  };
  const clients = new Map<string, { id: string }>();
  for (const work of worksSeed) {
    if (!clients.has(work.client)) {
      clients.set(
        work.client,
        await ensureOrganization(work.client, typeByClient[work.client]),
      );
    }
  }

  const works = [];
  for (const [index, seed] of worksSeed.entries()) {
    const work = await prisma.work.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        contractAmount: seed.contractAmount,
        targetBudget: seed.targetBudget,
        actualCost: seed.actualCost,
        physicalProgress: seed.physicalProgress,
        financialProgress: seed.financialProgress,
        collectedAmount: seed.collectedAmount,
      },
      create: {
        companyId: company.id,
        clientId: clients.get(seed.client)!.id,
        code: seed.code,
        name: seed.name,
        status: WorkStatus.ACTIVE,
        costCenter: `CC-${String(index + 1).padStart(3, "0")}`,
        contractNumber: `CT-2026-${String(index + 1).padStart(3, "0")}`,
        dossierNumber: `EXP-2026-${1000 + index}`,
        city: seed.city,
        latitude: seed.latitude,
        longitude: seed.longitude,
        startDate: new Date(2026, index % 6, 3 + index),
        contractualEndDate: new Date(2027, (index + 2) % 12, 28),
        contractAmount: seed.contractAmount,
        targetBudget: seed.targetBudget,
        actualCost: seed.actualCost,
        physicalProgress: seed.physicalProgress,
        financialProgress: seed.financialProgress,
        collectedAmount: seed.collectedAmount,
        responsibleName: seed.responsibleName,
        notes: "Datos de demostración. Reemplazar por información contractual validada.",
      },
    });
    works.push(work);
    const technician = users[4 + (index % 3)];
    await prisma.workMember.upsert({
      where: { workId_userId: { workId: work.id, userId: technician.id } },
      update: {},
      create: {
        workId: work.id,
        userId: technician.id,
        title: "Responsable técnico",
        isLead: true,
      },
    });
  }

  if ((await prisma.certificate.count()) === 0) {
    await prisma.certificate.createMany({
      data: [
        {
          workId: works[0].id,
          number: 4,
          periodFrom: new Date("2026-07-01"),
          periodTo: new Date("2026-07-31"),
          progressPct: 12.5,
          grossAmount: 70_000_000,
          repairFund: 3_500_000,
          withholdings: 1_500_000,
          netAmount: 65_000_000,
          status: RecordStatus.PENDING,
        },
        {
          workId: works[2].id,
          number: 2,
          periodFrom: new Date("2026-07-01"),
          periodTo: new Date("2026-07-31"),
          progressPct: 18,
          grossAmount: 52_000_000,
          repairFund: 2_600_000,
          withholdings: 1_400_000,
          netAmount: 48_000_000,
          status: RecordStatus.PENDING,
        },
        {
          workId: works[6].id,
          number: 3,
          periodFrom: new Date("2026-08-01"),
          periodTo: new Date("2026-08-31"),
          progressPct: 11,
          grossAmount: 35_000_000,
          repairFund: 1_750_000,
          withholdings: 1_250_000,
          netAmount: 32_000_000,
          status: RecordStatus.PENDING,
        },
      ],
    });
  }

  if ((await prisma.document.count()) === 0) {
    await prisma.document.createMany({
      data: [
        {
          workId: works[0].id,
          module: "architecture",
          code: "ARQ-PL-014",
          title: "Detalle de mesada y mobiliario",
          status: DocumentStatus.APPROVED,
          currentVersion: 3,
          createdById: users[4].id,
        },
        {
          workId: works[4].id,
          module: "engineering",
          code: "ING-MT-021",
          title: "Memoria de cálculo LMT 13,2 kV",
          status: DocumentStatus.IN_REVIEW,
          currentVersion: 2,
          createdById: users[4].id,
        },
        {
          workId: works[1].id,
          module: "documents",
          code: "DOC-ACT-008",
          title: "Acta de inspección eléctrica",
          status: DocumentStatus.DRAFT,
          currentVersion: 1,
          createdById: users[5].id,
        },
      ],
    });
  }

  if ((await prisma.alert.count()) === 0) {
    await prisma.alert.createMany({
      data: [
        {
          workId: works[0].id,
          type: "COLLECTION",
          severity: "HIGH",
          title: "Certificado Nº 4 pendiente de cobro",
          description: "17 días en trámite.",
          dueAt: new Date("2026-09-07"),
        },
        {
          workId: works[2].id,
          type: "DOSSIER",
          severity: "MEDIUM",
          title: "Expediente sin movimiento",
          description: "21 días sin novedades registradas.",
          dueAt: new Date("2026-09-05"),
        },
        {
          workId: works[6].id,
          type: "MAINTENANCE",
          severity: "MEDIUM",
          title: "Service de camión grúa próximo",
          description: "Vence por kilometraje estimado.",
          dueAt: new Date("2026-09-12"),
        },
      ],
    });
  }

  const centralCash = await prisma.cashBox.upsert({
    where: { code: "CAJA-CENTRAL" },
    update: { balance: 12_000_000 },
    create: { code: "CAJA-CENTRAL", name: "Caja central", balance: 12_000_000 },
  });
  await prisma.cashBox.upsert({
    where: { code: "CAJA-ADM" },
    update: { balance: 4_000_000 },
    create: { code: "CAJA-ADM", name: "Caja administrativa", balance: 4_000_000 },
  });
  await prisma.bankAccount.upsert({
    where: { accountNumber: "DEMO-CC-001" },
    update: { bankBalance: 108_000_000, accountingBalance: 108_000_000 },
    create: {
      bankName: "Banco demo",
      accountName: "Cuenta corriente principal",
      accountNumber: "DEMO-CC-001",
      bankBalance: 108_000_000,
      accountingBalance: 108_000_000,
    },
  });
  if ((await prisma.financialMovement.count()) === 0) {
    await prisma.financialMovement.create({
      data: {
        workId: works[0].id,
        cashBoxId: centralCash.id,
        direction: MovementDirection.OUT,
        type: "RENDICION",
        concept: "Fondo operativo de obra",
        amount: 850_000,
        counterparty: "Responsable de obra",
        reference: "REN-2026-018",
        createdById: users[1].id,
      },
    });
  }

  for (const estimate of [
    { taxType: "IVA", period: "2026-09", debit: 28_300_000, credit: 12_900_000, due: 13_700_000 },
    { taxType: "IIBB DGR Corrientes", period: "2026-09", debit: 8_100_000, credit: 0, due: 7_600_000 },
    { taxType: "Seguridad Social", period: "2026-09", debit: 10_500_000, credit: 0, due: 10_500_000 },
  ]) {
    await prisma.taxEstimate.upsert({
      where: { taxType_period: { taxType: estimate.taxType, period: estimate.period } },
      update: {},
      create: {
        taxType: estimate.taxType,
        period: estimate.period,
        debitAmount: estimate.debit,
        creditAmount: estimate.credit,
        estimatedDue: estimate.due,
        dueDate: new Date("2026-09-18"),
      },
    });
  }

  const supplierOrg = await ensureOrganization(
    "Proveedor Demo de Materiales SRL",
    OrganizationType.SUPPLIER,
  );
  const supplier = await prisma.supplier.upsert({
    where: { organizationId: supplierOrg.id },
    update: {},
    create: { organizationId: supplierOrg.id, accountBalance: 38_600_000 },
  });
  if ((await prisma.purchaseOrder.count()) === 0) {
    await prisma.purchaseOrder.create({
      data: {
        number: "OC-2026-0048",
        workId: works[4].id,
        supplierId: supplier.id,
        costCenter: works[4].costCenter,
        requestedById: users[4].id,
        approvedById: admin.id,
        status: RecordStatus.APPROVED,
        subtotal: 31_900_826.45,
        vat: 6_699_173.55,
        total: 38_600_000,
        expectedAt: new Date("2026-09-09"),
      },
    });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { code: "DEP-CENTRAL" },
    update: {},
    create: {
      code: "DEP-CENTRAL",
      name: "Depósito central",
      address: "Corrientes Capital",
    },
  });
  for (const item of [
    { sku: "ELEC-AL70", description: "Conductor AL/AL 70 mm²", unit: "m", stock: 1850, min: 800, cost: 7400 },
    { sku: "CIV-CEM40", description: "Cemento CPC40 bolsa 50 kg", unit: "bolsa", stock: 126, min: 200, cost: 11200 },
    { sku: "EPP-CASCO", description: "Casco dieléctrico clase E", unit: "u", stock: 18, min: 12, cost: 38500 },
  ]) {
    await prisma.stockItem.upsert({
      where: { warehouseId_sku: { warehouseId: warehouse.id, sku: item.sku } },
      update: { currentStock: item.stock, minimumStock: item.min, averageCost: item.cost },
      create: {
        warehouseId: warehouse.id,
        sku: item.sku,
        description: item.description,
        unit: item.unit,
        currentStock: item.stock,
        minimumStock: item.min,
        averageCost: item.cost,
      },
    });
  }

  const vehicle = await prisma.vehicle.upsert({
    where: { plate: "AA000LN" },
    update: {},
    create: {
      plate: "AA000LN",
      brand: "Iveco",
      model: "Tector grúa",
      year: 2022,
      odometerKm: 68420,
      insuranceDue: new Date("2026-11-15"),
      inspectionDue: new Date("2026-10-20"),
      workId: works[4].id,
    },
  });
  const driver = await prisma.driver.upsert({
    where: { employeeCode: "CHO-001" },
    update: { vehicleId: vehicle.id },
    create: {
      employeeCode: "CHO-001",
      fullName: "Miguel Fernández",
      licenseNumber: "DEMO-LNC-001",
      licenseCategory: "E1",
      licenseDue: new Date("2027-04-30"),
      vehicleId: vehicle.id,
    },
  });
  const machine = await prisma.machine.upsert({
    where: { code: "MAQ-RETRO-01" },
    update: {},
    create: {
      code: "MAQ-RETRO-01",
      equipmentType: "Retroexcavadora",
      brand: "Caterpillar",
      model: "416",
      hourMeter: 4385,
      workId: works[2].id,
      operatorName: "Raúl Medina",
      hourlyCost: 82_000,
    },
  });
  if ((await prisma.fuelLog.count()) === 0) {
    await prisma.fuelLog.createMany({
      data: [
        {
          workId: works[4].id,
          vehicleId: vehicle.id,
          driverId: driver.id,
          filledAt: new Date("2026-09-02"),
          liters: 168,
          unitPrice: 1420,
          total: 238_560,
          odometerKm: 68420,
          supplier: "Estación Demo",
          costCenter: works[4].costCenter,
          createdById: users[1].id,
        },
        {
          workId: works[2].id,
          machineId: machine.id,
          filledAt: new Date("2026-09-03"),
          liters: 126,
          unitPrice: 1390,
          total: 175_140,
          hourMeter: 4385,
          supplier: "Estación Demo",
          costCenter: works[2].costCenter,
          createdById: users[2].id,
        },
      ],
    });
  }

  for (const definition of [
    { code: "WF-COMPRAS-01", module: "purchases", name: "Aprobación de compras" },
    { code: "WF-PAGOS-01", module: "payments", name: "Aprobación de pagos" },
    { code: "WF-VIATICOS-01", module: "per-diems", name: "Aprobación de viáticos" },
    { code: "WF-PRESUP-01", module: "budgets", name: "Aprobación de presupuestos" },
    { code: "WF-CERT-01", module: "certificates", name: "Aprobación de certificados" },
    { code: "WF-DOC-01", module: "documents", name: "Aprobación documental" },
    { code: "WF-HHEE-01", module: "payroll", name: "Aprobación de horas extra" },
    { code: "WF-OT-01", module: "maintenance", name: "Aprobación de órdenes de trabajo" },
  ]) {
    await prisma.workflowDefinition.upsert({
      where: { code: definition.code },
      update: {},
      create: {
        ...definition,
        steps: [
          {
            role:
              definition.module === "purchases" || definition.module === "payments"
                ? "ADM_COMPRAS_TESORERIA"
                : definition.module === "per-diems" || definition.module === "payroll"
                  ? "ADM_RRHH_DOCUMENTAL"
                  : definition.module === "maintenance"
                    ? "TEC_EQUIPOS_LOGISTICA"
                    : definition.module === "budgets" || definition.module === "documents"
                      ? "TEC_OFICINA_TECNICA"
                      : "ADM_CONTABLE_IMPOSITIVO",
            label: "Control sectorial",
          },
          { role: "ADMIN_GENERAL", label: "Aprobación final" },
        ],
      },
    });
  }

  const demoModules = modules.filter(
    (module) => !["dashboard", "works", "documents", "system", "management", "approvals"].includes(module),
  );
  for (const [index, module] of demoModules.entries()) {
    const definition = recordDefinitions[module];
    const ui = moduleUiDefinitions.find((item) => item.slug === module);
    if (!definition) continue;
    const code = `${definition.codePrefix}-${String(index + 1).padStart(4, "0")}`;
    const data = Object.fromEntries(
      definition.fields.map((field) => [field.key, demoFieldValue(field, index)]),
    );
    await prisma.genericRecord.upsert({
      where: { module_code: { module, code } },
      update: {
        title: `${ui?.label ?? module} · registro demostrativo`,
        data,
      },
      create: {
        module,
        workId: definition.requiresWork ? works[index % works.length].id : null,
        code,
        title: `${ui?.label ?? module} · registro demostrativo`,
        status: index % 3 === 0 ? RecordStatus.PENDING : RecordStatus.ACTIVE,
        amount: definition.amountField ? 850_000 + index * 125_000 : null,
        occurredAt: new Date(2026, 8, Math.min(28, index + 1)),
        data,
        createdById: admin.id,
      },
    });
  }

  const pendingApproval = await prisma.approvalInstance.count();
  if (pendingApproval === 0) {
    const workflow = await prisma.workflowDefinition.findUnique({
      where: { code: "WF-COMPRAS-01" },
    });
    if (workflow) {
      await prisma.approvalInstance.create({
        data: {
          workflowId: workflow.id,
          workId: works[4].id,
          module: "purchases",
          entityType: "PurchaseOrder",
          entityId: "OC-2026-0048",
          status: ApprovalStatus.PENDING,
          requestedById: users[1].id,
        },
      });
    }
  }

  console.log("Seed demo LITORAL NEA ERP completado");
  console.log("Usuario: admin@litoralnea.com");
  console.log("Contraseña: Litoral#Admin26");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
