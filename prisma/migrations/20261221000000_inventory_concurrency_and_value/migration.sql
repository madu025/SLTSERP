-- 1. Two orders using the same contractor stock at the same moment both succeeded and left the contractor with a NEGATIVE quantity
--    (found by the concurrency test: 60 + 60 used from 90 gave -30). The store side (fn_fifo_pick_store_batches) locks the batch rows it
--    picks from (FOR UPDATE), so the second caller waits and then sees what is left; the contractor side did not. It now does the same.
CREATE OR REPLACE FUNCTION public.fn_fifo_pick_contractor_batches(
    p_contractor_id UUID,
    p_item_id UUID,
    p_required_qty DECIMAL
)
RETURNS TABLE (
    batch_id UUID,
    available_qty DECIMAL,
    pick_qty DECIMAL,
    batch_created_at TIMESTAMP,
    cost_price DECIMAL,
    unit_price DECIMAL
) AS $$
DECLARE
    v_remaining DECIMAL := p_required_qty;
    v_take DECIMAL;
BEGIN
    FOR batch_id, available_qty, batch_created_at, cost_price, unit_price IN
        SELECT
            cbs."batchId",
            cbs.quantity,
            b."createdAt",
            b."costPrice",
            b."unitPrice"
        FROM public."ContractorBatchStock" cbs
        JOIN public."InventoryBatch" b ON cbs."batchId" = b.id
        WHERE cbs."contractorId" = p_contractor_id
          AND cbs."itemId" = p_item_id
          AND cbs.quantity > 0
        ORDER BY b."createdAt" ASC
        FOR UPDATE OF cbs
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_take := LEAST(available_qty, v_remaining);
        pick_qty := v_take;

        RETURN NEXT;

        v_remaining := v_remaining - v_take;
    END LOOP;

    -- Shortage row
    IF v_remaining > 0 THEN
        batch_id := NULL;
        available_qty := 0;
        pick_qty := v_remaining;
        batch_created_at := NULL;
        cost_price := 0;
        unit_price := 0;
        RETURN NEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- 2. The store dashboard valued stock at the selling price when an item had no purchase order, and at the purchase order average otherwise,
--    while the material balance valued it at batch cost: two values for one store. One rule now: cost.
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
         -- value at COST, the same rule as fn_multi_store_material_balance and fn_store_inventory_value: the cost of the batches held,
         -- or the item cost where a stock row has no batch. (This used to be quantity x the average purchase order price, or the SELLING price
         -- when an item had no purchase order, so the dashboard showed a higher value than the material balance.)
         (WITH batch_value AS (
             SELECT bs."itemId", SUM(bs.quantity * b."costPrice") AS v
             FROM public."InventoryBatchStock" bs
             JOIN public."InventoryBatch" b ON b.id = bs."batchId"
             WHERE bs."storeId" = p_store_id AND bs.quantity > 0
             GROUP BY bs."itemId"
         )
         SELECT ROUND(COALESCE(SUM(COALESCE(bv.v, s.quantity * COALESCE(i."costPrice", 0))), 0)::numeric, 2)
         FROM public."InventoryStock" s
         JOIN public."InventoryItem" i ON s."itemId" = i.id
         LEFT JOIN batch_value bv ON bv."itemId" = s."itemId"
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
