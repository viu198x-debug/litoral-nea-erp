-- OAuth identities and administrator-approved registrations.
CREATE TYPE "IdentityProvider" AS ENUM ('GOOGLE', 'MICROSOFT');
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ExternalIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalIdentity_provider_subject_key"
    ON "ExternalIdentity"("provider", "subject");
CREATE UNIQUE INDEX "ExternalIdentity_userId_provider_key"
    ON "ExternalIdentity"("userId", "provider");
CREATE INDEX "ExternalIdentity_email_idx" ON "ExternalIdentity"("email");

CREATE UNIQUE INDEX "RegistrationRequest_provider_providerSubject_key"
    ON "RegistrationRequest"("provider", "providerSubject");
CREATE INDEX "RegistrationRequest_companyId_status_requestedAt_idx"
    ON "RegistrationRequest"("companyId", "status", "requestedAt");
CREATE INDEX "RegistrationRequest_email_idx" ON "RegistrationRequest"("email");

ALTER TABLE "ExternalIdentity"
    ADD CONSTRAINT "ExternalIdentity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest"
    ADD CONSTRAINT "RegistrationRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest"
    ADD CONSTRAINT "RegistrationRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defence in depth: event, accounting and audit rows are physically immutable.
CREATE OR REPLACE FUNCTION "lnea_prevent_physical_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'physical deletion is forbidden for historical table %', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE OR REPLACE FUNCTION "lnea_prevent_audit_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_audit_mutation"();

CREATE TRIGGER "DocumentVersion_no_delete"
  BEFORE DELETE ON "DocumentVersion"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "DossierMovement_no_delete"
  BEFORE DELETE ON "DossierMovement"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "StockMovement_no_delete"
  BEFORE DELETE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "FinancialMovement_no_delete"
  BEFORE DELETE ON "FinancialMovement"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "JournalEntry_no_delete"
  BEFORE DELETE ON "JournalEntry"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "JournalLine_no_delete"
  BEFORE DELETE ON "JournalLine"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "Payroll_no_delete"
  BEFORE DELETE ON "Payroll"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "Certificate_no_delete"
  BEFORE DELETE ON "Certificate"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
CREATE TRIGGER "ApprovalDecision_no_delete"
  BEFORE DELETE ON "ApprovalDecision"
  FOR EACH ROW EXECUTE FUNCTION "lnea_prevent_physical_delete"();
