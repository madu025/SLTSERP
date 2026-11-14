-- Supply chain phase 2, part 1: store purchase order control, receipt-to-PO tracking, supplier invoice (3-way match).
-- Additive only: every statement is IF NOT EXISTS, nothing is rewritten or removed.

-- Store purchase order: vendor link, money header, lifecycle dates
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "vendorId" UUID;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'LKR';
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "cancelledById" UUID;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

DO $$ BEGIN
    ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- Existing orders keep their free-text vendor; header totals are filled from their lines so reports are not blank
UPDATE "PurchaseOrder" po
SET "subtotal" = COALESCE(t.sub, 0), "taxAmount" = COALESCE(t.tax, 0), "totalAmount" = COALESCE(t.total, 0)
FROM (
    SELECT "purchaseOrderId", SUM("quantity" * "unitPrice") AS sub, SUM("taxAmount") AS tax, SUM("totalAmount") AS total
    FROM "PurchaseOrderItem" GROUP BY 1
) t
WHERE t."purchaseOrderId" = po."id" AND po."totalAmount" = 0;

-- Received quantity per PO line (existing orders start at zero: older GRNs carried no PO line link)
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "receivedQty" DECIMAL(12,4) NOT NULL DEFAULT 0;

-- Which PO line a receipt line fulfils, and the price it was received at
ALTER TABLE "GRNItem" ADD COLUMN IF NOT EXISTS "poItemId" UUID;
ALTER TABLE "GRNItem" ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(14,2);
CREATE INDEX IF NOT EXISTS "GRNItem_poItemId_idx" ON "GRNItem"("poItemId");

-- Supplier invoice and its lines
CREATE TABLE IF NOT EXISTS "SupplierInvoice" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "invoiceNumber" TEXT NOT NULL,
    "vendorId" UUID NOT NULL,
    "storePoId" UUID,
    "projectPoId" UUID,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "matchStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "matchDetail" JSONB,
    "overrideReason" TEXT,
    "rejectionReason" TEXT,
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "journalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierInvoice_vendorId_invoiceNumber_key" ON "SupplierInvoice"("vendorId", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_storePoId_idx" ON "SupplierInvoice"("storePoId");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_projectPoId_idx" ON "SupplierInvoice"("projectPoId");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_status_idx" ON "SupplierInvoice"("status");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_vendorId_status_idx" ON "SupplierInvoice"("vendorId", "status");

CREATE TABLE IF NOT EXISTS "SupplierInvoiceItem" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "invoiceId" UUID NOT NULL,
    "poItemId" UUID NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "SupplierInvoiceItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupplierInvoiceItem_invoiceId_idx" ON "SupplierInvoiceItem"("invoiceId");
CREATE INDEX IF NOT EXISTS "SupplierInvoiceItem_poItemId_idx" ON "SupplierInvoiceItem"("poItemId");

DO $$ BEGIN
    ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_storePoId_fkey" FOREIGN KEY ("storePoId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_projectPoId_fkey" FOREIGN KEY ("projectPoId") REFERENCES "ProjectPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "SupplierInvoiceItem" ADD CONSTRAINT "SupplierInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
