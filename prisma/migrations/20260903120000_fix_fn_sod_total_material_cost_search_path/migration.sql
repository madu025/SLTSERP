-- fn_sod_total_material_cost: migration 20260821_fix_function_search_path set
-- search_path='' (anti-hijack hardening) but the body referenced "SODMaterialUsage"
-- without a schema qualifier, so the relation could never resolve at call time
-- (42P01 relation does not exist) — breaking every SOD completion transition that
-- posts COGS ledger entries. Schema-qualify the table, keep the hardening.
-- Aggregation math unchanged.

CREATE OR REPLACE FUNCTION public.fn_sod_total_material_cost(
    p_sod_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
    v_total DECIMAL;
BEGIN
    SELECT COALESCE(SUM(
        su.quantity * COALESCE(NULLIF(su."costPrice", 0), su."unitPrice", 0)
    ), 0)
    INTO v_total
    FROM public."SODMaterialUsage" su
    WHERE su."serviceOrderId" = p_sod_id;

    RETURN ROUND(v_total::numeric, 2);
END;
$$ LANGUAGE plpgsql SET search_path = '';
