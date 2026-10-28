ALTER TABLE "StockIssue" ADD COLUMN IF NOT EXISTS "requirementId" UUID;

CREATE INDEX IF NOT EXISTS "StockIssue_requirementId_idx"
  ON "StockIssue"("requirementId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockIssue_requirementId_fkey'
  ) THEN
    ALTER TABLE "StockIssue"
      ADD CONSTRAINT "StockIssue_requirementId_fkey"
      FOREIGN KEY ("requirementId") REFERENCES "ProjectMaterialRequirement"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
