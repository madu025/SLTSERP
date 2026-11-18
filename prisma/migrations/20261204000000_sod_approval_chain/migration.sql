-- Area approval chain for completed service orders (Area Coordinator -> QC Officer -> Area Engineer when the area has one ->
-- Area Manager). It happens BEFORE a contractor invoice can be made. A NULL stage means the order is not in the chain
-- (every order completed before this feature keeps the old single verification). Additive only.
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "sodApprovalStage" TEXT;
CREATE INDEX IF NOT EXISTS "ServiceOrder_sodApprovalStage_idx" ON "ServiceOrder"("sodApprovalStage");

CREATE TABLE IF NOT EXISTS "SodApproval" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "serviceOrderId" UUID NOT NULL,
  "stage" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SodApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SodApproval_serviceOrderId_idx" ON "SodApproval"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "SodApproval_userId_idx" ON "SodApproval"("userId");
DO $$ BEGIN
  ALTER TABLE "SodApproval" ADD CONSTRAINT "SodApproval_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SodApproval" ADD CONSTRAINT "SodApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The four stage capabilities now describe the service order chain (the same people hold them).
UPDATE "PermissionDefinition" SET "description" = 'Area Coordinator stage of the service order approval chain (before invoicing)', "updatedAt" = NOW() WHERE "code" = 'invoice.confirm.coordinator';
UPDATE "PermissionDefinition" SET "description" = 'QC Officer stage of the service order approval chain (before invoicing)', "updatedAt" = NOW() WHERE "code" = 'invoice.confirm.qc';
UPDATE "PermissionDefinition" SET "description" = 'Area Engineer or Officer stage of the service order approval chain (before invoicing)', "updatedAt" = NOW() WHERE "code" = 'invoice.confirm.engineer';
UPDATE "PermissionDefinition" SET "description" = 'Area Manager final stage of the service order approval chain (before invoicing)', "updatedAt" = NOW() WHERE "code" = 'invoice.confirm.manager';
