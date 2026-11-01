-- Keep the function locked to an empty search_path while qualifying every
-- application table it reads. The previous migration set search_path = ''
-- without qualifying these relations, causing live wastage writes to fail
-- with `relation "InventoryItem" does not exist`.
CREATE OR REPLACE FUNCTION public.fn_wastage_approval_check(
    p_contractor_id UUID,
    p_store_id UUID,
    p_month TEXT,
    p_item_ids UUID[],
    p_quantities NUMERIC[]
)
RETURNS TABLE(requires_approval BOOLEAN, total_wastage_value NUMERIC, excess_details TEXT)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    i INT;
    v_item_id UUID;
    v_qty NUMERIC;
    v_item_name TEXT;
    v_cost_price NUMERIC;
    v_is_wastage_allowed BOOLEAN;
    v_max_wastage_pct NUMERIC;
    v_total_issued NUMERIC;
    v_wastage_pct NUMERIC;
    v_total_value NUMERIC := 0;
    v_requires_approval BOOLEAN := FALSE;
    v_excess TEXT := '';
    v_excess_item TEXT;
BEGIN
    IF p_contractor_id IS NOT NULL THEN
        v_requires_approval := TRUE;
    END IF;

    FOR i IN 1..array_length(p_item_ids, 1) LOOP
        v_item_id := p_item_ids[i];
        v_qty := p_quantities[i];

        SELECT name, COALESCE("costPrice", 0), COALESCE("isWastageAllowed", true),
               COALESCE("maxWastagePercentage", 0)
        INTO v_item_name, v_cost_price, v_is_wastage_allowed, v_max_wastage_pct
        FROM public."InventoryItem"
        WHERE id = v_item_id;

        v_total_value := v_total_value + (v_qty * v_cost_price);

        IF NOT v_is_wastage_allowed THEN
            v_requires_approval := TRUE;
        END IF;

        IF p_contractor_id IS NOT NULL THEN
            SELECT COALESCE(SUM(ci."quantity"), 0)
            INTO v_total_issued
            FROM public."ContractorMaterialIssueItem" ci
            JOIN public."ContractorMaterialIssue" mi ON mi.id = ci."issueId"
            WHERE mi."contractorId" = p_contractor_id
              AND mi."month" = p_month
              AND ci."itemId" = v_item_id;

            IF v_total_issued > 0 THEN
                v_wastage_pct := (v_qty / v_total_issued) * 100;
                IF v_wastage_pct > v_max_wastage_pct THEN
                    v_requires_approval := TRUE;
                    v_excess_item := v_item_name || ' (Wastage: ' || ROUND(v_wastage_pct::numeric, 1) || '% > Allowed: ' || ROUND(v_max_wastage_pct::numeric, 1) || '%)';
                    IF v_excess <> '' THEN v_excess := v_excess || '; '; END IF;
                    v_excess := v_excess || v_excess_item;
                END IF;
            ELSIF v_qty > 0 THEN
                v_requires_approval := TRUE;
                v_excess_item := v_item_name || ' (Wastage reported but no issues recorded)';
                IF v_excess <> '' THEN v_excess := v_excess || '; '; END IF;
                v_excess := v_excess || v_excess_item;
            END IF;
        END IF;
    END LOOP;

    IF v_total_value > 10000 THEN
        v_requires_approval := TRUE;
    END IF;

    RETURN QUERY SELECT v_requires_approval, v_total_value, v_excess;
END;
$$;
