import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";

export const ERP_MODULES = new Set([
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
  "approvals",
  "system",
]);

@Injectable()
export class ModuleSlugPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!ERP_MODULES.has(value)) {
      throw new BadRequestException("Módulo no válido");
    }
    return value;
  }
}

@Injectable()
export class EntityIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^c[a-z0-9]{20,32}$/.test(value)) {
      throw new BadRequestException("Identificador no válido");
    }
    return value;
  }
}
