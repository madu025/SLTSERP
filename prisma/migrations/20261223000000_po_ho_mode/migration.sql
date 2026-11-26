-- Procurement in HO mode: the purchase order is approved in the HO system and recorded in Nexus with its evidence; HO payment details.
-- Additive only: nullable columns and one column with a default on PurchaseOrder.

ALTER TABLE "PurchaseOrder" ADD COLUMN "hoApprovalRef" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoApprovalDate" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoApprovedBy" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoDocumentUrl" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoInvoiceRef" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoPaymentRef" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoPaidAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "hoClearedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
