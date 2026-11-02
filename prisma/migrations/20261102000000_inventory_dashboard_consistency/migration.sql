-- Inventory cross-module consistency fixes.
--
-- The same business rule must be used by Stores, Project logistics and the
-- executive/CSO dashboard:
--   available = physical on-hand - allocated reservations
--   store min level overrides item min level when it is positive
--   reorder is required when available is below the effective minimum

CREATE OR REPLACE FUNCTION public.fn_fifo_pick_store_batches(
    p_store_id UUID,
    p_item_id UUID,
    p_required_qty DECIMAL
)
RETURNS TABLE (
    batch_id UUID,
    available_qty DECIMAL,
    pick_qty DECIMAL,
    batch_created_at TIMESTAMP,
    batch_expiry_date TIMESTAMP,
    cost_price DECIMAL,
    unit_price DECIMAL
) AS $$
DECLARE
    v_remaining DECIMAL := p_required_qty;
    v_take DECIMAL;
BEGIN
    FOR batch_id, available_qty, batch_created_at, batch_expiry_date, cost_price, unit_price IN
        SELECT
            bs."batchId",
            bs.quantity - COALESCE(bs."allocatedQuantity", 0),
            b."createdAt",
            b."expiryDate",
            b."costPrice",
            b."unitPrice"
        FROM public."InventoryBatchStock" bs
        JOIN public."InventoryBatch" b ON bs."batchId" = b.id
        WHERE bs."storeId" = p_store_id
          AND bs."itemId" = p_item_id
          AND bs.quantity - COALESCE(bs."allocatedQuantity", 0) > 0
        ORDER BY b."expiryDate" ASC NULLS LAST, b."createdAt" ASC
        FOR UPDATE OF bs
    LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(available_qty, v_remaining);
        pick_qty := v_take;
        RETURN NEXT;
        v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
        batch_id := NULL;
        available_qty := 0;
        pick_qty := v_remaining;
        batch_created_at := NULL;
        batch_expiry_date := NULL;
        cost_price := 0;
        unit_price := 0;
        RETURN NEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;
