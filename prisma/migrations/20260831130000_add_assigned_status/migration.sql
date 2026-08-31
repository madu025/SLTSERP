-- Add ASSIGNED back to ServiceOrderStatus enum (Phase 2 rule correction).
-- Portal CON_STATUS=ASSIGN/ASSIGNED represents a real assignment event that must
-- be stored distinctly so the pending table can show "ASSIGNED" SODs as such.

ALTER TYPE "ServiceOrderStatus" ADD VALUE 'ASSIGNED' AFTER 'INPROGRESS';

-- Update the invariant trigger to include ASSIGNED in the stale list: an ASSIGNED
-- workflow status must not coexist with a portal-terminal sltsStatus.
CREATE OR REPLACE FUNCTION fn_validate_sod_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW."sltsStatus" IN ('INSTALL_CLOSED', 'COMPLETED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED')
     AND NEW."status" IN ('PENDING', 'INPROGRESS', 'ASSIGNED', 'PROV_CLOSED') THEN
    RAISE EXCEPTION 'SOD_STATUS_INVARIANT_VIOLATION: soNum=% cannot write status=% while sltsStatus=% (terminal portal status requires terminal workflow status)',
      NEW."soNum", NEW."status", NEW."sltsStatus";
  END IF;
  RETURN NEW;
END;
$fn$;
