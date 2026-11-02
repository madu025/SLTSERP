-- The inventory expiring-batch functions intentionally use the public schema
-- tables but were hardened with an empty search_path by the generic function
-- security migration. Restore an explicit, trusted search path so their
-- unqualified table references resolve without relying on the session path.
ALTER FUNCTION public.fn_expiring_batches(uuid, integer)
    SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_multi_store_expiring_batches(uuid[], integer)
    SET search_path = public, pg_temp;
