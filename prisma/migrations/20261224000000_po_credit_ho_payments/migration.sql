-- Credit purchases through HO: credit terms on the purchase order, and HO payments in one or more parts (recorded, then verified).
-- Additive only.

ALTER TABLE "PurchaseOrder" ADD COLUMN "paymentBasis" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "creditDays" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "paymentDueDate" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoAdvanceAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoTaxPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "HoPaymentInstallment" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "purchaseOrderId" UUID,
    "paymentVoucherId" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'TRANSFER',
    "invoiceRef" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "recordedById" UUID NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "toGrir" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "toAdvance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "toTax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "journalEntryId" UUID,

    CONSTRAINT "HoPaymentInstallment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HoPaymentInstallment_purchaseOrderId_idx" ON "HoPaymentInstallment"("purchaseOrderId");
CREATE INDEX "HoPaymentInstallment_status_idx" ON "HoPaymentInstallment"("status");

ALTER TABLE "HoPaymentInstallment" ADD CONSTRAINT "HoPaymentInstallment_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An amount is always positive.
ALTER TABLE "HoPaymentInstallment" ADD CONSTRAINT "HoPaymentInstallment_amount_positive" CHECK ("amount" > 0);
