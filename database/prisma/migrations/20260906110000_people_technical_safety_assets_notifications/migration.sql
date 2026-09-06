-- Technician workspace, notifications, personnel control, safety, assets and stakeholders

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "module" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "actionUrl" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "destination" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "error" TEXT,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "inApp" BOOLEAN NOT NULL DEFAULT true,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "push" BOOLEAN NOT NULL DEFAULT true,
  "sms" BOOLEAN NOT NULL DEFAULT false,
  "quietHours" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalTask" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "workId" TEXT,
  "discipline" TEXT NOT NULL,
  "taskType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
  "assignedUserId" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "requestedBy" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "progressPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "estimatedHours" DECIMAL(10,2),
  "actualHours" DECIMAL(10,2),
  "entityType" TEXT,
  "entityId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechnicalTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeWorkAssignment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "category" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3),
  "shift" TEXT,
  "costCenter" TEXT,
  "notes" TEXT,
  CONSTRAINT "EmployeeWorkAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRecord" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "attendanceType" TEXT NOT NULL DEFAULT 'PRESENT',
  "checkIn" TIMESTAMP(3),
  "checkOut" TIMESTAMP(3),
  "normalHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
  "overtimeHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
  "location" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "approvedById" TEXT,
  "observations" TEXT,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyCredential" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "credentialType" TEXT NOT NULL,
  "issuer" TEXT,
  "number" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  CONSTRAINT "SafetyCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PPEIssue" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "brand" TEXT,
  "model" TEXT,
  "serial" TEXT,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "condition" TEXT,
  "notes" TEXT,
  CONSTRAINT "PPEIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyTraining" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "provider" TEXT,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "score" DECIMAL(5,2),
  "approved" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  CONSTRAINT "SafetyTraining_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyIncident" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "workId" TEXT,
  "employeeId" TEXT,
  "incidentType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "description" TEXT NOT NULL,
  "immediateAction" TEXT,
  "rootCause" TEXT,
  "correctiveAction" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
  "lostTimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "reportedById" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyInspection" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "workId" TEXT,
  "inspectionType" TEXT NOT NULL,
  "inspectedAt" TIMESTAMP(3) NOT NULL,
  "inspector" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "findings" JSONB NOT NULL DEFAULT '[]',
  "correctiveActions" JSONB NOT NULL DEFAULT '[]',
  "dueAt" TIMESTAMP(3),
  "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "SafetyInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneralAsset" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "mobilityClass" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "brand" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "purchaseDate" TIMESTAMP(3),
  "acquisitionCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currentValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "workId" TEXT,
  "assignedEmployeeId" TEXT,
  "location" TEXT,
  "inventoryDate" TIMESTAMP(3),
  "warrantyDue" TIMESTAMP(3),
  "calibrationDue" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "GeneralAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationStakeholderRole" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workId" TEXT,
  "roleType" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "accountBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "creditLimit" DECIMAL(18,2),
  "paymentTerms" TEXT,
  "contactPerson" TEXT,
  "notes" TEXT,
  CONSTRAINT "OrganizationStakeholderRole_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_module_entityType_entityId_idx" ON "Notification"("module", "entityType", "entityId");
CREATE INDEX "NotificationDelivery_status_channel_idx" ON "NotificationDelivery"("status", "channel");
CREATE UNIQUE INDEX "NotificationPreference_userId_eventType_key" ON "NotificationPreference"("userId", "eventType");
CREATE UNIQUE INDEX "TechnicalTask_code_key" ON "TechnicalTask"("code");
CREATE INDEX "TechnicalTask_assignedUserId_status_dueAt_idx" ON "TechnicalTask"("assignedUserId", "status", "dueAt");
CREATE INDEX "TechnicalTask_workId_discipline_status_idx" ON "TechnicalTask"("workId", "discipline", "status");
CREATE INDEX "EmployeeWorkAssignment_workId_endDate_idx" ON "EmployeeWorkAssignment"("workId", "endDate");
CREATE INDEX "EmployeeWorkAssignment_employeeId_endDate_idx" ON "EmployeeWorkAssignment"("employeeId", "endDate");
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_workId_date_key" ON "AttendanceRecord"("employeeId", "workId", "date");
CREATE INDEX "AttendanceRecord_date_attendanceType_idx" ON "AttendanceRecord"("date", "attendanceType");
CREATE INDEX "SafetyCredential_expiresAt_status_idx" ON "SafetyCredential"("expiresAt", "status");
CREATE INDEX "SafetyCredential_employeeId_credentialType_idx" ON "SafetyCredential"("employeeId", "credentialType");
CREATE INDEX "PPEIssue_employeeId_dueAt_idx" ON "PPEIssue"("employeeId", "dueAt");
CREATE INDEX "SafetyTraining_employeeId_expiresAt_idx" ON "SafetyTraining"("employeeId", "expiresAt");
CREATE UNIQUE INDEX "SafetyIncident_code_key" ON "SafetyIncident"("code");
CREATE INDEX "SafetyIncident_status_severity_occurredAt_idx" ON "SafetyIncident"("status", "severity", "occurredAt");
CREATE UNIQUE INDEX "SafetyInspection_code_key" ON "SafetyInspection"("code");
CREATE INDEX "SafetyInspection_workId_inspectedAt_status_idx" ON "SafetyInspection"("workId", "inspectedAt", "status");
CREATE UNIQUE INDEX "GeneralAsset_code_key" ON "GeneralAsset"("code");
CREATE INDEX "GeneralAsset_assetType_mobilityClass_status_idx" ON "GeneralAsset"("assetType", "mobilityClass", "status");
CREATE INDEX "GeneralAsset_workId_status_idx" ON "GeneralAsset"("workId", "status");
CREATE INDEX "GeneralAsset_assignedEmployeeId_status_idx" ON "GeneralAsset"("assignedEmployeeId", "status");
CREATE UNIQUE INDEX "OrganizationStakeholderRole_organizationId_workId_roleType_key" ON "OrganizationStakeholderRole"("organizationId", "workId", "roleType");
CREATE INDEX "OrganizationStakeholderRole_roleType_active_idx" ON "OrganizationStakeholderRole"("roleType", "active");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalTask" ADD CONSTRAINT "TechnicalTask_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnicalTask" ADD CONSTRAINT "TechnicalTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TechnicalTask" ADD CONSTRAINT "TechnicalTask_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeWorkAssignment" ADD CONSTRAINT "EmployeeWorkAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeWorkAssignment" ADD CONSTRAINT "EmployeeWorkAssignment_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyCredential" ADD CONSTRAINT "SafetyCredential_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PPEIssue" ADD CONSTRAINT "PPEIssue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyTraining" ADD CONSTRAINT "SafetyTraining_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyInspection" ADD CONSTRAINT "SafetyInspection_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneralAsset" ADD CONSTRAINT "GeneralAsset_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneralAsset" ADD CONSTRAINT "GeneralAsset_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationStakeholderRole" ADD CONSTRAINT "OrganizationStakeholderRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationStakeholderRole" ADD CONSTRAINT "OrganizationStakeholderRole_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
