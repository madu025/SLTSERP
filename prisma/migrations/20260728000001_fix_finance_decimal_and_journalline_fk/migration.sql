-- AlterTable Invoice monetary columns to DECIMAL(12,4)
ALTER TABLE "Invoice" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,4) USING "totalAmount"::DECIMAL(12,4);
ALTER TABLE "Invoice" ALTER COLUMN "totalAmount" SET DEFAULT 0;

ALTER TABLE "Invoice" ALTER COLUMN "amountA" SET DATA TYPE DECIMAL(12,4) USING "amountA"::DECIMAL(12,4);
ALTER TABLE "Invoice" ALTER COLUMN "amountA" SET DEFAULT 0;

ALTER TABLE "Invoice" ALTER COLUMN "amountB" SET DATA TYPE DECIMAL(12,4) USING "amountB"::DECIMAL(12,4);
ALTER TABLE "Invoice" ALTER COLUMN "amountB" SET DEFAULT 0;

ALTER TABLE "Invoice" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,4) USING "amount"::DECIMAL(12,4);

ALTER TABLE "Invoice" ALTER COLUMN "retentionAmount" SET DATA TYPE DECIMAL(12,4) USING "retentionAmount"::DECIMAL(12,4);
ALTER TABLE "Invoice" ALTER COLUMN "retentionAmount" SET DEFAULT 0;

ALTER TABLE "Invoice" ALTER COLUMN "advanceDeduction" SET DATA TYPE DECIMAL(12,4) USING "advanceDeduction"::DECIMAL(12,4);
ALTER TABLE "Invoice" ALTER COLUMN "advanceDeduction" SET DEFAULT 0;

ALTER TABLE "Invoice" ALTER COLUMN "vatAmount" SET DATA TYPE DECIMAL(12,4) USING "vatAmount"::DECIMAL(12,4);
ALTER TABLE "Invoice" ALTER COLUMN "vatAmount" SET DEFAULT 0;

ALTER TABLE "Invoice" ALTER COLUMN "ssclAmount" SET DATA TYPE DECIMAL(12,4) USING "ssclAmount"::DECIMAL(12,4);
ALTER TABLE "Invoice" ALTER COLUMN "ssclAmount" SET DEFAULT 0;

ALTER TABLE "Invoice" ALTER COLUMN "whtAmount" SET DATA TYPE DECIMAL(12,4) USING "whtAmount"::DECIMAL(12,4);
ALTER TABLE "Invoice" ALTER COLUMN "whtAmount" SET DEFAULT 0;

-- AlterTable InvoiceAmendmentRequest monetary columns to DECIMAL(12,4)
ALTER TABLE "InvoiceAmendmentRequest" ALTER COLUMN "originalAmount" SET DATA TYPE DECIMAL(12,4) USING "originalAmount"::DECIMAL(12,4);
ALTER TABLE "InvoiceAmendmentRequest" ALTER COLUMN "requestedAmount" SET DATA TYPE DECIMAL(12,4) USING "requestedAmount"::DECIMAL(12,4);
ALTER TABLE "InvoiceAmendmentRequest" ALTER COLUMN "originalAmountA" SET DATA TYPE DECIMAL(12,4) USING "originalAmountA"::DECIMAL(12,4);
ALTER TABLE "InvoiceAmendmentRequest" ALTER COLUMN "requestedAmountA" SET DATA TYPE DECIMAL(12,4) USING "requestedAmountA"::DECIMAL(12,4);
ALTER TABLE "InvoiceAmendmentRequest" ALTER COLUMN "originalAmountB" SET DATA TYPE DECIMAL(12,4) USING "originalAmountB"::DECIMAL(12,4);
ALTER TABLE "InvoiceAmendmentRequest" ALTER COLUMN "requestedAmountB" SET DATA TYPE DECIMAL(12,4) USING "requestedAmountB"::DECIMAL(12,4);

-- AlterTable PaymentVoucher monetary columns to DECIMAL(12,4)
ALTER TABLE "PaymentVoucher" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,4) USING "amount"::DECIMAL(12,4);
ALTER TABLE "PaymentVoucher" ALTER COLUMN "amount" SET DEFAULT 0;

ALTER TABLE "PaymentVoucher" ALTER COLUMN "taxWithheld" SET DATA TYPE DECIMAL(12,4) USING "taxWithheld"::DECIMAL(12,4);
ALTER TABLE "PaymentVoucher" ALTER COLUMN "taxWithheld" SET DEFAULT 0;

ALTER TABLE "PaymentVoucher" ALTER COLUMN "netAmount" SET DATA TYPE DECIMAL(12,4) USING "netAmount"::DECIMAL(12,4);
ALTER TABLE "PaymentVoucher" ALTER COLUMN "netAmount" SET DEFAULT 0;

ALTER TABLE "PaymentVoucher" ALTER COLUMN "retentionAmount" SET DATA TYPE DECIMAL(12,4) USING "retentionAmount"::DECIMAL(12,4);
ALTER TABLE "PaymentVoucher" ALTER COLUMN "retentionAmount" SET DEFAULT 0;

-- AlterTable Penalty amount column to DECIMAL(12,4)
ALTER TABLE "Penalty" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,4) USING "amount"::DECIMAL(12,4);
ALTER TABLE "Penalty" ALTER COLUMN "amount" SET DEFAULT 0;

-- AddForeignKey JournalLine accountCode to ChartOfAccount code
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountCode_fkey" FOREIGN KEY ("accountCode") REFERENCES "ChartOfAccount"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
