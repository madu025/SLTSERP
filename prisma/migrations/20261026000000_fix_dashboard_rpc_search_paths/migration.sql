-- Dashboard and audit RPCs were hardened with an empty search_path, but their
-- bodies reference quoted public tables without schema qualification. Restore
-- the explicit public resolution needed by these functions.
ALTER FUNCTION public.fn_verify_ledger_integrity(uuid, uuid)
    SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_contractor_stock_summary(uuid)
    SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_contractor_balance_sheet(uuid, uuid, text, integer)
    SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_store_dashboard_summary(uuid)
    SET search_path = public, pg_temp;
