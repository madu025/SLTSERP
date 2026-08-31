-- Phase 2 status simplification: prune unused ServiceOrderStatus enum values.
-- Removed (zero rows verified across ServiceOrder.status, ServiceOrder.sltsStatus,
-- ServiceOrderStatusHistory.status): RETURNED, CANCELLED, CLOSED, PASSED, ASSIGNED,
-- ASSIGN, OFFLINE, RETURN_PENDING, OPMC_PAT_SKIP.
-- Postgres cannot DROP enum values, so the type is recreated with the kept set.
-- The USING casts double as a safety net: they fail loudly if any removed value
-- appears in data.
--
-- The status-column triggers pin the column types via their definitions
-- (trg_sod_status_audit / trg_sod_status_validate), so they are dropped for the
-- swap and recreated at the end.

DROP TRIGGER IF EXISTS trg_sod_status_audit ON "ServiceOrder";
DROP TRIGGER IF EXISTS trg_sod_status_validate ON "ServiceOrder";
-- Partial index predicates cast to the old enum type; rebuilt after the swap.
DROP INDEX IF EXISTS idx_service_order_contractor_completed;

CREATE TYPE "ServiceOrderStatus_new" AS ENUM (
  'PENDING',
  'INPROGRESS',
  'COMPLETED',
  'RETURN',
  'DISAPPEARED',
  'INSTALL_CLOSED',
  'PROV_CLOSED',
  'PAT_OPMC_PASSED',
  'PAT_OPMC_REJECTED',
  'PAT_CORRECTED',
  'PAT_REJECTED'
);

ALTER TABLE "ServiceOrder" ALTER COLUMN "sltsStatus" DROP DEFAULT;
ALTER TABLE "ServiceOrder" ALTER COLUMN "status" TYPE "ServiceOrderStatus_new" USING "status"::text::"ServiceOrderStatus_new";
ALTER TABLE "ServiceOrder" ALTER COLUMN "sltsStatus" TYPE "ServiceOrderStatus_new" USING "sltsStatus"::text::"ServiceOrderStatus_new";
ALTER TABLE "ServiceOrderStatusHistory" ALTER COLUMN "status" TYPE "ServiceOrderStatus_new" USING "status"::text::"ServiceOrderStatus_new";
ALTER TABLE "ServiceOrder" ALTER COLUMN "sltsStatus" SET DEFAULT 'INPROGRESS';

DROP TYPE "ServiceOrderStatus";
ALTER TYPE "ServiceOrderStatus_new" RENAME TO "ServiceOrderStatus";

CREATE INDEX idx_service_order_contractor_completed ON "ServiceOrder" ("contractorId", "sltsStatus") WHERE "sltsStatus" = 'COMPLETED';

-- Invariant trigger, re-aligned with the pruned workflow domain
-- (ASSIGNED / ASSIGN / OFFLINE can no longer be written at the enum level).
CREATE OR REPLACE FUNCTION fn_validate_sod_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW."sltsStatus" IN ('INSTALL_CLOSED', 'COMPLETED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED')
     AND NEW."status" IN ('PENDING', 'INPROGRESS', 'PROV_CLOSED') THEN
    RAISE EXCEPTION 'SOD_STATUS_INVARIANT_VIOLATION: soNum=% cannot write status=% while sltsStatus=% (terminal portal status requires terminal workflow status)',
      NEW."soNum", NEW."status", NEW."sltsStatus";
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_sod_status_validate
BEFORE UPDATE ON "ServiceOrder"
FOR EACH ROW
EXECUTE FUNCTION fn_validate_sod_status_transition();

-- Audit trigger: unchanged definition, recreated after the type swap.
CREATE OR REPLACE FUNCTION fn_audit_sod_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO "AuditLog" ("userId", "action", "entity", "entityId", "oldValue", "newValue", "ipAddress", "createdAt")
  VALUES (
    NULL,
    'DB_STATUS_CHANGE',
    'ServiceOrder',
    NEW."soNum",
    jsonb_build_object('status', OLD.status, 'sltsStatus', OLD."sltsStatus"),
    jsonb_build_object(
      'status', NEW.status,
      'sltsStatus', NEW."sltsStatus",
      'query', current_query(),
      'applicationName', current_setting('application_name', true)
    ),
    CASE WHEN inet_client_addr() IS NULL THEN NULL ELSE inet_client_addr()::text END,
    now()
  );
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_sod_status_audit
AFTER UPDATE ON "ServiceOrder"
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION fn_audit_sod_status_change();