CREATE OR REPLACE FUNCTION public.fn_low_stock_alerts(
    p_store_id UUID
)
RETURNS TABLE (
    item_id UUID,
    item_code TEXT,
    item_name TEXT,
    current_stock DECIMAL,
    min_level DECIMAL,
    deficit DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s."itemId",
        i.code,
        i.name,
        s.quantity,
        CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END,
        CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END
            - (s.quantity - COALESCE(s."allocatedQuantity", 0))
    FROM public."InventoryStock" s
    JOIN public."InventoryItem" i ON s."itemId" = i.id
    WHERE s."storeId" = p_store_id
      AND (
          s.quantity - COALESCE(s."allocatedQuantity", 0) < 0
          OR (
              CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END > 0
              AND s.quantity - COALESCE(s."allocatedQuantity", 0)
                  <= CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END
          )
      )
    ORDER BY (
        CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END
        - (s.quantity - COALESCE(s."allocatedQuantity", 0))
    ) DESC;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.fn_store_material_balance(
    p_store_id UUID,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE(
    item_id UUID, item_code TEXT, item_name TEXT,
    current_stock NUMERIC, allocated_stock NUMERIC, available_stock NUMERIC,
    min_level NUMERIC, reorder_needed BOOLEAN, total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH item_prices AS (
        SELECT sri."itemId", ROUND(AVG(poi."unitPrice")::numeric, 2) AS avg_price
        FROM public."PurchaseOrderItem" poi
        JOIN public."StockRequestItem" sri ON sri.id = poi."stockRequestItemId"
        WHERE poi."unitPrice" > 0
        GROUP BY sri."itemId"
    )
    SELECT
        s."itemId",
        i.code,
        i.name,
        s.quantity,
        s."allocatedQuantity",
        s.quantity - COALESCE(s."allocatedQuantity", 0),
        CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END,
        (
            s.quantity - COALESCE(s."allocatedQuantity", 0) < 0
            OR (
                CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END > 0
                AND s.quantity - COALESCE(s."allocatedQuantity", 0)
                    <= CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END
            )
        ),
        ROUND((s.quantity * COALESCE(ip.avg_price, i."unitPrice", 0))::numeric, 2)
    FROM public."InventoryStock" s
    JOIN public."InventoryItem" i ON s."itemId" = i.id
    LEFT JOIN item_prices ip ON ip."itemId" = s."itemId"
    WHERE s."storeId" = p_store_id
      AND (p_category IS NULL OR i.category = p_category)
    ORDER BY i.name;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.fn_multi_store_material_balance(
    p_store_ids UUID[],
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE(
    store_id UUID, store_name TEXT,
    item_id UUID, item_code TEXT, item_name TEXT,
    current_stock NUMERIC, allocated_stock NUMERIC, available_stock NUMERIC,
    min_level NUMERIC, reorder_needed BOOLEAN, total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH item_prices AS (
        SELECT sri."itemId", ROUND(AVG(poi."unitPrice")::numeric, 2) AS avg_price
        FROM public."PurchaseOrderItem" poi
        JOIN public."StockRequestItem" sri ON sri.id = poi."stockRequestItemId"
        WHERE poi."unitPrice" > 0
        GROUP BY sri."itemId"
    )
    SELECT
        s."storeId",
        st.name,
        s."itemId",
        i.code,
        i.name,
        s.quantity,
        s."allocatedQuantity",
        s.quantity - COALESCE(s."allocatedQuantity", 0),
        CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END,
        (
            s.quantity - COALESCE(s."allocatedQuantity", 0) < 0
            OR (
                CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END > 0
                AND s.quantity - COALESCE(s."allocatedQuantity", 0)
                    <= CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END
            )
        ),
        ROUND((s.quantity * COALESCE(ip.avg_price, i."unitPrice", 0))::numeric, 2)
    FROM public."InventoryStock" s
    JOIN public."InventoryItem" i ON s."itemId" = i.id
    JOIN public."InventoryStore" st ON s."storeId" = st.id
    LEFT JOIN item_prices ip ON ip."itemId" = s."itemId"
    WHERE s."storeId" = ANY(p_store_ids)
      AND (p_category IS NULL OR i.category = p_category)
    ORDER BY st.name, i.name;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.fn_store_dashboard_summary(
    p_store_id UUID
)
RETURNS TABLE(metric_name TEXT, metric_value NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (VALUES
        ('total_unique_items'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM public."InventoryStock" WHERE "storeId" = p_store_id)),
        ('total_quantity'::TEXT,
         (SELECT COALESCE(SUM(quantity), 0) FROM public."InventoryStock" WHERE "storeId" = p_store_id)),
        ('total_value'::TEXT,
         (WITH item_prices AS (
             SELECT sri."itemId", ROUND(AVG(poi."unitPrice")::numeric, 2) AS avg_price
             FROM public."PurchaseOrderItem" poi
             JOIN public."StockRequestItem" sri ON sri.id = poi."stockRequestItemId"
             WHERE poi."unitPrice" > 0
             GROUP BY sri."itemId"
         )
         SELECT ROUND(COALESCE(SUM(s.quantity * COALESCE(ip.avg_price, i."unitPrice", 0)), 0)::numeric, 2)
         FROM public."InventoryStock" s
         JOIN public."InventoryItem" i ON s."itemId" = i.id
         LEFT JOIN item_prices ip ON ip."itemId" = s."itemId"
         WHERE s."storeId" = p_store_id)),
        ('low_stock_count'::TEXT,
         (SELECT COUNT(*)::NUMERIC
          FROM public."InventoryStock" s
          JOIN public."InventoryItem" i ON s."itemId" = i.id
          WHERE s."storeId" = p_store_id
            AND (
                s.quantity - COALESCE(s."allocatedQuantity", 0) < 0
                OR (
                    CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END > 0
                    AND s.quantity - COALESCE(s."allocatedQuantity", 0)
                        <= CASE WHEN s."minLevel" > 0 THEN s."minLevel" ELSE i."minLevel" END
                )
            ))),
        ('pending_dispatch_count'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM public."StockRequest"
          WHERE "fromStoreId" = p_store_id AND status IN ('PENDING', 'APPROVED'))),
        ('pending_grn_count'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM public."StockRequest"
          WHERE ("fromStoreId" = p_store_id OR "toStoreId" = p_store_id)
            AND "workflowStage" IN ('GRN_PENDING', 'STORE_RECEIVING'))),
        ('pending_mrn_count'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM public."MRN"
          WHERE "storeId" = p_store_id AND status = 'PENDING'))
    ) AS t(metric_name, metric_value);
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.fn_bulk_stock_initialize(
    p_store_id UUID,
    p_item_ids UUID[],
    p_quantities NUMERIC[]
)
RETURNS TABLE(item_id UUID, old_qty NUMERIC, new_qty NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
    i INT;
    v_item_id UUID;
    v_new_qty NUMERIC;
    v_old_qty NUMERIC;
    v_allocated_qty NUMERIC;
    v_diff NUMERIC;
    v_cost_price NUMERIC;
    v_unit_price NUMERIC;
    v_batch_id UUID;
    v_picked_qty NUMERIC;
BEGIN
    IF COALESCE(array_length(p_item_ids, 1), 0) <> COALESCE(array_length(p_quantities, 1), 0) THEN
        RAISE EXCEPTION 'STOCK_ADJUSTMENT_ARRAY_LENGTH_MISMATCH';
    END IF;
    IF array_length(p_item_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    FOR i IN 1..array_length(p_item_ids, 1) LOOP
        v_item_id := p_item_ids[i];
        v_new_qty := ROUND(p_quantities[i]::numeric, 4);
        IF v_new_qty < 0 THEN
            RAISE EXCEPTION 'STOCK_ADJUSTMENT_NEGATIVE_QUANTITY: item %', v_item_id;
        END IF;

        SELECT COALESCE("quantity", 0), COALESCE("allocatedQuantity", 0)
        INTO v_old_qty, v_allocated_qty
        FROM public."InventoryStock"
        WHERE "storeId" = p_store_id AND "itemId" = v_item_id
        FOR UPDATE;

        v_old_qty := COALESCE(v_old_qty, 0);
        v_allocated_qty := COALESCE(v_allocated_qty, 0);
        IF v_new_qty < v_allocated_qty THEN
            RAISE EXCEPTION 'STOCK_ADJUSTMENT_BELOW_ALLOCATED: item %', v_item_id;
        END IF;

        v_diff := ROUND(v_new_qty - v_old_qty, 4);
        IF v_diff = 0 THEN
            RETURN QUERY SELECT v_item_id, v_old_qty, v_new_qty;
            CONTINUE;
        END IF;

        IF v_diff > 0 THEN
            SELECT COALESCE("costPrice", 0), COALESCE("unitPrice", 0)
            INTO v_cost_price, v_unit_price
            FROM public."InventoryItem" WHERE id = v_item_id;

            v_batch_id := uuid_generate_v7();
            INSERT INTO public."InventoryBatch" (id, "batchNumber", "itemId", "initialQty", "costPrice", "unitPrice", "createdAt")
            VALUES (v_batch_id, 'ADJ-' || extract(epoch from now())::bigint::text || i::text, v_item_id, v_diff, v_cost_price, v_unit_price, now());
            INSERT INTO public."InventoryBatchStock" (id, "storeId", "itemId", "batchId", "quantity", "updatedAt")
            VALUES (uuid_generate_v7(), p_store_id, v_item_id, v_batch_id, v_diff, now());
        ELSE
            FOR v_batch_id, v_picked_qty IN
                SELECT batch_id, pick_qty
                FROM public.fn_fifo_pick_store_batches(p_store_id, v_item_id, ABS(v_diff))
            LOOP
                IF v_batch_id IS NULL THEN
                    RAISE EXCEPTION 'INSUFFICIENT_BATCH_STOCK: item %', v_item_id;
                END IF;
                UPDATE public."InventoryBatchStock"
                SET "quantity" = "quantity" - v_picked_qty
                WHERE "storeId" = p_store_id AND "batchId" = v_batch_id AND "quantity" >= v_picked_qty;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'BATCH_STOCK_ADJUSTMENT_CONFLICT: item %', v_item_id;
                END IF;
            END LOOP;
        END IF;

        INSERT INTO public."InventoryStock" (id, "storeId", "itemId", "quantity", "createdAt", "updatedAt")
        VALUES (uuid_generate_v7(), p_store_id, v_item_id, v_new_qty, now(), now())
        ON CONFLICT ("storeId", "itemId")
        DO UPDATE SET "quantity" = v_new_qty, "updatedAt" = now();

        RETURN QUERY SELECT v_item_id, v_old_qty, v_new_qty;
    END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

