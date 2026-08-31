const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const FN_SQL = `
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
`;

const TRIGGER_DROP_SQL = `DROP TRIGGER IF EXISTS trg_sod_status_audit ON "ServiceOrder";`;

const TRIGGER_CREATE_SQL = `
CREATE TRIGGER trg_sod_status_audit
AFTER UPDATE ON "ServiceOrder"
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION fn_audit_sod_status_change();
`;

async function main() {
    await p.$executeRawUnsafe(FN_SQL);
    console.log('Function created: fn_audit_sod_status_change()');
    await p.$executeRawUnsafe(TRIGGER_DROP_SQL);
    await p.$executeRawUnsafe(TRIGGER_CREATE_SQL);
    console.log('Trigger created: trg_sod_status_audit on ServiceOrder (fires only on status value change)');
}

main().catch(console.error).finally(() => p.$disconnect());
