-- The approval chain (Area Coordinator -> QC Officer -> Contractor -> Engineer -> Area Manager) belongs on the INVOICE, not on each service
-- order: a contractor can have 50-100 orders in one invoice. This retires the per-order gate of 20261208000000 and seeds the invoice gate.
-- During approval an approver can take service orders out of the invoice; the orders go back to the verification list.
-- Additive except for the retired per-order gate. Every statement is safe to run twice.

CREATE TABLE IF NOT EXISTS "InvoiceSodRemoval" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
  "invoiceId" UUID NOT NULL,
  "serviceOrderId" UUID NOT NULL,
  "soNum" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceSodRemoval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InvoiceSodRemoval_invoiceId_idx" ON "InvoiceSodRemoval"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceSodRemoval_serviceOrderId_idx" ON "InvoiceSodRemoval"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "InvoiceSodRemoval_userId_idx" ON "InvoiceSodRemoval"("userId");
DO $$ BEGIN
  ALTER TABLE "InvoiceSodRemoval" ADD CONSTRAINT "InvoiceSodRemoval_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InvoiceSodRemoval" ADD CONSTRAINT "InvoiceSodRemoval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Retire the per-order gate: close its open steps, release the orders (orders already approved and invoicable stay invoicable)
UPDATE "UniversalApprovalInstance" i SET "status" = 'REJECTED', "actionedAt" = NOW(), "comments" = 'RESTARTED: approval moved to the invoice'
FROM "ProcessGatePolicy" p
WHERE i."policyId" = p."id" AND p."entityType" = 'SERVICE_ORDER' AND p."fromStatus" = 'COMPLETED' AND p."toStatus" = 'INVOICABLE' AND i."status" = 'PENDING';
UPDATE "ServiceOrder" SET "sodApprovalStage" = NULL WHERE "sodApprovalStage" IS NOT NULL AND "sodApprovalStage" <> 'CONFIRMED';
DELETE FROM "ProcessGatePolicy" WHERE "entityType" = 'SERVICE_ORDER' AND "fromStatus" = 'COMPLETED' AND "toStatus" = 'INVOICABLE';

-- 2. The invoice gate, same steps and options as before
INSERT INTO "ProcessGatePolicy" ("entityType", "fromStatus", "toStatus", "label", "isEnabled", "rejectionBehavior", "approvalStrategy", "domainAction", "queueMode", "updatedAt")
VALUES ('INVOICE', 'CREATED', 'AREA_APPROVED', 'Invoice area approval', true, 'REWORK_TO_CREATOR', 'ANY_CAN_APPROVE', 'MARK_INVOICE_AREA_APPROVED', true, NOW())
ON CONFLICT ("entityType", "fromStatus", "toStatus") DO NOTHING;

INSERT INTO "ProcessApprovalLevel" ("gatePolicyId", "level", "policyVariant", "requiredRole", "requiredPermission", "eligibleRoles", "description", "assignee", "skipIfNoApprover")
SELECT p."id", v."level", 'DEFAULT', v."role", v."perm", v."roles"::jsonb, v."descr", v."assignee", v."skip"
FROM "ProcessGatePolicy" p
CROSS JOIN (VALUES
  (1, 'AREA_COORDINATOR', 'invoice.confirm.coordinator', '["AREA_COORDINATOR"]', 'Area Coordinator checks the invoice and its service orders',    'ROLE',             false),
  (2, 'QC_OFFICER',       'invoice.confirm.qc',          '["QC_OFFICER"]',       'QC Officer checks quality (can take service orders out)',       'ROLE',             false),
  (3, 'CONTRACTOR',       'contractor.write',            '["CONTRACTOR"]',       'The contractor of the invoice confirms it',                     'ORDER_CONTRACTOR', false),
  (4, 'ENGINEER',         'invoice.confirm.engineer',    '["ENGINEER","ASSISTANT_ENGINEER"]', 'Area Engineer / Officer (skipped when the area has none)', 'ROLE',          true),
  (5, 'AREA_MANAGER',     'invoice.confirm.manager',     '["AREA_MANAGER"]',     'Area Manager final approval, then OSP Quality verifies the invoice', 'ROLE',          false)
) AS v("level", "role", "perm", "roles", "descr", "assignee", "skip")
WHERE p."entityType" = 'INVOICE' AND p."fromStatus" = 'CREATED' AND p."toStatus" = 'AREA_APPROVED'
ON CONFLICT ("gatePolicyId", "policyVariant", "level") DO NOTHING;

-- 3. Invoices already waiting on a contractor answer, or part-way through the older fixed chain, continue inside the gate. The Contractor
-- step is now third, so anything past the Coordinator and QC re-enters at the Contractor step.
UPDATE "Invoice" SET "approvalFlow" = 'OSP_CHAIN', "contractorConfirmStatus" = 'AWAITING',
  "confirmStage" = CASE "confirmStage" WHEN 'AREA_COORDINATOR' THEN 'AREA_COORDINATOR' WHEN 'QC_OFFICER' THEN 'QC_OFFICER' ELSE 'CONTRACTOR' END
WHERE ("confirmStage" IN ('AREA_COORDINATOR', 'QC_OFFICER', 'AREA_ENGINEER', 'AREA_MANAGER'))
   OR ("approvalFlow" = 'OSP_CHAIN' AND "contractorConfirmStatus" IN ('AWAITING', 'DISPUTED') AND "statusA" = 'PENDING_SF_AUDIT');
UPDATE "Invoice" SET "confirmStage" = 'CONTRACTOR' WHERE "approvalFlow" = 'OSP_CHAIN' AND "contractorConfirmStatus" = 'AWAITING' AND "statusA" = 'PENDING_SF_AUDIT' AND "confirmStage" = 'CONFIRMED';

INSERT INTO "UniversalApprovalInstance" ("entityType", "entityId", "policyId", "levelIndex", "level", "requiredRole", "requiredPermission", "eligibleRoles", "policyVariant", "status", "comments")
SELECT 'INVOICE', inv."id"::text, l."gatePolicyId", l."level" - 1, l."level", l."requiredRole", l."requiredPermission", l."eligibleRoles", 'DEFAULT', 'PENDING', 'Continued from the earlier approval chain'
FROM "Invoice" inv
JOIN "ProcessGatePolicy" p ON p."entityType" = 'INVOICE' AND p."fromStatus" = 'CREATED' AND p."toStatus" = 'AREA_APPROVED'
JOIN "ProcessApprovalLevel" l ON l."gatePolicyId" = p."id" AND l."policyVariant" = 'DEFAULT'
 AND l."requiredRole" = inv."confirmStage"
WHERE inv."confirmStage" IN ('AREA_COORDINATOR', 'QC_OFFICER', 'CONTRACTOR')
  AND NOT EXISTS (SELECT 1 FROM "UniversalApprovalInstance" i WHERE i."entityType" = 'INVOICE' AND i."entityId" = inv."id"::text AND i."policyId" = p."id" AND i."status" = 'PENDING');
UPDATE "Invoice" SET "contractorConfirmStatus" = 'AWAITING', "contractorNote" = NULL WHERE "confirmStage" IN ('AREA_COORDINATOR', 'QC_OFFICER', 'CONTRACTOR');
