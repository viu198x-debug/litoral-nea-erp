import type { RecordFieldDefinition } from "./types";
import { modules } from "./modules";
import { recordDefinitions } from "./record-definitions";

/**
 * The 41 transactional modules have editable RecordFieldDefinitions.
 * These four modules use specialized services. Their fields describe
 * source data and dedicated operations; they MUST NOT generate CRUD
 * forms or GenericRecord writes.
 */
export type SpecializedModuleSlug = "dashboard" | "management" | "approvals" | "system";
export type SpecializedModuleKind = "read-only-dashboard" | "management-analytics" | "approval-workflow" | "system-administration";

export interface SpecializedModuleDefinition {
  kind: SpecializedModuleKind;
  description: string;
  endpoints: string[];
  fields: RecordFieldDefinition[];
}

export const specializedModuleDefinitions: Record<SpecializedModuleSlug, SpecializedModuleDefinition> = {
  dashboard: {
    kind: "read-only-dashboard",
    description: "Indicadores calculados por servicios de consulta; nunca se cargan importes ni saldos manualmente.",
    endpoints: ["GET /dashboard"],
    fields: [
      { key: "generatedAt", label: "Actualización del tablero", type: "datetime-local", section: "Control" },
      { key: "activeWorks", label: "Obras activas", type: "number", section: "Obras" },
      { key: "contractTotal", label: "Monto contractual acumulado", type: "currency", section: "Obras" },
      { key: "actualCost", label: "Costo real acumulado", type: "currency", section: "Obras" },
      { key: "targetBudget", label: "Presupuesto objetivo", type: "currency", section: "Obras" },
      { key: "certified", label: "Certificado acumulado neto", type: "currency", section: "Finanzas" },
      { key: "pendingCollection", label: "Certificados pendientes de cobro", type: "currency", section: "Finanzas" },
      { key: "accountsPayable", label: "Compromisos de compra pendientes", type: "currency", section: "Finanzas" },
      { key: "cashAndBanks", label: "Caja y bancos consolidados", type: "currency", section: "Finanzas" },
      { key: "estimatedMargin", label: "Margen estimado (%)", type: "number", section: "Indicadores" },
      { key: "estimatedTaxes", label: "Impuestos estimados", type: "currency", section: "Indicadores" },
      { key: "alerts", label: "Alertas y vencimientos", type: "textarea", section: "Control" },
    ],
  },
  management: {
    kind: "management-analytics",
    description: "Tablero gerencial calculado desde GET /dashboard; importes y márgenes no son editables. Las estimaciones no sustituyen cierres contables.",
    endpoints: ["GET /dashboard"],
    fields: [
      { key: "generatedAt", label: "Fecha de corte", type: "datetime-local", section: "Período" },
      { key: "activeWorks", label: "Obras activas", type: "number", section: "Obras" },
      { key: "contractTotal", label: "Monto contractual", type: "currency", section: "Obras" },
      { key: "targetBudget", label: "Presupuesto objetivo", type: "currency", section: "Obras" },
      { key: "actualCost", label: "Costo ejecutado", type: "currency", section: "Obras" },
      { key: "estimatedMargin", label: "Margen estimado (%)", type: "number", section: "Rentabilidad" },
      { key: "certified", label: "Certificados netos", type: "currency", section: "Certificaciones" },
      { key: "pendingCollection", label: "Certificados pendientes de cobro", type: "currency", section: "Certificaciones" },
      { key: "accountsPayable", label: "Órdenes de compra pendientes", type: "currency", section: "Abastecimiento" },
      { key: "cashAndBanks", label: "Caja y bancos", type: "currency", section: "Finanzas" },
      { key: "estimatedTaxes", label: "Obligaciones fiscales estimadas", type: "currency", section: "Impuestos" },
    ],
  },
  approvals: {
    kind: "approval-workflow",
    description: "Solicitudes y decisiones auditables; cada decisión se confirma con el endpoint y el rol correspondiente.",
    endpoints: ["GET /approvals", "POST /approvals", "POST /approvals/:id/decision"],
    fields: [
      { key: "module", label: "Módulo de origen", type: "text", required: true, section: "Solicitud" },
      { key: "entityType", label: "Tipo de entidad", type: "text", required: true, section: "Solicitud" },
      { key: "entityId", label: "Identificador del registro", type: "text", required: true, section: "Solicitud" },
      { key: "workId", label: "Obra asociada", type: "text", section: "Solicitud" },
      { key: "workflowCode", label: "Circuito de aprobación", type: "text", section: "Solicitud" },
      { key: "amount", label: "Monto sujeto a aprobación", type: "currency", section: "Solicitud" },
      { key: "requestedAt", label: "Fecha de solicitud", type: "datetime-local", section: "Seguimiento" },
      { key: "currentStep", label: "Paso vigente", type: "number", section: "Seguimiento" },
      { key: "status", label: "Estado", type: "select", options: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"], section: "Seguimiento" },
      { key: "decision", label: "Decisión", type: "select", required: true, options: ["APPROVED", "REJECTED"], section: "Resolución" },
      { key: "comments", label: "Fundamento / observaciones", type: "textarea", section: "Resolución" },
    ],
  },
  system: {
    kind: "system-administration",
    description: "Configuración y auditoría por controladores específicos. Las contraseñas, tokens y secretos NO forman parte de este catálogo.",
    endpoints: [
      "GET /system/users", "POST /system/users", "GET /system/roles",
      "GET /system/modules", "PATCH /system/modules/:id",
      "GET /system/workflows", "GET /system/audit",
      "GET /system/registration-requests",
    ],
    fields: [
      { key: "userId", label: "Identificador del usuario", type: "text", section: "Usuarios" },
      { key: "userStatus", label: "Estado de la cuenta", type: "select", options: ["ACTIVE", "LOCKED", "DISABLED"], section: "Usuarios" },
      { key: "roleCode", label: "Rol asignado", type: "text", section: "Seguridad" },
      { key: "moduleSlug", label: "Código de módulo", type: "text", section: "Configuración" },
      { key: "fieldKey", label: "Clave del campo", type: "text", section: "Configuración" },
      { key: "fieldType", label: "Tipo del campo", type: "select", options: ["text", "textarea", "number", "currency", "date", "datetime", "select", "boolean", "email", "tax-id", "file"], section: "Configuración" },
      { key: "permissionAction", label: "Permiso", type: "select", options: ["view", "create", "modify", "approve", "void", "download", "export", "admin"], section: "Seguridad" },
      { key: "workScope", label: "Ámbito por obra", type: "text", section: "Seguridad" },
      { key: "workflowCode", label: "Código del workflow", type: "text", section: "Aprobaciones" },
      { key: "auditAt", label: "Fecha del evento auditado", type: "datetime-local", section: "Auditoría" },
      { key: "auditAction", label: "Operación auditada", type: "text", section: "Auditoría" },
    ],
  },
};

export interface ModuleFieldCatalogEntry {
  slug: string;
  label: string;
  mode: "record" | "specialized";
  fields: RecordFieldDefinition[];
  specialized?: SpecializedModuleDefinition;
}

/**
 * One authoritative, complete catalog for all 45 navigation modules.
 * Does not change the existing 41 transactional record forms.
 */
export const moduleFieldCatalog: ModuleFieldCatalogEntry[] = modules.map((module) => {
  const record = recordDefinitions[module.slug];
  if (record) {
    return { slug: module.slug, label: module.label, mode: "record", fields: record.fields };
  }
  const special = specializedModuleDefinitions[module.slug as SpecializedModuleSlug];
  if (!special) throw new Error(`Falta la definición funcional del módulo: ${module.slug}`);
  return {
    slug: module.slug,
    label: module.label,
    mode: "specialized",
    fields: special.fields,
    specialized: special,
  };
});

export const moduleFieldCatalogBySlug: Record<string, ModuleFieldCatalogEntry> =
  Object.fromEntries(moduleFieldCatalog.map((entry) => [entry.slug, entry]));
