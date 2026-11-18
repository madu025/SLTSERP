-- After SF Audit verifies a contractor invoice, Finance sends it to the OSP managers, who approve it before Head Office pays.
-- approvalFlow separates new invoices (OSP_CHAIN) from every invoice that exists today (LEGACY keeps the old single approval). Additive only.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "approvalFlow" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "ospSentAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "ospSentById" UUID;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "ospDecisionAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "ospDecisionById" UUID;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "ospNote" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_approvalFlow_approvalStatus_idx" ON "Invoice"("approvalFlow", "approvalStatus");

INSERT INTO "PermissionDefinition" ("code","module","action","scope","description","isActive","updatedAt") VALUES
 ('invoice.osp.approve','CONTRACTOR_INVOICE','OSP_APPROVE','OPMC'::"PermissionScope",'OSP Manager approval of SF Audit verified contractor invoices sent by Finance, before Head Office payment',true,NOW())
ON CONFLICT ("code") DO NOTHING;
