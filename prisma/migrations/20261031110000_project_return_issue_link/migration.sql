-- Historical returns remain unlinked for review; every new return must supply
-- an approved source issue through the application workflow.
ALTER TABLE "ProjectMaterialReturn" ADD COLUMN "issueId" UUID;

CREATE INDEX "ProjectMaterialReturn_issueId_status_idx"
  ON "ProjectMaterialReturn"("issueId", "status");

ALTER TABLE "ProjectMaterialReturn"
  ADD CONSTRAINT "ProjectMaterialReturn_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "StockIssue"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
