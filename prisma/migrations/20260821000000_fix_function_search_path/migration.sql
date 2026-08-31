-- Migration: Fix Function Search Path Mutable (Supabase Security Warning)
-- Adds SET search_path = '' to all 50 public fn_* functions
-- Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Functions with no parameters
ALTER FUNCTION public.fn_auto_ledger_checksum() SET search_path = '';
ALTER FUNCTION public.fn_calc_cycle_variance() SET search_path = '';
ALTER FUNCTION public.fn_calc_stock_value() SET search_path = '';
ALTER FUNCTION public.fn_calc_variance_adjustment() SET search_path = '';
ALTER FUNCTION public.fn_calculate_rop_all_items() SET search_path = '';
ALTER FUNCTION public.fn_fiscal_period_lock_guard() SET search_path = '';
ALTER FUNCTION public.fn_journal_balance_check() SET search_path = '';
ALTER FUNCTION public.fn_notify_low_stock() SET search_path = '';
ALTER FUNCTION public.fn_pre_erp_auto_calc() SET search_path = '';
ALTER FUNCTION public.fn_prevent_negative_stock() SET search_path = '';
ALTER FUNCTION public.fn_stage_status_cascade() SET search_path = '';
ALTER FUNCTION public.fn_update_rop_levels() SET search_path = '';
ALTER FUNCTION public.fn_validate_wastage_limit() SET search_path = '';
ALTER FUNCTION public.fn_asset_register_summary() SET search_path = '';
ALTER FUNCTION public.fn_audit_log_immutable() SET search_path = '';

-- Functions with parameters (parameter types only, no DEFAULT values)
ALTER FUNCTION public.fn_next_document_number(text) SET search_path = '';
ALTER FUNCTION public.fn_low_stock_alerts(uuid) SET search_path = '';
ALTER FUNCTION public.fn_fifo_pick_contractor_batches(uuid, uuid, numeric) SET search_path = '';
ALTER FUNCTION public.fn_sod_total_material_cost(uuid) SET search_path = '';
ALTER FUNCTION public.fn_determine_next_stage(uuid) SET search_path = '';
ALTER FUNCTION public.fn_store_material_balance(uuid, text) SET search_path = '';
ALTER FUNCTION public.fn_bulk_serial_status_update(text[], text, uuid, uuid) SET search_path = '';
ALTER FUNCTION public.fn_bulk_stock_initialize(uuid, uuid[], numeric[]) SET search_path = '';
ALTER FUNCTION public.fn_store_inventory_value(uuid) SET search_path = '';
ALTER FUNCTION public.fn_store_dashboard_summary(uuid) SET search_path = '';
ALTER FUNCTION public.fn_bulk_boq_actual_update(uuid, uuid[], numeric[]) SET search_path = '';
ALTER FUNCTION public.fn_contractor_stock_summary(uuid) SET search_path = '';
ALTER FUNCTION public.fn_bulk_stock_issue(uuid, uuid[], numeric[], uuid, text, text, uuid, text[]) SET search_path = '';
ALTER FUNCTION public.fn_wastage_approval_check(uuid, uuid, text, uuid[], numeric[]) SET search_path = '';
ALTER FUNCTION public.fn_validate_journal_entry(jsonb) SET search_path = '';
ALTER FUNCTION public.fn_sod_material_usage_summary(uuid) SET search_path = '';
ALTER FUNCTION public.fn_resolve_coa_accounts(text[]) SET search_path = '';
ALTER FUNCTION public.fn_cash_book_report(text, timestamp without time zone, timestamp without time zone) SET search_path = '';
ALTER FUNCTION public.fn_update_stock_request_status(uuid) SET search_path = '';
ALTER FUNCTION public.fn_project_progress_calculate(uuid) SET search_path = '';
ALTER FUNCTION public.fn_verify_ledger_integrity(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.fn_expiring_batches(uuid, integer) SET search_path = '';
ALTER FUNCTION public.fn_bulk_pat_status_sync(text[], text[], timestamp with time zone[]) SET search_path = '';
ALTER FUNCTION public.fn_vehicle_location_update(uuid, numeric, numeric, numeric, numeric, integer) SET search_path = '';
ALTER FUNCTION public.fn_multi_store_expiring_batches(uuid[], integer) SET search_path = '';
ALTER FUNCTION public.fn_stock_movement_report(uuid, date, date) SET search_path = '';
ALTER FUNCTION public.fn_bulk_gis_snap_update(uuid[], numeric[], numeric[], uuid[], numeric[], numeric[]) SET search_path = '';
ALTER FUNCTION public.fn_contractor_balance_sheet(uuid, uuid, text, integer) SET search_path = '';
ALTER FUNCTION public.fn_fifo_pick_store_batches(uuid, uuid, numeric) SET search_path = '';
ALTER FUNCTION public.fn_sod_dashboard_summary(uuid, integer, integer) SET search_path = '';
ALTER FUNCTION public.fn_contractor_performance_metrics(uuid, date, date) SET search_path = '';
ALTER FUNCTION public.fn_trial_balance(timestamp without time zone, timestamp without time zone) SET search_path = '';
ALTER FUNCTION public.fn_vehicle_utilization_summary(uuid, timestamp without time zone, timestamp without time zone) SET search_path = '';
ALTER FUNCTION public.fn_expiring_batch_alerts(uuid, integer) SET search_path = '';
ALTER FUNCTION public.fn_multi_store_material_balance(uuid[], text) SET search_path = '';
