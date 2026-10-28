-- fn_stage_status_cascade() references public tables and helper functions using
-- unqualified names. The broad search_path hardening migration set this function
-- to an empty search_path, so any stage status change failed with 42P01.
-- Keep the function trusted but restore the schema it is explicitly designed to use.
ALTER FUNCTION public.fn_stage_status_cascade() SET search_path = public;
