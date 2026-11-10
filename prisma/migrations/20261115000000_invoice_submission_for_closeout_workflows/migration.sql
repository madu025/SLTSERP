-- Workflows whose last stage is "Invoice Follow-up & Project Closure" (CCTV, PABX, Data Center, Network, Building
-- Network, OPMC SSD, Related Telecom) had no stage for submitting the invoice. Add INVOICE_SUBMISSION, copied from the
-- Building Fiber template (tasks, checklist, approval levels), directly in front of the last stage.
-- Idempotent: a template that already has an INVOICE_SUBMISSION stage is left alone.

DO $$
DECLARE
  src uuid;
  src_stage record;
  tpl record;
  last_seq int;
  new_stage uuid;
BEGIN
  SELECT "id" INTO src FROM "WorkflowTemplate" WHERE "name" = 'Building Fiber Workflow' LIMIT 1;
  IF src IS NULL THEN
    RAISE NOTICE 'Building Fiber Workflow not found; nothing to copy';
    RETURN;
  END IF;
  SELECT * INTO src_stage FROM "WorkflowStageTemplate" WHERE "workflowTemplateId" = src AND "code" = 'INVOICE_SUBMISSION' LIMIT 1;
  IF src_stage."id" IS NULL THEN
    RAISE NOTICE 'Source INVOICE_SUBMISSION stage not found; nothing to copy';
    RETURN;
  END IF;

  FOR tpl IN
    SELECT wt."id" FROM "WorkflowTemplate" wt
    WHERE wt."isActive" = true AND wt."projectTypeId" IS NOT NULL AND wt."id" <> src
      AND NOT EXISTS (SELECT 1 FROM "WorkflowStageTemplate" s WHERE s."workflowTemplateId" = wt."id" AND s."code" = 'INVOICE_SUBMISSION')
      AND EXISTS (SELECT 1 FROM "WorkflowStageTemplate" s WHERE s."workflowTemplateId" = wt."id")
  LOOP
    SELECT MAX(s."sequence") INTO last_seq FROM "WorkflowStageTemplate" s WHERE s."workflowTemplateId" = tpl."id";
    -- (template, sequence) is unique: move the last stage out of the way, insert, then settle it one place later
    UPDATE "WorkflowStageTemplate" SET "sequence" = "sequence" + 1000 WHERE "workflowTemplateId" = tpl."id" AND "sequence" = last_seq;

    INSERT INTO "WorkflowStageTemplate" ("code", "name", "description", "sequence", "workstream", "assignmentRole", "assignmentTeamKey",
      "workflowTemplateId", "reqApproval", "reqChecklist", "reqPhotos", "reqMaterials", "reqDocuments", "reqOTDR", "reqGPS", "updatedAt")
    VALUES (src_stage."code", src_stage."name", src_stage."description", last_seq, src_stage."workstream", src_stage."assignmentRole", src_stage."assignmentTeamKey",
      tpl."id", src_stage."reqApproval", src_stage."reqChecklist", src_stage."reqPhotos", src_stage."reqMaterials", src_stage."reqDocuments", src_stage."reqOTDR", src_stage."reqGPS", now())
    RETURNING "id" INTO new_stage;

    UPDATE "WorkflowStageTemplate" SET "sequence" = last_seq + 1 WHERE "workflowTemplateId" = tpl."id" AND "sequence" = last_seq + 1000;

    INSERT INTO "WorkflowTaskTemplate" ("code", "name", "description", "priority", "taskType", "assignmentRole", "assignmentTeamKey",
      "isRequired", "autoProgressWeight", "dependsOnCode", "defaultDurationDays", "isSupervisorSelectable", "executionType", "stageTemplateId")
    SELECT k."code", k."name", k."description", k."priority", k."taskType", k."assignmentRole", k."assignmentTeamKey",
      k."isRequired", k."autoProgressWeight", k."dependsOnCode", k."defaultDurationDays", k."isSupervisorSelectable", k."executionType", new_stage
    FROM "WorkflowTaskTemplate" k WHERE k."stageTemplateId" = src_stage."id";

    INSERT INTO "WorkflowChecklistTemplate" ("label", "isMandatory", "reqPhoto", "stageTemplateId")
    SELECT c."label", c."isMandatory", c."reqPhoto", new_stage FROM "WorkflowChecklistTemplate" c WHERE c."stageTemplateId" = src_stage."id";

    INSERT INTO "WorkflowApprovalTemplate" ("level", "role", "requiredPermission", "eligibleRoles", "stageTemplateId")
    SELECT a."level", a."role", a."requiredPermission", a."eligibleRoles", new_stage FROM "WorkflowApprovalTemplate" a WHERE a."stageTemplateId" = src_stage."id";
  END LOOP;
END $$;
