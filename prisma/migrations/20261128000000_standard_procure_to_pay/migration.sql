-- Standard procure-to-pay alignment. Additive only.
INSERT INTO "ChartOfAccount" ("code","name","type","isPostable","isActive","updatedAt")
VALUES ('VAT-REC-1310','Input VAT Receivable','ASSET'::"AccountType",true,true,NOW())
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "ChartOfAccount" ("code","name","type","isPostable","isActive","updatedAt")
VALUES ('EXP-PPV-5050','Purchase Price Variance','EXPENSE'::"AccountType",true,true,NOW())
ON CONFLICT ("code") DO NOTHING;
UPDATE "ChartOfAccount" SET "name"='GR/IR Clearing (Goods Received, Not Invoiced)' WHERE "code"='AP-2010';

ALTER TABLE "PaymentVoucher" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "supplierInvoiceId" UUID;
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "vendorId" UUID;
ALTER TABLE "PaymentVoucher" ADD COLUMN IF NOT EXISTS "bankAccountId" UUID;
CREATE INDEX IF NOT EXISTS "PaymentVoucher_supplierInvoiceId_idx" ON "PaymentVoucher"("supplierInvoiceId");
CREATE INDEX IF NOT EXISTS "PaymentVoucher_vendorId_idx" ON "PaymentVoucher"("vendorId");

ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
UPDATE "SupplierInvoice" SET "paidAmount"="totalAmount" WHERE "status"='PAID' AND "paidAmount"=0;

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "approvedById" UUID;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SupplierDebitNote" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "noteNumber" TEXT NOT NULL,
  "vendorId" UUID NOT NULL,
  "supplierInvoiceId" UUID,
  "mrnId" UUID,
  "amount" DECIMAL(14,2) NOT NULL,
  "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "reason" TEXT,
  "createdById" UUID,
  "journalEntryId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierDebitNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierDebitNote_noteNumber_key" ON "SupplierDebitNote"("noteNumber");
CREATE INDEX IF NOT EXISTS "SupplierDebitNote_vendorId_idx" ON "SupplierDebitNote"("vendorId");
CREATE INDEX IF NOT EXISTS "SupplierDebitNote_supplierInvoiceId_idx" ON "SupplierDebitNote"("supplierInvoiceId");
CREATE INDEX IF NOT EXISTS "SupplierDebitNote_mrnId_idx" ON "SupplierDebitNote"("mrnId");
