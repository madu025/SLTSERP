const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const FN_SQL = `
CREATE OR REPLACE FUNCTION fn_validate_sod_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  -- Invariant: a portal-terminal sltsStatus can never sit on top of a
  -- still-active workflow status. This is the root cause class of the
  -- "install-closed shows PENDING" bug; the write must carry a coherent pair.
  IF NEW."sltsStatus" IN ('INSTALL_CLOSED', 'COMPLETED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED')
     AND NEW."status" IN ('PENDING', 'INPROGRESS', 'ASSIGNED', 'PROV_CLOSED') THEN
    RAISE EXCEPTION 'SOD_STATUS_INVARIANT_VIOLATION: soNum=% cannot write status=% while sltsStatus=% (terminal portal status requires terminal workflow status)',
      NEW."soNum", NEW."status", NEW."sltsStatus";
  END IF;
  RETURN NEW;
END;
$fn$;
`;

const TRIGGER_DROP_SQL = `DROP TRIGGER IF EXISTS trg_sod_status_validate ON "ServiceOrder";`;

const TRIGGER_CREATE_SQL = `
CREATE TRIGGER trg_sod_status_validate
BEFORE UPDATE ON "ServiceOrder"
FOR EACH ROW
EXECUTE FUNCTION fn_validate_sod_status_transition();
`;

async function main() {
    await p.$executeRawUnsafe(FN_SQL);
    console.log('Function created: fn_validate_sod_status_transition()');
    await p.$executeRawUnsafe(TRIGGER_DROP_SQL);
    await p.$executeRawUnsafe(TRIGGER_CREATE_SQL);
    console.log('Trigger created: trg_sod_status_validate on ServiceOrder (BEFORE UPDATE, rejects incoherent status pairs)');
}

main().catch(console.error).finally(() => p.$disconnect());
