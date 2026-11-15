-- Service payables (site office rent, vehicle rentals): supplier invoices without a purchase order. Additive only.
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'PO_GOODS';
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "periodMonth" TEXT;
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "opmcId" UUID;
CREATE INDEX IF NOT EXISTS "SupplierInvoice_category_status_idx" ON "SupplierInvoice"("category", "status");
-- One invoice per source and month (NULLs never collide, so ordinary invoices are unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierInvoice_sourceType_sourceId_periodMonth_key" ON "SupplierInvoice"("sourceType", "sourceId", "periodMonth");
ALTER TABLE "SiteOfficeAgreement" ADD COLUMN IF NOT EXISTS "vendorId" UUID;
ALTER TABLE "SupplierInvoiceItem" ALTER COLUMN "poItemId" DROP NOT NULL;
