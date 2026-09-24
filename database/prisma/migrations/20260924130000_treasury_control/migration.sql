CREATE TYPE "TreasuryAccountType" AS ENUM ('BANK_CURRENT', 'BANK_SAVINGS', 'VIRTUAL_WALLET', 'CASH');
CREATE TYPE "TreasuryMovementType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'INTEREST', 'CHECK_ISSUE', 'CHECK_RECEIPT', 'CHECK_DEPOSIT', 'CHECK_PAYMENT', 'ADJUSTMENT');
CREATE TYPE "TreasuryMovementStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'EXECUTED', 'RECONCILED', 'VOID');
CREATE TYPE "TreasuryChequeKind" AS ENUM ('OWN', 'THIRD_PARTY');
CREATE TYPE "TreasuryChequeStatus" AS ENUM ('PORTFOLIO', 'ISSUED', 'RECEIVED', 'DEPOSITED', 'DEFERRED', 'CLEARED', 'REJECTED', 'CANCELLED', 'ENDORSED');
CREATE TYPE "TreasuryReconciliationStatus" AS ENUM ('OPEN', 'BALANCED', 'CLOSED');
CREATE TYPE "TreasuryCashCountStatus" AS ENUM ('OPEN', 'CLOSED', 'APPROVED');

CREATE TABLE "TreasuryAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TreasuryAccountType" NOT NULL,
  "institution" TEXT,
  "accountNumber" TEXT,
  "cbu" TEXT,
  "alias" TEXT,
  "holderName" TEXT,
  "holderTaxId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "overdraftLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "treasurerId" TEXT,
  "includeInCashPosition" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryMovement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "workId" TEXT,
  "sourceAccountId" TEXT,
  "destinationAccountId" TEXT,
  "chequeId" TEXT,
  "type" "TreasuryMovementType" NOT NULL,
  "status" "TreasuryMovementStatus" NOT NULL DEFAULT 'PENDING',
  "concept" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valueDate" TIMESTAMP(3),
  "counterpartyType" TEXT,
  "counterparty" TEXT,
  "paymentMethod" TEXT,
  "reference" TEXT,
  "receiptNumber" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "voidedById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "TreasuryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryCheque" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "accountId" TEXT,
  "workId" TEXT,
  "kind" "TreasuryChequeKind" NOT NULL,
  "status" "TreasuryChequeStatus" NOT NULL,
  "number" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "branch" TEXT,
  "accountNumber" TEXT,
  "issuerName" TEXT NOT NULL,
  "issuerTaxId" TEXT,
  "beneficiary" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3),
  "depositedAt" TIMESTAMP(3),
  "clearedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "endorsementChain" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "TreasuryCheque_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryReconciliation" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "statementOpening" DECIMAL(18,2) NOT NULL,
  "statementClosing" DECIMAL(18,2) NOT NULL,
  "bookOpening" DECIMAL(18,2) NOT NULL,
  "bookClosing" DECIMAL(18,2) NOT NULL,
  "difference" DECIMAL(18,2) NOT NULL,
  "status" "TreasuryReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreasuryReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryReconciliationItem" (
  "id" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "movementId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "statementAmount" DECIMAL(18,2) NOT NULL,
  "bookAmount" DECIMAL(18,2) NOT NULL,
  "difference" DECIMAL(18,2) NOT NULL,
  "matched" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  CONSTRAINT "TreasuryReconciliationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryCashCount" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedBalance" DECIMAL(18,2) NOT NULL,
  "countedBalance" DECIMAL(18,2) NOT NULL,
  "difference" DECIMAL(18,2) NOT NULL,
  "denominations" JSONB NOT NULL DEFAULT '[]',
  "status" "TreasuryCashCountStatus" NOT NULL DEFAULT 'OPEN',
  "countedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryCashCount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryDailyClose" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "closedDate" TIMESTAMP(3) NOT NULL,
  "openingPosition" DECIMAL(18,2) NOT NULL,
  "totalIncome" DECIMAL(18,2) NOT NULL,
  "totalExpense" DECIMAL(18,2) NOT NULL,
  "closingPosition" DECIMAL(18,2) NOT NULL,
  "bankBalance" DECIMAL(18,2) NOT NULL,
  "savingsBalance" DECIMAL(18,2) NOT NULL,
  "walletBalance" DECIMAL(18,2) NOT NULL,
  "cashBalance" DECIMAL(18,2) NOT NULL,
  "pendingCheques" DECIMAL(18,2) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'CLOSED',
  "closedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreasuryDailyClose_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreasuryAccount_companyId_type_active_idx" ON "TreasuryAccount"("companyId", "type", "active");
CREATE UNIQUE INDEX "TreasuryAccount_companyId_code_key" ON "TreasuryAccount"("companyId", "code");
CREATE INDEX "TreasuryMovement_companyId_occurredAt_status_idx" ON "TreasuryMovement"("companyId", "occurredAt", "status");
CREATE INDEX "TreasuryMovement_sourceAccountId_occurredAt_idx" ON "TreasuryMovement"("sourceAccountId", "occurredAt");
CREATE INDEX "TreasuryMovement_destinationAccountId_occurredAt_idx" ON "TreasuryMovement"("destinationAccountId", "occurredAt");
CREATE INDEX "TreasuryMovement_workId_idx" ON "TreasuryMovement"("workId");
CREATE INDEX "TreasuryCheque_companyId_status_dueDate_idx" ON "TreasuryCheque"("companyId", "status", "dueDate");
CREATE UNIQUE INDEX "TreasuryCheque_companyId_bankName_number_key" ON "TreasuryCheque"("companyId", "bankName", "number");
CREATE INDEX "TreasuryReconciliation_accountId_periodTo_status_idx" ON "TreasuryReconciliation"("accountId", "periodTo", "status");
CREATE INDEX "TreasuryReconciliationItem_reconciliationId_matched_idx" ON "TreasuryReconciliationItem"("reconciliationId", "matched");
CREATE INDEX "TreasuryCashCount_accountId_countedAt_idx" ON "TreasuryCashCount"("accountId", "countedAt");
CREATE INDEX "TreasuryDailyClose_companyId_closedDate_idx" ON "TreasuryDailyClose"("companyId", "closedDate");
CREATE UNIQUE INDEX "TreasuryDailyClose_companyId_closedDate_key" ON "TreasuryDailyClose"("companyId", "closedDate");

ALTER TABLE "TreasuryAccount" ADD CONSTRAINT "TreasuryAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "TreasuryCheque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryCheque" ADD CONSTRAINT "TreasuryCheque_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryCheque" ADD CONSTRAINT "TreasuryCheque_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryCheque" ADD CONSTRAINT "TreasuryCheque_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryReconciliation" ADD CONSTRAINT "TreasuryReconciliation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryReconciliationItem" ADD CONSTRAINT "TreasuryReconciliationItem_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "TreasuryReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreasuryReconciliationItem" ADD CONSTRAINT "TreasuryReconciliationItem_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "TreasuryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryCashCount" ADD CONSTRAINT "TreasuryCashCount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryDailyClose" ADD CONSTRAINT "TreasuryDailyClose_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the former bank, wallet, cash and financial-movement data when upgrading.
INSERT INTO "TreasuryAccount" (
  "id", "companyId", "code", "name", "type", "institution", "accountNumber", "cbu",
  "currency", "balance", "availableBalance", "overdraftLimit", "createdAt", "updatedAt"
)
SELECT ba."id", company."id", 'LEGACY-' || upper(substr(md5(ba."id"), 1, 12)), ba."accountName",
  CASE WHEN ba."bankName" LIKE 'WALLET:%' THEN 'VIRTUAL_WALLET'::"TreasuryAccountType" ELSE 'BANK_CURRENT'::"TreasuryAccountType" END,
  replace(ba."bankName", 'WALLET:', ''), ba."accountNumber", ba."cbu", ba."currency",
  ba."bankBalance", ba."bankBalance", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BankAccount" ba
CROSS JOIN LATERAL (SELECT "id" FROM "Company" ORDER BY "createdAt" LIMIT 1) company
ON CONFLICT DO NOTHING;

INSERT INTO "TreasuryAccount" (
  "id", "companyId", "code", "name", "type", "institution", "currency",
  "balance", "availableBalance", "overdraftLimit", "createdAt", "updatedAt"
)
SELECT cb."id", company."id", 'LEGACY-CASH-' || upper(substr(md5(cb."id"), 1, 8)), cb."name",
  'CASH'::"TreasuryAccountType", 'Caja histórica', 'ARS', cb."balance", cb."balance", 0,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CashBox" cb
CROSS JOIN LATERAL (SELECT "id" FROM "Company" ORDER BY "createdAt" LIMIT 1) company
ON CONFLICT DO NOTHING;

INSERT INTO "TreasuryMovement" (
  "id", "companyId", "workId", "sourceAccountId", "destinationAccountId", "type", "status",
  "concept", "amount", "occurredAt", "counterparty", "reference", "createdById", "createdAt", "updatedAt"
)
SELECT fm."id", COALESCE(work."companyId", company."id"), fm."workId",
  CASE WHEN fm."direction" = 'OUT' THEN COALESCE(fm."bankAccountId", fm."cashBoxId") END,
  CASE WHEN fm."direction" = 'IN' THEN COALESCE(fm."bankAccountId", fm."cashBoxId") END,
  CASE WHEN fm."direction" = 'IN' THEN 'INCOME'::"TreasuryMovementType" ELSE 'EXPENSE'::"TreasuryMovementType" END,
  'EXECUTED'::"TreasuryMovementStatus", fm."concept", fm."amount", fm."occurredAt",
  fm."counterparty", fm."reference", fm."createdById", fm."occurredAt", fm."occurredAt"
FROM "FinancialMovement" fm
LEFT JOIN "Work" work ON work."id" = fm."workId"
CROSS JOIN LATERAL (SELECT "id" FROM "Company" ORDER BY "createdAt" LIMIT 1) company
WHERE fm."deletedAt" IS NULL AND COALESCE(fm."bankAccountId", fm."cashBoxId") IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- Historical treasury records are never physically deleted.
CREATE TRIGGER "TreasuryMovement_no_delete" BEFORE DELETE ON "TreasuryMovement"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "TreasuryCheque_no_delete" BEFORE DELETE ON "TreasuryCheque"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "TreasuryReconciliation_no_delete" BEFORE DELETE ON "TreasuryReconciliation"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "TreasuryCashCount_no_delete" BEFORE DELETE ON "TreasuryCashCount"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "TreasuryDailyClose_no_delete" BEFORE DELETE ON "TreasuryDailyClose"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
