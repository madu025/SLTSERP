-- Keep the immutable audit trigger function on an explicit, trusted search path.
-- Its body uses only PostgreSQL trigger context and current_setting, but an
-- explicit path prevents future unqualified additions from reintroducing the
-- mutable-search-path security finding.
ALTER FUNCTION public.fn_inventory_ledger_immutable()
    SET search_path = pg_catalog, public;
