-- Stage owners for the templates that were created without any (SSD and Cluster Development, and the
-- GIS-generated templates). A stage with no owner role notifies nobody and appears in nobody's queue.
-- Mapping mirrors defaultStageRole() in src/lib/gis/workflow-definitions.ts. Only NULL/blank roles are filled,
-- so an owner an administrator has already chosen is never overwritten.
CREATE OR REPLACE FUNCTION pg_temp.default_stage_role(stage_name text) RETURNS text AS $$
  SELECT CASE
    WHEN lower(stage_name) ~ '(otdr|test|\mqa\M|commission)' THEN 'QC_OFFICER'
    WHEN lower(stage_name) ~ 'survey' THEN 'OSP_ENGINEER'
    WHEN lower(stage_name) ~ '(permit|access)' THEN 'AREA_MANAGER'
    WHEN lower(stage_name) ~ '(material|procure)' THEN 'STORES_MANAGER'
    WHEN lower(stage_name) ~ '(install|civil|splic|cabling)' THEN 'CONTRACTOR_SUPERVISOR'
    WHEN lower(stage_name) ~ '(closure|handover)' THEN 'OSP_MANAGER'
    WHEN lower(stage_name) ~ '(feasib|engineering|design)' THEN 'ENGINEER'
    ELSE NULL
  END
$$ LANGUAGE sql IMMUTABLE;

UPDATE "WorkflowStageTemplate"
SET "assignmentRole" = pg_temp.default_stage_role("name")
WHERE NULLIF(BTRIM("assignmentRole"), '') IS NULL
  AND pg_temp.default_stage_role("name") IS NOT NULL;

-- Projects already running on those templates: stages that have not been assigned to a named person.
UPDATE "ProjectStageInstance"
SET "assignedRole" = pg_temp.default_stage_role("name")
WHERE NULLIF(BTRIM("assignedRole"), '') IS NULL
  AND "assignedUserId" IS NULL
  AND "status" IN ('PENDING', 'IN_PROGRESS')
  AND pg_temp.default_stage_role("name") IS NOT NULL;

-- In-house PAT must carry OTDR evidence (the production template only checked "PAT passed"). Not-yet-completed
-- stages of running projects pick the requirement up too; completed stages are left as they were.
UPDATE "WorkflowStageTemplate"
SET "reqOTDR" = true
WHERE "code" = 'INHOUSE_PAT' AND "reqOTDR" = false;

UPDATE "ProjectStageInstance"
SET "reqOTDR" = true
WHERE "code" = 'INHOUSE_PAT' AND "reqOTDR" = false AND "status" IN ('PENDING', 'IN_PROGRESS');
