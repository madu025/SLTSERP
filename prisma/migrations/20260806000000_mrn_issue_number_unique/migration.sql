-- Migration: mrn_issue_number_unique
-- Hardening: guarantee unique MIN/MRN/ISS document numbers at the database level.
--
-- The document-number columns on ContractorMaterialIssue and
-- ContractorMaterialReturn were historically added outside the migration
-- history (prisma db push). This migration makes the migration history the
-- source of truth: it adds the columns if missing, backfills legacy rows,
-- and (re)creates every document-number unique index idempotently.

-- 1. Ensure columns exist (no-op when already present)
ALTER TABLE "ContractorMaterialIssue" ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE "ContractorMaterialReturn" ADD COLUMN IF NOT EXISTS "returnNumber" TEXT;

-- 2. Backfill legacy rows that predate document numbering
UPDATE "ContractorMaterialIssue" SET "issueNumber" = 'LEGACY-' || "id" WHERE "issueNumber" IS NULL OR "issueNumber" = '';
UPDATE "ContractorMaterialReturn" SET "returnNumber" = 'LEGACY-' || "id" WHERE "returnNumber" IS NULL OR "returnNumber" = '';

-- 3. Enforce NOT NULL (document numbers are mandatory business keys)
ALTER TABLE "ContractorMaterialIssue" ALTER COLUMN "issueNumber" SET NOT NULL;
ALTER TABLE "ContractorMaterialReturn" ALTER COLUMN "returnNumber" SET NOT NULL;

-- 4. Unique business-key indexes (idempotent — safe if already created by db push)
CREATE UNIQUE INDEX IF NOT EXISTS "ContractorMaterialIssue_issueNumber_key" ON "ContractorMaterialIssue"("issueNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ContractorMaterialReturn_returnNumber_key" ON "ContractorMaterialReturn"("returnNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "MRN_mrnNumber_key" ON "MRN"("mrnNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "StockIssue_issueNumber_key" ON "StockIssue"("issueNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMaterialReturn_returnNumber_key" ON "ProjectMaterialReturn"("returnNumber");
