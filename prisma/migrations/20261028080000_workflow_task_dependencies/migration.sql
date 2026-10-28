-- Add dependency metadata to workflow semi-task instances.
ALTER TABLE "ProjectTaskInstance"
  ADD COLUMN IF NOT EXISTS "dependsOnCode" TEXT;
