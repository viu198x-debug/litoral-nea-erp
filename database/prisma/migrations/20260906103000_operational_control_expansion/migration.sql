-- Fleet, maintenance, insurance and unexpected-work domain expansion

ALTER TABLE "MaintenanceOrder"
  ADD COLUMN "mechanicId" TEXT,
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "odometerKm" INTEGER,
  ADD COLUMN "hourMeter" DECIMAL(12,2),
  ADD COLUMN "notes" TEXT;

CREATE TABLE "Mechanic" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "fullName" TEXT NOT NULL,
  "specialty" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  CONSTRAINT "Mechanic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SparePart" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "brand" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'u',
  "currentStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "minimumStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "averageCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "location" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenancePart" (
  "id" TEXT NOT NULL,
  "maintenanceOrderId" TEXT NOT NULL,
  "sparePartId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,4) NOT NULL,
  "total" DECIMAL(18,2) NOT NULL,
  CONSTRAINT "MaintenancePart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenancePlan" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT,
  "machineId" TEXT,
  "name" TEXT NOT NULL,
  "intervalKm" INTEGER,
  "intervalHours" DECIMAL(12,2),
  "intervalDays" INTEGER,
  "lastServiceDate" TIMESTAMP(3),
  "lastOdometerKm" INTEGER,
  "lastHourMeter" DECIMAL(12,2),
  "nextServiceDate" TIMESTAMP(3),
  "nextOdometerKm" INTEGER,
  "nextHourMeter" DECIMAL(12,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FuelEstimate" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "workId" TEXT,
  "period" TEXT NOT NULL,
  "estimatedLiters" DECIMAL(12,3) NOT NULL,
  "estimatedKm" INTEGER,
  "estimatedHours" DECIMAL(12,2),
  "basis" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FuelEstimate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceCompany" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "InsuranceCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsurancePolicy" (
  "id" TEXT NOT NULL,
  "policyNumber" TEXT NOT NULL,
  "policyType" TEXT NOT NULL,
  "insurerId" TEXT NOT NULL,
  "workId" TEXT,
  "vehicleId" TEXT,
  "machineId" TEXT,
  "contractor" TEXT,
  "clientOrPrincipal" TEXT,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "premiumAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "coverageAmount" DECIMAL(18,2),
  "coverageDetail" TEXT,
  "cancellationDate" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceEndorsement" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "endorsementType" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "InsuranceEndorsement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsurancePayment" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "amount" DECIMAL(18,2) NOT NULL,
  "receiptNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  CONSTRAINT "InsurancePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnexpectedTask" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
  "source" TEXT,
  "workId" TEXT,
  "assignedUserId" TEXT,
  "assignedEmployeeId" TEXT,
  "vehicleId" TEXT,
  "machineId" TEXT,
  "location" TEXT,
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "estimatedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "actualCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "notes" TEXT,
  CONSTRAINT "UnexpectedTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Mechanic_employeeId_key" ON "Mechanic"("employeeId");
CREATE UNIQUE INDEX "SparePart_sku_key" ON "SparePart"("sku");
CREATE INDEX "MaintenancePart_maintenanceOrderId_idx" ON "MaintenancePart"("maintenanceOrderId");
CREATE INDEX "MaintenancePart_sparePartId_idx" ON "MaintenancePart"("sparePartId");
CREATE INDEX "MaintenancePlan_vehicleId_active_idx" ON "MaintenancePlan"("vehicleId", "active");
CREATE INDEX "MaintenancePlan_machineId_active_idx" ON "MaintenancePlan"("machineId", "active");
CREATE INDEX "MaintenancePlan_nextServiceDate_idx" ON "MaintenancePlan"("nextServiceDate");
CREATE UNIQUE INDEX "FuelEstimate_vehicleId_workId_period_key" ON "FuelEstimate"("vehicleId", "workId", "period");
CREATE INDEX "FuelEstimate_period_status_idx" ON "FuelEstimate"("period", "status");
CREATE UNIQUE INDEX "InsuranceCompany_name_key" ON "InsuranceCompany"("name");
CREATE UNIQUE INDEX "InsurancePolicy_insurerId_policyNumber_key" ON "InsurancePolicy"("insurerId", "policyNumber");
CREATE INDEX "InsurancePolicy_policyType_status_endDate_idx" ON "InsurancePolicy"("policyType", "status", "endDate");
CREATE INDEX "InsurancePolicy_workId_idx" ON "InsurancePolicy"("workId");
CREATE UNIQUE INDEX "InsuranceEndorsement_policyId_number_key" ON "InsuranceEndorsement"("policyId", "number");
CREATE INDEX "InsuranceEndorsement_effectiveDate_endDate_idx" ON "InsuranceEndorsement"("effectiveDate", "endDate");
CREATE INDEX "InsurancePayment_status_dueDate_idx" ON "InsurancePayment"("status", "dueDate");
CREATE UNIQUE INDEX "UnexpectedTask_code_key" ON "UnexpectedTask"("code");
CREATE INDEX "UnexpectedTask_status_priority_dueAt_idx" ON "UnexpectedTask"("status", "priority", "dueAt");
CREATE INDEX "UnexpectedTask_workId_idx" ON "UnexpectedTask"("workId");
CREATE INDEX "UnexpectedTask_assignedEmployeeId_idx" ON "UnexpectedTask"("assignedEmployeeId");

ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Mechanic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Mechanic" ADD CONSTRAINT "Mechanic_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenancePart" ADD CONSTRAINT "MaintenancePart_maintenanceOrderId_fkey" FOREIGN KEY ("maintenanceOrderId") REFERENCES "MaintenanceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenancePart" ADD CONSTRAINT "MaintenancePart_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelEstimate" ADD CONSTRAINT "FuelEstimate_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelEstimate" ADD CONSTRAINT "FuelEstimate_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "InsuranceCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsuranceEndorsement" ADD CONSTRAINT "InsuranceEndorsement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsurancePayment" ADD CONSTRAINT "InsurancePayment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnexpectedTask" ADD CONSTRAINT "UnexpectedTask_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnexpectedTask" ADD CONSTRAINT "UnexpectedTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnexpectedTask" ADD CONSTRAINT "UnexpectedTask_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnexpectedTask" ADD CONSTRAINT "UnexpectedTask_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnexpectedTask" ADD CONSTRAINT "UnexpectedTask_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
