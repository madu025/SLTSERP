-- Migration: add_boq_source_column
-- Adds the `source` column to ProjectBOQItem to categorize items as
-- NEW (to procure) or EXISTING (available in inventory/stock).
-- Also adds an index on `source` for filtering performance.

ALTER TABLE "ProjectBOQItem" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectBOQItem_source_idx" ON "ProjectBOQItem"("source");