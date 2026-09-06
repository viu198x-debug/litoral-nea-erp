ALTER TABLE "FuelLog"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" TEXT,
  ADD COLUMN "voidReason" TEXT;

ALTER TABLE "Vehicle"
  ADD CONSTRAINT "Vehicle_workId_fkey"
  FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Machine"
  ADD CONSTRAINT "Machine_workId_fkey"
  FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FuelLog_voidedAt_filledAt_idx" ON "FuelLog"("voidedAt", "filledAt");
CREATE INDEX "Vehicle_workId_active_idx" ON "Vehicle"("workId", "active");
CREATE INDEX "Machine_workId_active_idx" ON "Machine"("workId", "active");
