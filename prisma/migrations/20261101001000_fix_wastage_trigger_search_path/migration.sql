-- The global function hardening migration set fn_validate_wastage_limit's
-- search_path to empty, but its body still referenced application tables
-- without schema qualification.  Wastage writes therefore failed inside the
-- trigger with `relation "InventoryItem" does not exist`.
CREATE OR REPLACE FUNCTION public.fn_validate_wastage_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_max_pct DECIMAL;
    v_is_allowed BOOLEAN;
    v_total_consumed DECIMAL;
    v_total_wastage DECIMAL;
    v_pct DECIMAL;
BEGIN
    SELECT "isWastageAllowed", "maxWastagePercentage"
    INTO v_is_allowed, v_max_pct
    FROM public."InventoryItem"
    WHERE id = NEW."itemId";

    IF NOT v_is_allowed THEN
        RAISE EXCEPTION 'WASTAGE_NOT_ALLOWED: Item % does not allow wastage', NEW."itemId"
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT COALESCE(SUM(wi.quantity), 0)
    INTO v_total_wastage
    FROM public."ContractorWastageItem" wi
    JOIN public."ContractorWastage" w ON wi."wastageId" = w.id
    WHERE w."contractorId" = (
        SELECT "contractorId" FROM public."ContractorWastage" WHERE id = NEW."wastageId"
    )
      AND wi."itemId" = NEW."itemId";

    SELECT COALESCE(SUM(su.quantity), 0)
    INTO v_total_consumed
    FROM public."SODMaterialUsage" su
    JOIN public."ServiceOrder" so ON su."serviceOrderId" = so.id
    WHERE so."contractorId" = (
        SELECT "contractorId" FROM public."ContractorWastage" WHERE id = NEW."wastageId"
    )
      AND su."itemId" = NEW."itemId";

    IF v_total_consumed > 0 AND v_max_pct > 0 THEN
        v_pct := (v_total_wastage / v_total_consumed) * 100;
        IF v_pct > v_max_pct THEN
            RAISE EXCEPTION 'WASTAGE_LIMIT_EXCEEDED: Item % wastage at %.1f%% exceeds max %.1f%%',
                NEW."itemId", v_pct, v_max_pct
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
