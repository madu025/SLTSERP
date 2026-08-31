-- Status attribution audit for ServiceOrder.status changes
-- Fires only when the status VALUE changes (not on every row touch).
-- Captures the actual SQL query + application_name + client address so
-- out-of-band writes (manual SQL, scripts, foreign systems) are attributed.

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

DROP TRIGGER IF EXISTS trg_sod_status_audit ON "ServiceOrder";
CREATE TRIGGER trg_sod_status_audit
AFTER UPDATE ON "ServiceOrder"
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION fn_audit_sod_status_change();
