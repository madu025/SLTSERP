-- Vendor payment vouchers of the company flow (from a GRN invoice): accepted by the OSP Account Manager, then the OSP Manager, then the Head of Section;
-- the invoice is posted at the last approval; the Procurement Officer then confirms the documents were received and sends the voucher to HO.
-- Additive only.

ALTER TABLE "PaymentVoucher" ADD COLUMN "approvalStage" TEXT;
ALTER TABLE "PaymentVoucher" ADD COLUMN "approvalTrail" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "PaymentVoucher" ADD COLUMN "docsStatus" TEXT;
ALTER TABLE "PaymentVoucher" ADD COLUMN "docsCheckedById" UUID;
ALTER TABLE "PaymentVoucher" ADD COLUMN "docsCheckedAt" TIMESTAMP(3);
ALTER TABLE "PaymentVoucher" ADD COLUMN "docsRemarks" TEXT;
CREATE INDEX "PaymentVoucher_approvalStage_idx" ON "PaymentVoucher"("approvalStage");
