-- Separate external submission and payment dimensions from the internal
-- invoice workflow status. This makes "submitted to SLT but unpaid" explicit.

ALTER TABLE "ProjectInvoice"
  ADD COLUMN IF NOT EXISTS "submissionStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'NOT_DUE',
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submittedById" UUID,
  ADD COLUMN IF NOT EXISTS "submissionReference" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentReceivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;

-- Preserve the meaning of existing production invoices during the migration.
UPDATE "ProjectInvoice"
SET
  "submissionStatus" = CASE
    WHEN "status" IN ('ISSUED', 'FOLLOW_UP', 'PARTIALLY_PAID', 'PAID', 'FULLY_PAID', 'COMPLETED')
      THEN 'SUBMITTED_TO_SLT'
    ELSE "submissionStatus"
  END,
  "paymentStatus" = CASE
    WHEN "totalAmount" > 0 AND "paidAmount" >= "totalAmount" THEN 'PAID'
    WHEN "paidAmount" > 0 THEN 'PARTIALLY_PAID'
    WHEN "status" IN ('ISSUED', 'FOLLOW_UP') THEN 'PENDING'
    ELSE "paymentStatus"
  END,
  "submittedAt" = CASE
    WHEN "status" IN ('ISSUED', 'FOLLOW_UP', 'PARTIALLY_PAID', 'PAID', 'FULLY_PAID', 'COMPLETED')
      AND "submittedAt" IS NULL THEN "createdAt"
    ELSE "submittedAt"
  END
WHERE "submissionStatus" = 'NOT_SUBMITTED' OR "paymentStatus" = 'NOT_DUE';

CREATE INDEX IF NOT EXISTS "ProjectInvoice_submissionStatus_paymentStatus_idx"
  ON "ProjectInvoice" ("submissionStatus", "paymentStatus");
CREATE INDEX IF NOT EXISTS "ProjectInvoice_projectId_paymentStatus_idx"
  ON "ProjectInvoice" ("projectId", "paymentStatus");
