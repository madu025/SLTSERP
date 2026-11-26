-- Purchase order approval chain (3 mandatory steps) and the executive second approval of large supplier invoices.
-- Additive only: two nullable columns on PurchaseOrder, two on SupplierInvoice, one new append-only table.

ALTER TABLE "PurchaseOrder" ADD COLUMN "createdById" UUID;
ALTER TABLE "PurchaseOrder" ADD COLUMN "approvalStage" TEXT;

ALTER TABLE "SupplierInvoice" ADD COLUMN "financeApprovedById" UUID;
ALTER TABLE "SupplierInvoice" ADD COLUMN "financeApprovedAt" TIMESTAMP(3);

CREATE TABLE "PurchaseOrderApproval" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "purchaseOrderId" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "stage" TEXT,
    "action" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "amount" TEXT NOT NULL,
    "remarks" TEXT,
    "previousHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrderApproval_purchaseOrderId_seq_key" ON "PurchaseOrderApproval"("purchaseOrderId", "seq");
CREATE INDEX "PurchaseOrderApproval_actorId_idx" ON "PurchaseOrderApproval"("actorId");

ALTER TABLE "PurchaseOrderApproval" ADD CONSTRAINT "PurchaseOrderApproval_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The approval log can only grow: no update, no delete, as for the audit log.
CREATE OR REPLACE FUNCTION fn_po_approval_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'PO_APPROVAL_IMMUTABLE: approval records cannot be updated. Attempted on id=%', NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'PO_APPROVAL_IMMUTABLE: approval records cannot be deleted. Attempted on id=%', OLD.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_po_approval_immutable ON "PurchaseOrderApproval";
CREATE TRIGGER trg_po_approval_immutable
BEFORE UPDATE OR DELETE ON "PurchaseOrderApproval"
FOR EACH ROW
EXECUTE FUNCTION fn_po_approval_immutable();

-- Orders already waiting for approval enter the chain at step 1.
UPDATE "PurchaseOrder" SET "approvalStage" = 'L1' WHERE "status" = 'PENDING_APPROVAL' AND "approvalStage" IS NULL;
