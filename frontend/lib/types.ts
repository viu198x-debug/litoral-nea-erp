export interface Work {
  id: string;
  code: string;
  name: string;
  client: string;
  city: string;
  contractAmount: number;
  targetBudget: number;
  actualCost: number;
  physicalProgress: number;
  financialProgress: number;
  collectedAmount: number;
  margin: number;
  responsible: string;
  status: "Normal" | "Atención";
  image: string;
}

export interface ModuleDefinition {
  slug: string;
  label: string;
  group: string;
  icon: string;
  summary: string;
  features: string[];
  primaryMetric?: string;
  recordDefinition?: ModuleRecordDefinition;
}

export type RecordFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "datetime-local"
  | "select"
  | "boolean"
  | "email"
  | "tax-id"
  | "file";

export interface RecordFieldDefinition {
  key: string;
  label: string;
  type: RecordFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  section?: string;
}

export interface ModuleRecordDefinition {
  codePrefix: string;
  titleLabel: string;
  requiresWork?: boolean;
  amountField?: string;
  fields: RecordFieldDefinition[];
}

export interface DemoUser {
  name: string;
  email: string;
  role: string;
  roleCode: string;
  allowedModules: string[];
  allowedActions: string[];
  allowedCreateModules: string[];
  assignedWorks: string[];
  responsibilities: string[];
}
