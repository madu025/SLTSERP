-- Fix project workflow runtime functions after the security search_path hardening
-- migration. The functions use explicit public qualification so reservation and
-- issue flows work with search_path = ''.

CREATE OR REPLACE FUNCTION public.fn_next_document_number(p_type TEXT)
RETURNS TEXT AS $$
DECLARE
    v_year INT;
    v_month INT;
    v_period TEXT;
    v_seq INT;
BEGIN
    v_year := EXTRACT(YEAR FROM NOW());
    v_month := EXTRACT(MONTH FROM NOW());
    v_period := v_year || '-' || LPAD(v_month::TEXT, 2, '0');

    INSERT INTO public."DocumentCounter" (type, period, sequence)
    VALUES (p_type, v_period, 1)
    ON CONFLICT (type, period)
    DO UPDATE SET sequence = public."DocumentCounter".sequence + 1
    RETURNING sequence INTO v_seq;

    RETURN p_type || '-' || v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.fn_bulk_boq_actual_update(
    p_project_id UUID,
    p_item_ids UUID[],
    p_quantities NUMERIC[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_updated INT := 0;
    i INT;
BEGIN
    IF array_length(p_item_ids, 1) IS NULL THEN RETURN 0; END IF;
    FOR i IN 1..array_length(p_item_ids, 1) LOOP
        UPDATE public."ProjectBOQItem"
        SET "actualQuantity" = "actualQuantity" + p_quantities[i],
            "actualCost" = "actualCost" + (p_quantities[i] * "unitRate")
        WHERE "projectId" = p_project_id AND "materialId" = p_item_ids[i];
        IF FOUND THEN v_updated := v_updated + 1; END IF;
    END LOOP;
    RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_auto_ledger_checksum()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_checksum TEXT;
    v_payload TEXT;
BEGIN
    SELECT checksum INTO v_prev_checksum
    FROM public."InventoryLedger"
    WHERE "storeId" = NEW."storeId" AND "itemId" = NEW."itemId"
    ORDER BY "createdAt" DESC LIMIT 1;
    IF v_prev_checksum IS NULL THEN v_prev_checksum := 'GENESIS'; END IF;
    IF NEW."previousChecksum" IS NULL THEN NEW."previousChecksum" := v_prev_checksum; END IF;
    v_payload := NEW."storeId" || ':' || NEW."itemId" || ':' || NEW."quantityAfter"::TEXT || ':' || NEW."createdAt"::TEXT || ':' || COALESCE(NEW."previousChecksum", 'GENESIS');
    NEW."checksum" := encode(public.digest(v_payload, 'sha256'), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

ALTER TABLE public."SurveyPoint"
  ALTER COLUMN "layerId" TYPE TEXT USING "layerId"::text;
