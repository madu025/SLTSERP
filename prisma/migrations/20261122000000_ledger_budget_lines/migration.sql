-- Monthly GL-account budgets (company-wide or per OPMC) for budget-vs-actual reporting.
CREATE TABLE IF NOT EXISTS "LedgerBudgetLine" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "fiscalYear" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL,
    "opmcId" UUID,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LedgerBudgetLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LedgerBudgetLine_fiscalYear_month_accountCode_opmcId_key" ON "LedgerBudgetLine"("fiscalYear", "month", "accountCode", "opmcId");
CREATE INDEX IF NOT EXISTS "LedgerBudgetLine_fiscalYear_accountCode_idx" ON "LedgerBudgetLine"("fiscalYear", "accountCode");
CREATE INDEX IF NOT EXISTS "LedgerBudgetLine_opmcId_idx" ON "LedgerBudgetLine"("opmcId");
