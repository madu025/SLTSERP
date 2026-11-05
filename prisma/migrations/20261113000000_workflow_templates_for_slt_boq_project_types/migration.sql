-- Customer request, rehabilitation/shifting and marketing projects could not be created: their project types
-- (added with the SLT BOQ work) had no workflow template, and a project needs one. They get the Building Fiber
-- stage set without the design / CAD stages (these works are small and have no CAD design phase):
--   Requirements, Survey, BOQ preparation, BOQ approval, contractor allocation, permit/access, implementation,
--   in-house PAT, SLT PAT, as-built, invoice submission, invoice follow-up, invoice completed & closure.
-- Stage tasks, checklists and approval levels are copied from the Building Fiber template, so approvals keep the
-- same permissions. Idempotent: a type that already has a template is left alone.

DO $$
DECLARE
  src uuid;
  rec record;
  new_tpl uuid;
BEGIN
  SELECT "id" INTO src FROM "WorkflowTemplate" WHERE "name" = 'Building Fiber Workflow' LIMIT 1;
  IF src IS NULL THEN
    RAISE NOTICE 'Building Fiber Workflow not found; nothing to clone';
    RETURN;
  END IF;

  FOR rec IN
    SELECT pt."id" AS type_id, v.tpl_name, v.tpl_desc
    FROM (VALUES
      ('CUSTOMER_REQUEST', 'Customer Request Workflow', 'Customer request works (BOQ, implementation, PAT, invoicing)'),
      ('REHABILITATION_SHIFTING', 'Rehabilitation and Shifting Workflow', 'Rehabilitation, shifting and relocation works'),
      ('MARKETING', 'Marketing Workflow', 'Marketing customer fibre connections')
    ) AS v(type_name, tpl_name, tpl_desc)
    JOIN "ProjectType" pt ON pt."name" = v.type_name
    WHERE NOT EXISTS (SELECT 1 FROM "WorkflowTemplate" wt WHERE wt."projectTypeId" = pt."id")
  LOOP
    INSERT INTO "WorkflowTemplate" ("name", "description", "projectTypeId", "isActive", "updatedAt")
    VALUES (rec.tpl_name, rec.tpl_desc, rec.type_id, true, now())
    RETURNING "id" INTO new_tpl;

    INSERT INTO "WorkflowStageTemplate" ("code", "name", "description", "sequence", "workstream", "assignmentRole", "assignmentTeamKey",
      "workflowTemplateId", "reqApproval", "reqChecklist", "reqPhotos", "reqMaterials", "reqDocuments", "reqOTDR", "reqGPS", "updatedAt")
    SELECT s."code", s."name", s."description", (row_number() OVER (ORDER BY s."sequence"))::int, s."workstream", s."assignmentRole", s."assignmentTeamKey",
      new_tpl, s."reqApproval", s."reqChecklist", s."reqPhotos", s."reqMaterials", s."reqDocuments", s."reqOTDR", s."reqGPS", now()
    FROM "WorkflowStageTemplate" s
    WHERE s."workflowTemplateId" = src
      AND s."code" NOT IN ('DESIGN_PLAN', 'DESIGN_REVIEW', 'CAD_DRAWING', 'CAD_REVIEW')
    ORDER BY s."sequence";

    INSERT INTO "WorkflowTaskTemplate" ("code", "name", "description", "priority", "taskType", "assignmentRole", "assignmentTeamKey",
      "isRequired", "autoProgressWeight", "dependsOnCode", "defaultDurationDays", "isSupervisorSelectable", "executionType", "stageTemplateId")
    SELECT k."code", k."name", k."description", k."priority", k."taskType", k."assignmentRole", k."assignmentTeamKey",
      k."isRequired", k."autoProgressWeight", k."dependsOnCode", k."defaultDurationDays", k."isSupervisorSelectable", k."executionType", ns."id"
    FROM "WorkflowTaskTemplate" k
    JOIN "WorkflowStageTemplate" os ON os."id" = k."stageTemplateId" AND os."workflowTemplateId" = src
    JOIN "WorkflowStageTemplate" ns ON ns."workflowTemplateId" = new_tpl AND ns."code" = os."code";

    INSERT INTO "WorkflowChecklistTemplate" ("label", "isMandatory", "reqPhoto", "stageTemplateId")
    SELECT c."label", c."isMandatory", c."reqPhoto", ns."id"
    FROM "WorkflowChecklistTemplate" c
    JOIN "WorkflowStageTemplate" os ON os."id" = c."stageTemplateId" AND os."workflowTemplateId" = src
    JOIN "WorkflowStageTemplate" ns ON ns."workflowTemplateId" = new_tpl AND ns."code" = os."code";

    INSERT INTO "WorkflowApprovalTemplate" ("level", "role", "requiredPermission", "eligibleRoles", "stageTemplateId")
    SELECT a."level", a."role", a."requiredPermission", a."eligibleRoles", ns."id"
    FROM "WorkflowApprovalTemplate" a
    JOIN "WorkflowStageTemplate" os ON os."id" = a."stageTemplateId" AND os."workflowTemplateId" = src
    JOIN "WorkflowStageTemplate" ns ON ns."workflowTemplateId" = new_tpl AND ns."code" = os."code";
  END LOOP;
END $$;
