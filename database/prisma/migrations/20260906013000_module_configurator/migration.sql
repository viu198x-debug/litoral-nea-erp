CREATE TABLE "ModuleConfiguration" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'FileText',
    "summary" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiresWork" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModuleConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleFieldConfiguration" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModuleFieldConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleConfiguration_slug_key" ON "ModuleConfiguration"("slug");
CREATE INDEX "ModuleConfiguration_active_groupName_sortOrder_idx" ON "ModuleConfiguration"("active", "groupName", "sortOrder");
CREATE UNIQUE INDEX "ModuleFieldConfiguration_moduleId_fieldKey_key" ON "ModuleFieldConfiguration"("moduleId", "fieldKey");
CREATE INDEX "ModuleFieldConfiguration_moduleId_active_sortOrder_idx" ON "ModuleFieldConfiguration"("moduleId", "active", "sortOrder");
ALTER TABLE "ModuleFieldConfiguration" ADD CONSTRAINT "ModuleFieldConfiguration_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ModuleConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
