-- Head Office payment model: OSP Finance submits payment requests, Head Office pays and funds. Additive only.
INSERT INTO "ChartOfAccount" ("code","name","type","isPostable","isActive","updatedAt")
VALUES ('HO-2020','Due to Head Office (Current Account)','LIABILITY'::"AccountType",true,true,NOW())
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "submittedToHoAt" TIMESTAMP(3);
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "submittedToHoById" UUID;
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "hoBatchId" UUID;
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "hoReference" TEXT;
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "hoPaidDate" TIMESTAMP(3);
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "confirmedById" UUID;
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "recordedOnBehalf" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "PaymentVoucher_hoBatchId_idx" ON "PaymentVoucher"("hoBatchId");

CREATE TABLE IF NOT EXISTS "HoPaymentBatch" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "batchNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "voucherCount" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdById" UUID,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HoPaymentBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HoPaymentBatch_batchNumber_key" ON "HoPaymentBatch"("batchNumber");
CREATE INDEX IF NOT EXISTS "HoPaymentBatch_status_idx" ON "HoPaymentBatch"("status");
CREATE INDEX IF NOT EXISTS "HoPaymentBatch_createdById_idx" ON "HoPaymentBatch"("createdById");

CREATE TABLE IF NOT EXISTS "HoFundingRequest" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "requestNumber" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "periodFrom" TIMESTAMP(3),
  "periodTo" TIMESTAMP(3),
  "requestedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "approvedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "fundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "hoReference" TEXT,
  "fundedDate" TIMESTAMP(3),
  "pettyCashAccountId" UUID,
  "reimbursementId" UUID,
  "remarks" TEXT,
  "rejectionReason" TEXT,
  "basis" JSONB,
  "createdById" UUID,
  "submittedAt" TIMESTAMP(3),
  "approvedById" UUID,
  "approvedAt" TIMESTAMP(3),
  "fundedById" UUID,
  "journalEntryId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HoFundingRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HoFundingRequest_requestNumber_key" ON "HoFundingRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "HoFundingRequest_status_idx" ON "HoFundingRequest"("status");
CREATE INDEX IF NOT EXISTS "HoFundingRequest_purpose_idx" ON "HoFundingRequest"("purpose");
CREATE INDEX IF NOT EXISTS "HoFundingRequest_pettyCashAccountId_idx" ON "HoFundingRequest"("pettyCashAccountId");
CREATE INDEX IF NOT EXISTS "HoFundingRequest_reimbursementId_idx" ON "HoFundingRequest"("reimbursementId");

-- Canonical capabilities (the catalog row must exist before a role can be granted it)
INSERT INTO "PermissionDefinition" ("code","module","action","scope","description","isActive","updatedAt") VALUES
 ('finance.ho.submit','FINANCE','HO_SUBMIT','OPMC'::"PermissionScope",'Submit payment requests and funding requests to Head Office',true,NOW()),
 ('finance.ho.confirm','FINANCE','HO_CONFIRM','GLOBAL'::"PermissionScope",'Confirm Head Office payments and approve or fund Head Office funding requests',true,NOW())
ON CONFLICT ("code") DO NOTHING;

-- Default grants: whoever prepares finance documents may submit; whoever approves finance may record Head Office confirmations
-- (administrators can narrow this: Head Office staff only get finance.ho.confirm).
INSERT INTO "RolePermission" ("roleId","permission","permissionDefinitionId")
SELECT rp."roleId", 'finance.ho.submit', pd."id" FROM "RolePermission" rp
JOIN "PermissionDefinition" pd ON pd."code" = 'finance.ho.submit' WHERE rp."permission" = 'finance.write'
ON CONFLICT ("roleId","permission") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permission","permissionDefinitionId")
SELECT rp."roleId", 'finance.ho.confirm', pd."id" FROM "RolePermission" rp
JOIN "PermissionDefinition" pd ON pd."code" = 'finance.ho.confirm' WHERE rp."permission" = 'finance.approve'
ON CONFLICT ("roleId","permission") DO NOTHING;
