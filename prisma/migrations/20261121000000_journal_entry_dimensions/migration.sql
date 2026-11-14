-- Reporting dimensions on journal entries: which OPMC and which project an entry belongs to.
-- Lets the ledger answer "profit by OPMC / by project". Both are nullable: entries whose source
-- document carries no attribution stay NULL and are reported as "Unattributed", never guessed.
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "opmcId" UUID;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "projectId" UUID;

CREATE INDEX IF NOT EXISTS "JournalEntry_opmcId_idx" ON "JournalEntry"("opmcId");
CREATE INDEX IF NOT EXISTS "JournalEntry_projectId_idx" ON "JournalEntry"("projectId");

-- Backfill existing entries from their source documents. Reversal entries ("REVERSAL_<type>") follow
-- the document of the entry they reverse. Idempotent: only rows still NULL are touched.

-- Service-order driven postings -> the order's OPMC
UPDATE "JournalEntry" e SET "opmcId" = so."opmcId"
FROM "ServiceOrder" so
WHERE e."opmcId" IS NULL
  AND e."referenceId" = so."id"
  AND replace(e."referenceType", 'REVERSAL_', '') IN ('SOD_CONSUMPTION', 'SOD_REVENUE', 'SOD_WIP_ACCRUAL', 'CONTRACTOR_ACCRUAL', 'SOD');

-- Project expenses -> project and its OPMC
UPDATE "JournalEntry" e SET "projectId" = x."projectId"
FROM "ProjectExpense" x
WHERE e."projectId" IS NULL
  AND e."referenceId" = x."id"
  AND replace(e."referenceType", 'REVERSAL_', '') = 'PROJECT_EXPENSE';

-- Client invoices and receipts -> project
UPDATE "JournalEntry" e SET "projectId" = i."projectId"
FROM "ProjectInvoice" i
WHERE e."projectId" IS NULL
  AND i."projectId" IS NOT NULL
  AND e."referenceId" = i."id"
  AND replace(e."referenceType", 'REVERSAL_', '') IN ('INVOICE_ISSUANCE', 'INVOICE_GENERATION');

UPDATE "JournalEntry" e SET "projectId" = i."projectId"
FROM "CustomerReceipt" r JOIN "ProjectInvoice" i ON i."id" = r."invoiceId"
WHERE e."projectId" IS NULL
  AND i."projectId" IS NOT NULL
  AND e."referenceId" = r."id"
  AND replace(e."referenceType", 'REVERSAL_', '') = 'CUSTOMER_RECEIPT';

-- Contractor invoices -> project
UPDATE "JournalEntry" e SET "projectId" = i."projectId"
FROM "Invoice" i
WHERE e."projectId" IS NULL
  AND i."projectId" IS NOT NULL
  AND e."referenceId" = i."id"
  AND replace(e."referenceType", 'REVERSAL_', '') IN ('CONTRACTOR_INVOICE', 'INVOICE_GENERATION');

-- Payment vouchers, LD penalties, retention releases -> project
UPDATE "JournalEntry" e SET "projectId" = v."projectId"
FROM "PaymentVoucher" v
WHERE e."projectId" IS NULL
  AND e."referenceId" = v."id"
  AND replace(e."referenceType", 'REVERSAL_', '') = 'PV_PAYMENT';

UPDATE "JournalEntry" e SET "projectId" = l."projectId"
FROM "ProjectLDPenalty" l
WHERE e."projectId" IS NULL
  AND e."referenceId" = l."id"
  AND replace(e."referenceType", 'REVERSAL_', '') = 'LD_PENALTY';

UPDATE "JournalEntry" e SET "projectId" = r."projectId"
FROM "ProjectRetention" r
WHERE e."projectId" IS NULL
  AND e."referenceId" = r."id"
  AND replace(e."referenceType", 'REVERSAL_', '') = 'RETENTION_RELEASE';

-- Petty cash -> the account's OPMC
UPDATE "JournalEntry" e SET "opmcId" = a."opmcId"
FROM "PettyCashVoucher" v JOIN "PettyCashAccount" a ON a."id" = v."accountId"
WHERE e."opmcId" IS NULL
  AND e."referenceId" = v."id"
  AND replace(e."referenceType", 'REVERSAL_', '') = 'PETTY_CASH_EXPENSE';

UPDATE "JournalEntry" e SET "opmcId" = a."opmcId"
FROM "PettyCashReimbursement" r JOIN "PettyCashAccount" a ON a."id" = r."accountId"
WHERE e."opmcId" IS NULL
  AND e."referenceId" = r."id"
  AND replace(e."referenceType", 'REVERSAL_', '') = 'PETTY_CASH_REIMBURSEMENT';

-- Payroll allocations -> their OPMC
UPDATE "JournalEntry" e SET "opmcId" = p."opmcId"
FROM "PayrollExpense" p
WHERE e."opmcId" IS NULL
  AND p."opmcId" IS NOT NULL
  AND e."referenceId" = p."id"
  AND replace(e."referenceType", 'REVERSAL_', '') = 'PAYROLL_ALLOCATION';

-- Anything carrying a project but no OPMC takes the project's OPMC
UPDATE "JournalEntry" e SET "opmcId" = p."opmcId"
FROM "Project" p
WHERE e."opmcId" IS NULL
  AND p."opmcId" IS NOT NULL
  AND e."projectId" = p."id";
