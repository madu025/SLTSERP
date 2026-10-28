-- fn_stage_status_cascade() calls this helper. It also references the public
-- workflow tables with unqualified names, so it cannot run with an empty path.
ALTER FUNCTION public.fn_project_progress_calculate(uuid) SET search_path = public;
