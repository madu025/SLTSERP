-- Petty cash, floats and IOUs belong to a SITE OFFICE (an InventoryStore), not to an OPMC (RTOM). A site office can cover several RTOMs.
-- The old OPMC columns stay (nullable) so boxes and floats made before this keep working.
ALTER TABLE "PettyCashAccount" ADD COLUMN IF NOT EXISTS "siteOfficeId" UUID;
ALTER TABLE "PettyCashAccount" ALTER COLUMN "opmcId" DROP NOT NULL;
DROP INDEX IF EXISTS "PettyCashAccount_opmcId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PettyCashAccount_siteOfficeId_key" ON "PettyCashAccount"("siteOfficeId");

ALTER TABLE "OspFloat" ADD COLUMN IF NOT EXISTS "siteOfficeId" UUID;
ALTER TABLE "OspFloat" ALTER COLUMN "opmcId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "OspFloat_siteOfficeId_type_key" ON "OspFloat"("siteOfficeId", "type");

ALTER TABLE "OspPettyCashIou" ADD COLUMN IF NOT EXISTS "siteOfficeId" UUID;
