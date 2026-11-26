-- Simpler company flow (owner, 26 Nov 2026). Approvals that are signed on paper or given in the HO ERP are recorded, not repeated, in Nexus.
--   Material request: Stores Officer -> Stores Manager -> OSP Manager -> the Stores Manager confirms the documents were submitted to Procurement
--   -> Procurement records the PO (the request is ready for GRN once every line is ordered) -> GRN.
--   Vendor voucher: Account Officer raises it -> the Account Manager, OSP Manager and Head of Section sign it on paper and the Account Officer records
--   "signed by all three" with the scan -> Account Officer sends the documents -> HO Account Executive marks them received (sent to HO) -> HO payments.

-- 1. the Stores Manager's "documents submitted to Procurement" step, and the scan of the signed voucher
ALTER TABLE "StockRequest" ADD COLUMN "procurementDocsSubmittedAt" TIMESTAMP(3);
ALTER TABLE "StockRequest" ADD COLUMN "procurementDocsSubmittedById" UUID;
ALTER TABLE "PaymentVoucher" ADD COLUMN "signedVoucherUrl" TEXT;

-- requests already with Procurement (or later) are past the documents step
UPDATE "StockRequest" SET "procurementDocsSubmittedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "workflowStage" IN ('PROCUREMENT', 'PROCUREMENT_PROCESSING', 'GRN_PENDING', 'STORE_RECEIVING', 'COMPLETED') AND "procurementDocsSubmittedAt" IS NULL;

-- 2. the request no longer waits for the Head of Section: after the OSP Manager it goes to Procurement, and the Stores Manager is told to submit the documents
UPDATE "ProcessGatePolicy" SET "toStatus" = 'PROCUREMENT', "label" = '3. OSP Manager Approval', "notificationAudience" = 'STORES_MANAGERS', "updatedAt" = CURRENT_TIMESTAMP
WHERE "entityType" = 'MATERIAL_REQUEST' AND "fromStatus" = 'OSP_MANAGER_APPROVAL' AND "toStatus" = 'HOS_APPROVAL';
-- the Head of Section gate is switched off, not deleted (it can be switched on again on the Process Gates page)
UPDATE "ProcessGatePolicy" SET "isEnabled" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "entityType" = 'MATERIAL_REQUEST' AND "fromStatus" = 'HOS_APPROVAL' AND "toStatus" = 'PROCUREMENT';
-- requests waiting for the Head of Section were approved by the OSP Manager: they go to Procurement and wait for the Stores Manager's documents
UPDATE "StockRequest" SET "workflowStage" = 'PROCUREMENT', "status" = 'APPROVED', "updatedAt" = CURRENT_TIMESTAMP
WHERE "workflowStage" = 'HOS_APPROVAL' AND "status" = 'PENDING';

-- 3. vendor vouchers waiting in the former approval steps now wait for the Account Officer's "signed by all three"
UPDATE "PaymentVoucher" SET "approvalStage" = 'SIGNATURES', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'PENDING_APPROVAL' AND "approvalStage" IN ('ACCOUNT_MANAGER', 'OSP_MANAGER', 'HEAD_OF_SECTION');
