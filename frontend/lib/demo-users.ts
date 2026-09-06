import type { DemoUser } from "./types";

export type DemoAccount = DemoUser & {
  username: string;
  password: string;
};

const common = ["dashboard", "works", "documents"];

export const demoAccounts: DemoAccount[] = [
  {
    username: "admin",
    password: "Litoral#Admin26",
    name: "Administrador General",
    email: "admin@litoralnea.com",
    role: "Gerente General / Administrador",
    roleCode: "ADMIN_GENERAL",
    allowedModules: ["*"],
    allowedActions: ["view", "create", "modify", "approve", "void", "download", "export", "admin"],
    allowedCreateModules: ["*"],
    assignedWorks: [],
    responsibilities: ["Usuarios, roles y permisos", "Alta y baja lógica de obras", "Aprobaciones y anulaciones", "Parámetros, auditoría y backups"],
  },
  {
    username: "administracion1",
    password: "Compras#LNEA26",
    name: "Ana Gómez",
    email: "administracion1@litoralnea.com",
    role: "Administración · Compras y Tesorería",
    roleCode: "ADM_COMPRAS_TESORERIA",
    allowedModules: [...common, "purchases", "suppliers", "logistics", "stock", "cash", "banks", "payments", "dossiers", "per-diems", "lodging"],
    allowedActions: ["view", "create", "modify", "download", "export"],
    allowedCreateModules: ["purchases", "suppliers", "logistics", "stock", "cash", "banks", "payments", "dossiers", "per-diems", "lodging", "documents"],
    assignedWorks: [],
    responsibilities: ["Solicitudes, cotizaciones y órdenes de compra", "Remitos y facturas de proveedores", "Caja, bancos, pagos y cobros", "Rendiciones y cuentas corrientes"],
  },
  {
    username: "administracion2",
    password: "Contable#LNEA26",
    name: "María López",
    email: "administracion2@litoralnea.com",
    role: "Administración · Contabilidad e Impuestos",
    roleCode: "ADM_CONTABLE_IMPOSITIVO",
    allowedModules: [...common, "budgets", "public-works", "certificates", "dossiers", "payments", "accounting", "taxes", "banks"],
    allowedActions: ["view", "create", "modify", "download", "export"],
    allowedCreateModules: ["budgets", "public-works", "certificates", "dossiers", "payments", "accounting", "taxes", "banks", "documents"],
    assignedWorks: [],
    responsibilities: ["Asientos, diario y mayor", "IVA, ARCA, DGR e Ingresos Brutos", "Certificados, facturación y cobranzas", "Conciliaciones y cierres contables"],
  },
  {
    username: "administracion3",
    password: "Personal#LNEA26",
    name: "Pablo Ramírez",
    email: "administracion3@litoralnea.com",
    role: "Administración · RR.HH. y Documentación",
    roleCode: "ADM_RRHH_DOCUMENTAL",
    allowedModules: [...common, "dossiers", "hr", "payroll", "per-diems", "lodging", "drivers", "maintenance"],
    allowedActions: ["view", "create", "modify", "download", "export"],
    allowedCreateModules: ["dossiers", "hr", "payroll", "per-diems", "lodging", "drivers", "maintenance", "documents"],
    assignedWorks: [],
    responsibilities: ["Legajos y documentación laboral", "Asistencia, horas y novedades", "Sueldos, anticipos y cargas sociales", "Viáticos, alojamientos y vencimientos"],
  },
  {
    username: "tecnico1",
    password: "Obra#LNEA26",
    name: "Víctor Encina",
    email: "tecnico1@litoralnea.com",
    role: "Técnico · Jefe de Obra",
    roleCode: "TEC_JEFE_OBRA",
    allowedModules: [...common, "planning", "progress", "public-works", "certificates", "dossiers", "purchases", "logistics", "stock", "fleet", "fuel", "machinery"],
    allowedActions: ["view", "create", "modify", "download"],
    allowedCreateModules: ["progress", "certificates", "dossiers", "purchases", "logistics", "stock", "fuel", "documents"],
    assignedWorks: ["OB-2026-002", "OB-2026-005", "OB-2026-008"],
    responsibilities: ["Partes diarios y avance físico", "Personal, equipos, clima y materiales", "Mediciones y certificados preliminares", "Pedidos y documentación de sus obras"],
  },
  {
    username: "tecnico2",
    password: "Ingenieria#LNEA26",
    name: "Carlos Ruiz",
    email: "tecnico2@litoralnea.com",
    role: "Técnico · Oficina Técnica",
    roleCode: "TEC_OFICINA_TECNICA",
    allowedModules: [...common, "architecture", "engineering", "budgets", "planning", "progress", "public-works", "certificates"],
    allowedActions: ["view", "create", "modify", "download"],
    allowedCreateModules: ["architecture", "engineering", "budgets", "planning", "progress", "public-works", "certificates", "documents"],
    assignedWorks: ["OB-2026-001", "OB-2026-003", "OB-2026-006"],
    responsibilities: ["Proyectos, planos y memorias", "Cómputos, APU y presupuestos", "Cronogramas, revisiones y versiones", "Documentación técnica para aprobación"],
  },
  {
    username: "tecnico3",
    password: "Equipos#LNEA26",
    name: "Diego Silva",
    email: "tecnico3@litoralnea.com",
    role: "Técnico · Equipos y Logística",
    roleCode: "TEC_EQUIPOS_LOGISTICA",
    allowedModules: [...common, "logistics", "stock", "fleet", "drivers", "fuel", "machinery", "concrete", "maintenance"],
    allowedActions: ["view", "create", "modify", "download"],
    allowedCreateModules: ["logistics", "stock", "fleet", "drivers", "fuel", "machinery", "concrete", "maintenance", "documents"],
    assignedWorks: ["OB-2026-004", "OB-2026-007"],
    responsibilities: ["Movimientos de materiales y depósitos", "Vehículos, choferes y combustible", "Horómetros, mantenimiento y reparaciones", "Producción y remitos de hormigón"],
  },
];

export function findDemoAccount(identity: string, password: string) {
  const normalized = identity.trim().toLowerCase();
  return demoAccounts.find(
    (account) =>
      (account.username.toLowerCase() === normalized || account.email.toLowerCase() === normalized) &&
      account.password === password,
  );
}
