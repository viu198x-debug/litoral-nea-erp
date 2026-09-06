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
