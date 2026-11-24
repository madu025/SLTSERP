-- The Area Manager (ARM) of a site office, and the custodians of a petty cash box. Additive and idempotent.
ALTER TABLE "InventoryStore" ADD COLUMN IF NOT EXISTS "areaManagerId" UUID;
CREATE INDEX IF NOT EXISTS "InventoryStore_areaManagerId_idx" ON "InventoryStore"("areaManagerId");
DO $$ BEGIN
  ALTER TABLE "InventoryStore" ADD CONSTRAINT "InventoryStore_areaManagerId_fkey" FOREIGN KEY ("areaManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PettyCashCustodian" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "accountId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PettyCashCustodian_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PettyCashCustodian_accountId_userId_key" ON "PettyCashCustodian"("accountId", "userId");
CREATE INDEX IF NOT EXISTS "PettyCashCustodian_userId_idx" ON "PettyCashCustodian"("userId");
