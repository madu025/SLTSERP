-- Every project type must be able to take a project through invoicing. The SSD and Cluster/Apartment workflows stop at
-- handover/closure with no invoice stages. Add Invoice Submission and Invoice Follow-up (and, when the workflow has no
-- closure stage, Invoice Completed & Closure) copied from the Building Fiber template, so stage tasks, checklists and
-- approval levels stay identical. Where a closure stage exists the invoice stages are inserted in front of it.
-- Idempotent: a template that already has an INVOICE_SUBMISSION stage is left alone. Running projects keep the
-- snapshot of the template they were created from.

DO $$
DECLARE
  src uuid;
  tpl record;
  closure_id uuid;
  closure_seq int;
  base_seq int;
  add_closure boolean;
  rec record;
  new_stage uuid;
  i int;
BEGIN
  SELECT "id" INTO src FROM "WorkflowTemplate" WHERE "name" = 'Building Fiber Workflow' LIMIT 1;
  IF src IS NULL THEN
    RAISE NOTICE 'Building Fiber Workflow not found; nothing to copy';
    RETURN;
  END IF;

  FOR tpl IN
    SELECT wt."id" FROM "WorkflowTemplate" wt
    WHERE wt."isActive" = true AND wt."projectTypeId" IS NOT NULL AND wt."id" <> src
      AND NOT EXISTS (SELECT 1 FROM "WorkflowStageTemplate" s WHERE s."workflowTemplateId" = wt."id" AND (s."code" LIKE 'INVOICE%' OR s."name" ILIKE '%invoice%'))
  LOOP
    SELECT s."id", s."sequence" INTO closure_id, closure_seq
    FROM "WorkflowStageTemplate" s
    WHERE s."workflowTemplateId" = tpl."id" AND (s."code" = 'PROJECT_CLOSURE' OR s."name" ILIKE '%closure%')
    ORDER BY s."sequence" DESC LIMIT 1;

    IF closure_id IS NOT NULL THEN
      base_seq := closure_seq;
      add_closure := false;
      -- make room for two stages; the (template, sequence) pair is unique, so move the tail out of the way first
      UPDATE "WorkflowStageTemplate" SET "sequence" = "sequence" + 1000 WHERE "workflowTemplateId" = tpl."id" AND "sequence" >= closure_seq;
      UPDATE "WorkflowStageTemplate" SET "sequence" = "sequence" - 998 WHERE "workflowTemplateId" = tpl."id" AND "sequence" >= closure_seq + 1000;
    ELSE
      SELECT COALESCE(MAX(s."sequence"), 0) + 1 INTO base_seq FROM "WorkflowStageTemplate" s WHERE s."workflowTemplateId" = tpl."id";
      add_closure := true;
    END IF;

    i := 0;
    FOR rec IN
      SELECT * FROM "WorkflowStageTemplate" s
      WHERE s."workflowTemplateId" = src
        AND (s."code" IN ('INVOICE_SUBMISSION', 'INVOICE_FOLLOW_UP') OR (add_closure AND s."code" = 'PROJECT_CLOSURE'))
        AND NOT EXISTS (SELECT 1 FROM "WorkflowStageTemplate" x WHERE x."workflowTemplateId" = tpl."id" AND x."code" = s."code")
      ORDER BY s."sequence"
    LOOP
      INSERT INTO "WorkflowStageTemplate" ("code", "name", "description", "sequence", "workstream", "assignmentRole", "assignmentTeamKey",
        "workflowTemplateId", "reqApproval", "reqChecklist", "reqPhotos", "reqMaterials", "reqDocuments", "reqOTDR", "reqGPS", "updatedAt")
      VALUES (rec."code", rec."name", rec."description", base_seq + i, rec."workstream", rec."assignmentRole", rec."assignmentTeamKey",
        tpl."id", rec."reqApproval", rec."reqChecklist", rec."reqPhotos", rec."reqMaterials", rec."reqDocuments", rec."reqOTDR", rec."reqGPS", now())
      RETURNING "id" INTO new_stage;
      i := i + 1;

      INSERT INTO "WorkflowTaskTemplate" ("code", "name", "description", "priority", "taskType", "assignmentRole", "assignmentTeamKey",
        "isRequired", "autoProgressWeight", "dependsOnCode", "defaultDurationDays", "isSupervisorSelectable", "executionType", "stageTemplateId")
      SELECT k."code", k."name", k."description", k."priority", k."taskType", k."assignmentRole", k."assignmentTeamKey",
        k."isRequired", k."autoProgressWeight", k."dependsOnCode", k."defaultDurationDays", k."isSupervisorSelectable", k."executionType", new_stage
      FROM "WorkflowTaskTemplate" k WHERE k."stageTemplateId" = rec."id";

      INSERT INTO "WorkflowChecklistTemplate" ("label", "isMandatory", "reqPhoto", "stageTemplateId")
      SELECT c."label", c."isMandatory", c."reqPhoto", new_stage FROM "WorkflowChecklistTemplate" c WHERE c."stageTemplateId" = rec."id";

      INSERT INTO "WorkflowApprovalTemplate" ("level", "role", "requiredPermission", "eligibleRoles", "stageTemplateId")
      SELECT a."level", a."role", a."requiredPermission", a."eligibleRoles", new_stage FROM "WorkflowApprovalTemplate" a WHERE a."stageTemplateId" = rec."id";
    END LOOP;
  END LOOP;
END $$;
