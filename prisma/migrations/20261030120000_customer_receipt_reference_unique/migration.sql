-- Preserve existing receipt history. Duplicate invoice references must be reconciled
-- before this migration can apply; PostgreSQL will reject the unique index.
CREATE UNIQUE INDEX "CustomerReceipt_invoiceId_referenceNumber_key"
  ON "CustomerReceipt"("invoiceId", "referenceNumber");
