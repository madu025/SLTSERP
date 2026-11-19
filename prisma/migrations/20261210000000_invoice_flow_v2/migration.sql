-- Invoice flow v2. Coordinator and QC Officer approve the service ORDERS of their own area (a shared queue, in bulk); at month end the
-- Engineer creates the invoices (one per contractor, area and billing month); the contractor accepts the invoice and the Area Manager
-- approves it. Additive except for retiring three steps of the invoice gate. Every statement is safe to run twice.

-- 1. The invoice carries its own area (the area of its orders), not the contractor's home area
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "opmcId" UUID;
CREATE INDEX IF NOT EXISTS "Invoice_opmcId_idx" ON "Invoice"("opmcId");
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_opmcId_fkey" FOREIGN KEY ("opmcId") REFERENCES "OPMC"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE "Invoice" i SET "opmcId" = c."opmcId" FROM "Contractor" c WHERE i."contractorId" = c."id" AND i."opmcId" IS NULL AND c."opmcId" IS NOT NULL;

-- 2. An order that the engineer holds back (a problem) is recorded with its reason; it is billed in the month it is made invoiceable
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "invoicingHeldAt" TIMESTAMP(3);
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "invoicingHoldReason" TEXT;

-- 3. The order gate: Area Coordinator -> QC Officer (SERVICE_ORDER COMPLETED -> READY_FOR_INVOICE), shared queue by the order's area
INSERT INTO "ProcessGatePolicy" ("entityType", "fromStatus", "toStatus", "label", "isEnabled", "rejectionBehavior", "approvalStrategy", "domainAction", "queueMode", "updatedAt")
VALUES ('SERVICE_ORDER', 'COMPLETED', 'READY_FOR_INVOICE', 'SOD approval before invoicing (area chain)', true, 'REWORK_TO_CREATOR', 'ANY_CAN_APPROVE', 'MARK_SOD_READY_FOR_INVOICE', true, NOW())
ON CONFLICT ("entityType", "fromStatus", "toStatus") DO NOTHING;

INSERT INTO "ProcessApprovalLevel" ("gatePolicyId", "level", "policyVariant", "requiredRole", "requiredPermission", "eligibleRoles", "description", "assignee", "skipIfNoApprover")
SELECT p."id", v."level", 'DEFAULT', v."role", v."perm", v."roles"::jsonb, v."descr", 'ROLE', false
FROM "ProcessGatePolicy" p
CROSS JOIN (VALUES
  (1, 'AREA_COORDINATOR', 'invoice.confirm.coordinator', '["AREA_COORDINATOR"]', 'Area Coordinator passes the completed orders of the area'),
  (2, 'QC_OFFICER',       'invoice.confirm.qc',          '["QC_OFFICER"]',       'QC Officer checks quality; then the Engineer can invoice the order')
) AS v("level", "role", "perm", "roles", "descr")
WHERE p."entityType" = 'SERVICE_ORDER' AND p."fromStatus" = 'COMPLETED' AND p."toStatus" = 'READY_FOR_INVOICE'
ON CONFLICT ("gatePolicyId", "policyVariant", "level") DO NOTHING;

-- 4. The invoice gate shrinks to Contractor -> Area Manager. Invoices waiting at a retired step restart (the gate opens them again at the
-- first step); invoices waiting at the two kept steps keep their place under the new numbers.
UPDATE "Invoice" SET "confirmStage" = 'IN_GATE'
WHERE "confirmStage" IN ('AREA_COORDINATOR', 'QC_OFFICER', 'ENGINEER');
UPDATE "UniversalApprovalInstance" i SET "status" = 'REJECTED', "actionedAt" = NOW(), "comments" = 'RESTARTED: the invoice approval steps were changed'
FROM "ProcessGatePolicy" p
WHERE i."policyId" = p."id" AND p."entityType" = 'INVOICE' AND p."fromStatus" = 'CREATED' AND p."toStatus" = 'AREA_APPROVED'
  AND i."status" = 'PENDING' AND i."requiredRole" IN ('AREA_COORDINATOR', 'QC_OFFICER', 'ENGINEER');
DELETE FROM "ProcessApprovalLevel" l USING "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id" AND p."entityType" = 'INVOICE' AND p."fromStatus" = 'CREATED' AND p."toStatus" = 'AREA_APPROVED'
  AND l."requiredRole" IN ('AREA_COORDINATOR', 'QC_OFFICER', 'ENGINEER');
UPDATE "ProcessApprovalLevel" l SET "level" = CASE l."requiredRole" WHEN 'CONTRACTOR' THEN 1 WHEN 'AREA_MANAGER' THEN 2 ELSE l."level" END,
  "description" = CASE l."requiredRole" WHEN 'CONTRACTOR' THEN 'The contractor of the invoice reviews and accepts it' WHEN 'AREA_MANAGER' THEN 'Area Manager reviews, then approves or rejects; approved invoices go to OSP Quality' ELSE l."description" END
FROM "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id" AND p."entityType" = 'INVOICE' AND p."fromStatus" = 'CREATED' AND p."toStatus" = 'AREA_APPROVED' AND l."requiredRole" IN ('CONTRACTOR', 'AREA_MANAGER');
UPDATE "UniversalApprovalInstance" i SET "level" = CASE i."requiredRole" WHEN 'CONTRACTOR' THEN 1 ELSE 2 END, "levelIndex" = CASE i."requiredRole" WHEN 'CONTRACTOR' THEN 0 ELSE 1 END
FROM "ProcessGatePolicy" p
WHERE i."policyId" = p."id" AND p."entityType" = 'INVOICE' AND p."fromStatus" = 'CREATED' AND p."toStatus" = 'AREA_APPROVED'
  AND i."status" = 'PENDING' AND i."requiredRole" IN ('CONTRACTOR', 'AREA_MANAGER');
