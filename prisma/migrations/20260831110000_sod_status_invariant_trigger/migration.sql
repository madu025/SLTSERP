-- SOD status invariant: portal-terminal sltsStatus can never sit on top of a
-- still-active workflow status. Root cause class of the "install-closed shows
-- PENDING" bug (497+ rows historically). Writes carrying an incoherent pair
-- are rejected with SOD_STATUS_INVARIANT_VIOLATION.

CREATE OR REPLACE FUNCTION fn_validate_sod_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW."sltsStatus" IN ('INSTALL_CLOSED', 'COMPLETED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED')
     AND NEW."status" IN ('PENDING', 'ASSIGNED', 'ASSIGN', 'INPROGRESS', 'OFFLINE', 'PROV_CLOSED') THEN
    RAISE EXCEPTION 'SOD_STATUS_INVARIANT_VIOLATION: soNum=% cannot write status=% while sltsStatus=% (terminal portal status requires terminal workflow status)',
      NEW."soNum", NEW."status", NEW."sltsStatus";
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sod_status_validate ON "ServiceOrder";
CREATE TRIGGER trg_sod_status_validate
BEFORE UPDATE ON "ServiceOrder"
FOR EACH ROW
EXECUTE FUNCTION fn_validate_sod_status_transition();
