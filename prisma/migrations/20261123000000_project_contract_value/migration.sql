-- Client contract price per project, the basis for percentage-of-completion revenue recognition.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contractValue" DECIMAL(14,2);
