-- Supply chain phase 2, part 2: one stock valuation basis, and a reorder-level recalculation that respects store overrides.
--
-- Valuation basis (the same as the Inventory health page): a stock row is worth the sum of batch quantity x batch cost where
-- the store holds batches of the item, otherwise on-hand quantity x the item's cost price. The older functions averaged every
-- purchase order price of the item across all time and fell back to the selling price, so dashboards disagreed with the GL.

CREATE OR REPLACE FUNCTION public.fn_store_inventory_value(p_store_id UUID)
RETURNS TABLE(category TEXT, item_count INTEGER, total_quantity NUMERIC, total_value NUMERIC) AS $$
BEGIN
    RETURN QUERY
    WITH batch_value AS (
        SELECT bs."itemId", SUM(bs.quantity * b."costPrice") AS v
        FROM public."InventoryBatchStock" bs
        JOIN public."InventoryBatch" b ON b.id = bs."batchId"
        WHERE bs."storeId" = p_store_id AND bs.quantity > 0
        GROUP BY bs."itemId"
    )
    SELECT
        i.category,
        COUNT(DISTINCT s."itemId")::INT,
        SUM(s.quantity),
        ROUND(SUM(COALESCE(bv.v, s.quantity * COALESCE(i."costPrice", 0)))::numeric, 2)
    FROM public."InventoryStock" s
    JOIN public."InventoryItem" i ON s."itemId" = i.id
    LEFT JOIN batch_value bv ON bv."itemId" = s."itemId"
    WHERE s."storeId" = p_store_id AND s.quantity > 0
    GROUP BY i.category
    ORDER BY 4 DESC;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.fn_store_material_balance(p_store_id UUID, p_category TEXT DEFAULT NULL)
RETURNS TABLE(
    item_id UUID, item_code TEXT, item_name TEXT,
    current_stock NUMERIC, allocated_stock NUMERIC, available_stock NUMERIC,
    min_level NUMERIC, reorder_needed BOOLEAN, total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH batch_value AS (
        SELECT bs."itemId", SUM(bs.quantity * b."costPrice") AS v
        FROM public."InventoryBatchStock" bs
        JOIN public."InventoryBatch" b ON b.id = bs."batchId"
        WHERE bs."storeId" = p_store_id AND bs.quantity > 0
        GROUP BY bs."itemId"
    )
    SELECT
        s."itemId", i.code, i.name, s.quantity, s."allocatedQuantity",
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
        ROUND(COALESCE(bv.v, s.quantity * COALESCE(i."costPrice", 0))::numeric, 2)
    FROM public."InventoryStock" s
    JOIN public."InventoryItem" i ON s."itemId" = i.id
    LEFT JOIN batch_value bv ON bv."itemId" = s."itemId"
    WHERE s."storeId" = p_store_id AND (p_category IS NULL OR i.category = p_category)
    ORDER BY i.name;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.fn_multi_store_material_balance(p_store_ids UUID[], p_category TEXT DEFAULT NULL)
RETURNS TABLE(
    store_id UUID, store_name TEXT,
    item_id UUID, item_code TEXT, item_name TEXT,
    current_stock NUMERIC, allocated_stock NUMERIC, available_stock NUMERIC,
    min_level NUMERIC, reorder_needed BOOLEAN, total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH batch_value AS (
        SELECT bs."storeId", bs."itemId", SUM(bs.quantity * b."costPrice") AS v
        FROM public."InventoryBatchStock" bs
        JOIN public."InventoryBatch" b ON b.id = bs."batchId"
        WHERE bs."storeId" = ANY(p_store_ids) AND bs.quantity > 0
        GROUP BY bs."storeId", bs."itemId"
    )
    SELECT
        s."storeId", st.name, s."itemId", i.code, i.name, s.quantity, s."allocatedQuantity",
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
        ROUND(COALESCE(bv.v, s.quantity * COALESCE(i."costPrice", 0))::numeric, 2)
    FROM public."InventoryStock" s
    JOIN public."InventoryItem" i ON s."itemId" = i.id
    JOIN public."InventoryStore" st ON st.id = s."storeId"
    LEFT JOIN batch_value bv ON bv."storeId" = s."storeId" AND bv."itemId" = s."itemId"
    WHERE s."storeId" = ANY(p_store_ids) AND (p_category IS NULL OR i.category = p_category)
    ORDER BY st.name, i.name;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Reorder levels: recalculated at ITEM level only. The old version also copied the item level onto every store row, which
-- wiped any minimum a store manager had set. Store rows that are plain copies of the item's current level (no real override)
-- are cleared first, so the item level applies to them; a store minimum that differs from the item level is a real override and is kept.
CREATE OR REPLACE FUNCTION public.fn_update_rop_levels()
RETURNS INT AS $$
DECLARE
    v_updated INT;
BEGIN
    UPDATE public."InventoryStock" s
    SET "minLevel" = 0, "updatedAt" = NOW()
    FROM public."InventoryItem" i
    WHERE s."itemId" = i.id AND s."minLevel" > 0 AND s."minLevel" = i."minLevel";

    WITH rop_data AS (
        SELECT
            su."itemId",
            COALESCE(SUM(su.quantity)::DECIMAL / 90.0, 0) AS avg_daily
        FROM public."SODMaterialUsage" su
        WHERE su."createdAt" >= NOW() - INTERVAL '90 days'
          AND su."usageType" IN ('USED', 'USED_F1', 'USED_G1', 'PORTAL_SYNC', 'WASTAGE')
        GROUP BY su."itemId"
    ),
    lead_data AS (
        SELECT
            sri."itemId",
            COALESCE(AVG(EXTRACT(DAY FROM (sr."receivedDate" - sr."createdAt"))), 7) AS avg_lt,
            COALESCE(MAX(EXTRACT(DAY FROM (sr."receivedDate" - sr."createdAt"))), 14) AS max_lt
        FROM public."StockRequest" sr
        JOIN public."StockRequestItem" sri ON sri."requestId" = sr.id
        WHERE sr."receivedDate" IS NOT NULL AND sr."createdAt" >= NOW() - INTERVAL '90 days'
        GROUP BY sri."itemId"
    ),
    final_rop AS (
        SELECT
            rd."itemId",
            (rd.avg_daily * COALESCE(ld.avg_lt, 7))
              + GREATEST(0, (rd.avg_daily * COALESCE(ld.max_lt, 14)) - (rd.avg_daily * COALESCE(ld.avg_lt, 7))) AS rop
        FROM rop_data rd
        LEFT JOIN lead_data ld ON ld."itemId" = rd."itemId"
    )
    UPDATE public."InventoryItem" i
    SET "minLevel" = ROUND(f.rop::numeric, 2), "updatedAt" = NOW()
    FROM final_rop f
    WHERE i.id = f."itemId" AND f.rop > 0;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;
