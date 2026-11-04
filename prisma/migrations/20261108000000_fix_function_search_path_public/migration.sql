-- 20260821000000_fix_function_search_path set search_path = '' on every fn_* function, but many bodies
-- reference tables unqualified ("ContractorBatchStock", "ServiceOrder", ...) and fail with 42P01
-- (relation does not exist). Contractor FIFO picking, so every SOD material entry, was one of them.
-- Pin those functions to a fixed, non-mutable path that includes public.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND array_to_string(p.proconfig, ',') = 'search_path=""'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;
