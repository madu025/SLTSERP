-- Real, automatic earned-value tracking.
-- ProjectEVM.source tells computed rows (AUTO) from hand-entered ones (MANUAL, never overwritten by the daily job).
ALTER TABLE "ProjectEVM" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'AUTO';

-- One snapshot per project per period label (a day, for the daily job). Collapse any existing duplicates first,
-- keeping the newest row, so the unique index can be created.
DELETE FROM "EVMSnapshot" a
USING "EVMSnapshot" b
WHERE a."evmId" = b."evmId"
  AND a."periodLabel" = b."periodLabel"
  AND (a."createdAt" < b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" < b."id"));

CREATE UNIQUE INDEX IF NOT EXISTS "EVMSnapshot_evmId_periodLabel_key" ON "EVMSnapshot"("evmId", "periodLabel");
