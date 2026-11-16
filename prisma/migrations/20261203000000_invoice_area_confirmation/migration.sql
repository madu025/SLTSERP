-- Area confirmation chain for contractor invoices. Existing invoices are treated as already confirmed (default CONFIRMED);
-- the generator starts new invoices at AREA_COORDINATOR. Additive only.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "confirmStage" TEXT NOT NULL DEFAULT 'CONFIRMED';

CREATE TABLE IF NOT EXISTS "InvoiceConfirmation" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "invoiceId" UUID NOT NULL,
  "stage" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceConfirmation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InvoiceConfirmation_invoiceId_idx" ON "InvoiceConfirmation"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceConfirmation_userId_idx" ON "InvoiceConfirmation"("userId");
DO $$ BEGIN
  ALTER TABLE "InvoiceConfirmation" ADD CONSTRAINT "InvoiceConfirmation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InvoiceConfirmation" ADD CONSTRAINT "InvoiceConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "PermissionDefinition" ("code","module","action","scope","description","isActive","updatedAt") VALUES
 ('invoice.confirm.coordinator','CONTRACTOR_INVOICE','CONFIRM_COORDINATOR','OPMC'::"PermissionScope",'Area Coordinator confirmation of contractor invoices',true,NOW()),
 ('invoice.confirm.qc','CONTRACTOR_INVOICE','CONFIRM_QC','OPMC'::"PermissionScope",'QC Officer confirmation of contractor invoices',true,NOW()),
 ('invoice.confirm.engineer','CONTRACTOR_INVOICE','CONFIRM_ENGINEER','OPMC'::"PermissionScope",'Area Engineer or Officer confirmation of contractor invoices',true,NOW()),
 ('invoice.confirm.manager','CONTRACTOR_INVOICE','CONFIRM_MANAGER','OPMC'::"PermissionScope",'Area Manager final confirmation of contractor invoices',true,NOW())
ON CONFLICT ("code") DO NOTHING;
