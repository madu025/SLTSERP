-- The company's procure-to-pay flow (owner's diagram, 26 Nov 2026):
--   material request: Stores Manager -> OSP Manager -> Head of Section; HO procures; one PO per vendor; a PO may arrive in several GRNs;
--   each GRN is confirmed by the Stores Manager with accepted / rejected quantities, the Oracle GRN number and the vendor's invoice for that delivery;
--   the OSP Account Officer raises the payment voucher from that invoice, the OSP Account Manager accepts it, HO pays in full or in parts,
--   and the Account Executive at HO records each payment.
-- Additive, plus two data changes: one approval level and three designations.

-- GRN: Oracle reference, the vendor's invoice for this delivery, rejected quantities
ALTER TABLE "GRN" ADD COLUMN "oracleGrnNumber" TEXT;
ALTER TABLE "GRN" ADD COLUMN "vendorInvoiceNumber" TEXT;
ALTER TABLE "GRN" ADD COLUMN "vendorInvoiceDate" TIMESTAMP(3);
ALTER TABLE "GRN" ADD COLUMN "vendorInvoiceGoods" DECIMAL(14,2);
ALTER TABLE "GRN" ADD COLUMN "vendorInvoiceTax" DECIMAL(14,2);
ALTER TABLE "GRN" ADD COLUMN "vendorInvoiceUrl" TEXT;
CREATE INDEX "GRN_oracleGrnNumber_idx" ON "GRN"("oracleGrnNumber");

ALTER TABLE "GRNItem" ADD COLUMN "rejectedQty" DECIMAL(12,4) NOT NULL DEFAULT 0;
ALTER TABLE "GRNItem" ADD COLUMN "rejectReason" TEXT;

-- One vendor invoice per GRN
ALTER TABLE "SupplierInvoice" ADD COLUMN "grnId" UUID;
CREATE UNIQUE INDEX "SupplierInvoice_grnId_key" ON "SupplierInvoice"("grnId");

-- Part payments by HO against a payment voucher
ALTER TABLE "PaymentVoucher" ADD COLUMN "hoPaidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
CREATE INDEX "HoPaymentInstallment_paymentVoucherId_idx" ON "HoPaymentInstallment"("paymentVoucherId");

-- Material request chain: the Stores Manager reviews before the OSP Manager (level 1 becomes level 2)
UPDATE "ProcessApprovalLevel" l SET "level" = l."level" + 1
FROM "ProcessGatePolicy" p
WHERE l."gatePolicyId" = p."id" AND p."fromStatus" = 'DRAFT' AND p."toStatus" = 'OSP_MANAGER_APPROVAL'
  AND NOT EXISTS (SELECT 1 FROM "ProcessApprovalLevel" x WHERE x."gatePolicyId" = p."id" AND x."requiredRole" = 'STORES_MANAGER');

INSERT INTO "ProcessApprovalLevel" ("gatePolicyId", "level", "requiredRole", "policyVariant", "requiredPermission", "eligibleRoles", "description", "slaHours")
SELECT p."id", 1, 'STORES_MANAGER', 'DEFAULT', 'inventory.approve', '["STORES_MANAGER"]'::jsonb, 'Stores Manager reviews the material request before the OSP Manager', 24
FROM "ProcessGatePolicy" p
WHERE p."fromStatus" = 'DRAFT' AND p."toStatus" = 'OSP_MANAGER_APPROVAL'
  AND NOT EXISTS (SELECT 1 FROM "ProcessApprovalLevel" x WHERE x."gatePolicyId" = p."id" AND x."requiredRole" = 'STORES_MANAGER');

-- The three finance positions, as designations of the Finance section (their codes end in the base role, so they take its grants)
INSERT INTO "SystemRole" ("name", "code", "sectionId", "description", "level", "permissions", "updatedAt")
SELECT v.name, v.code, s."id", v.description, v.level, '[]', CURRENT_TIMESTAMP
FROM (VALUES
    ('OSP Account Officer', 'OSP_ACCOUNT_OFFICER_FINANCE_ASSISTANT', 'Reviews GRN, PO and vendor invoice and raises the payment voucher', 2),
    ('OSP Account Manager', 'OSP_ACCOUNT_MANAGER_FINANCE_MANAGER', 'Accepts the payment voucher (and with it the vendor invoice) before it goes to HO', 4),
    ('Account Executive (HO, OSP section)', 'HO_ACCOUNT_EXECUTIVE_FINANCE_ASSISTANT', 'At HO: records the payments HO makes on OSP payment vouchers, in full or in parts', 2)
) AS v(name, code, description, level)
CROSS JOIN "Section" s
WHERE s."code" = 'FINANCE'
ON CONFLICT ("code") DO NOTHING;
