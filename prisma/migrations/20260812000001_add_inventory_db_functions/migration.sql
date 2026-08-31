-- Add 5 new inventory DB functions to eliminate N+1 queries and JS-side computation
-- These complement existing fn_store_material_balance, fn_expiring_batches, etc.

-- =============================================================================
-- 1. fn_multi_store_material_balance: aggregate material balance across stores
--    Eliminates N+1 loop in dashboard-kpis route (lines 289-301)
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_multi_store_material_balance(
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
        SELECT sri."itemId",
               ROUND(AVG(poi."unitPrice")::numeric, 2) as avg_price
        FROM "PurchaseOrderItem" poi
        JOIN "StockRequestItem" sri ON sri.id = poi."stockRequestItemId"
        WHERE poi."unitPrice" > 0
        GROUP BY sri."itemId"
    )
    SELECT
        s."storeId" as store_id,
        st.name as store_name,
        s."itemId" as item_id,
        i.code as item_code,
        i.name as item_name,
        s.quantity as current_stock,
        s."allocatedQuantity" as allocated_stock,
        (s.quantity - s."allocatedQuantity") as available_stock,
        s."minLevel" as min_level,
        (s.quantity - s."allocatedQuantity") <= s."minLevel" as reorder_needed,
        ROUND((s.quantity * COALESCE(ip.avg_price, i."unitPrice", 0))::numeric, 2) as total_value
    FROM "InventoryStock" s
    JOIN "InventoryItem" i ON s."itemId" = i.id
    JOIN "InventoryStore" st ON s."storeId" = st.id
    LEFT JOIN item_prices ip ON ip."itemId" = s."itemId"
    WHERE s."storeId" = ANY(p_store_ids)
      AND (p_category IS NULL OR i.category = p_category)
    ORDER BY st.name, i.name;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. fn_multi_store_expiring_batches: expiring batches across multiple stores
--    Eliminates N+1 loop in dashboard-kpis route (lines 303-312)
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_multi_store_expiring_batches(
    p_store_ids UUID[],
    p_days_ahead INTEGER DEFAULT 30
)
RETURNS TABLE(
    store_id UUID, store_name TEXT,
    batch_id UUID, batch_number TEXT,
    item_code TEXT, item_name TEXT,
    quantity NUMERIC, expiry_date TIMESTAMP, days_until_expiry INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bs."storeId" as store_id,
        st.name as store_name,
        bs."batchId" as batch_id,
        b."batchNumber" as batch_number,
        i.code as item_code,
        i.name as item_name,
        bs.quantity,
        b."expiryDate",
        (b."expiryDate"::date - CURRENT_DATE) as days_until_expiry
    FROM "InventoryBatchStock" bs
    JOIN "InventoryBatch" b ON bs."batchId" = b.id
    JOIN "InventoryItem" i ON bs."itemId" = i.id
    JOIN "InventoryStore" st ON bs."storeId" = st.id
    WHERE bs."storeId" = ANY(p_store_ids)
      AND b."expiryDate" IS NOT NULL
      AND b."expiryDate" <= (CURRENT_DATE + p_days_ahead)
      AND bs.quantity > 0
    ORDER BY b."expiryDate" ASC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. fn_contractor_stock_summary: categorized stock counts for contractor dashboard
--    Replaces JS loop in contractor-inventory.service.ts (lines 284-298)
--    Returns: total_items, total_quantity, drop_wire_meters, ont_count, fac_count, total_value
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_contractor_stock_summary(
    p_contractor_id UUID
)
RETURNS TABLE(
    total_items BIGINT,
    total_quantity NUMERIC,
    drop_wire_meters NUMERIC,
    ont_count NUMERIC,
    fac_count NUMERIC,
    total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH item_prices AS (
        SELECT sri."itemId",
               ROUND(AVG(poi."unitPrice")::numeric, 2) as avg_price
        FROM "PurchaseOrderItem" poi
        JOIN "StockRequestItem" sri ON sri.id = poi."stockRequestItemId"
        WHERE poi."unitPrice" > 0
        GROUP BY sri."itemId"
    ),
    contractor_items AS (
        SELECT
            cs."itemId",
            cs.quantity,
            i.code,
            i.name,
            COALESCE(ip.avg_price, i."unitPrice", 0) as unit_cost
        FROM "ContractorStock" cs
        JOIN "InventoryItem" i ON cs."itemId" = i.id
        LEFT JOIN item_prices ip ON ip."itemId" = cs."itemId"
        WHERE cs."contractorId" = p_contractor_id
    )
    SELECT
        COUNT(*)::BIGINT as total_items,
        COALESCE(SUM(ci.quantity), 0) as total_quantity,
        COALESCE(SUM(CASE
            WHEN UPPER(ci.code) LIKE '%DW%' OR UPPER(ci.name) LIKE '%DROP WIRE%'
            THEN ci.quantity ELSE 0
        END), 0) as drop_wire_meters,
        COALESCE(SUM(CASE
            WHEN UPPER(ci.code) LIKE '%ONT%' OR UPPER(ci.name) LIKE '%ONT%' OR UPPER(ci.name) LIKE '%ROUTER%'
            THEN ci.quantity ELSE 0
        END), 0) as ont_count,
        COALESCE(SUM(CASE
            WHEN UPPER(ci.code) LIKE '%FAC%' OR UPPER(ci.name) LIKE '%FAST CONNECTOR%'
            THEN ci.quantity ELSE 0
        END), 0) as fac_count,
        ROUND(COALESCE(SUM(ci.quantity * ci.unit_cost), 0)::numeric, 2) as total_value
    FROM contractor_items ci;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. fn_store_dashboard_summary: all KPI counts in a single DB call
--    Replaces 7 separate queries in dashboard-kpis single-store path
--    Returns rows with (metric_name, metric_value) pairs
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_store_dashboard_summary(
    p_store_id UUID
)
RETURNS TABLE(
    metric_name TEXT,
    metric_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (VALUES
        -- Total unique items in stock
        ('total_unique_items'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM "InventoryStock" WHERE "storeId" = p_store_id)),
        -- Total stock quantity
        ('total_quantity'::TEXT,
         (SELECT COALESCE(SUM(quantity), 0) FROM "InventoryStock" WHERE "storeId" = p_store_id)),
        -- Total stock value (PO cost)
        ('total_value'::TEXT,
         (WITH item_prices AS (
             SELECT sri."itemId",
                    ROUND(AVG(poi."unitPrice")::numeric, 2) as avg_price
             FROM "PurchaseOrderItem" poi
             JOIN "StockRequestItem" sri ON sri.id = poi."stockRequestItemId"
             WHERE poi."unitPrice" > 0
             GROUP BY sri."itemId"
         )
         SELECT ROUND(COALESCE(SUM(
             s.quantity * COALESCE(ip.avg_price, i."unitPrice", 0)
         ), 0)::numeric, 2)
         FROM "InventoryStock" s
         JOIN "InventoryItem" i ON s."itemId" = i.id
         LEFT JOIN item_prices ip ON ip."itemId" = s."itemId"
         WHERE s."storeId" = p_store_id)),
        -- Low stock count (items at or below minLevel)
        ('low_stock_count'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM "InventoryStock"
          WHERE "storeId" = p_store_id
            AND "minLevel" > 0
            AND (quantity - COALESCE("allocatedQuantity", 0)) <= "minLevel")),
        -- Pending dispatches (stock requests awaiting issue)
        ('pending_dispatch_count'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM "StockRequest"
          WHERE "fromStoreId" = p_store_id
            AND status IN ('PENDING', 'APPROVED'))),
        -- Pending GRNs
        ('pending_grn_count'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM "GRN" WHERE "storeId" = p_store_id)),
        -- Pending MRNs (returns)
        ('pending_mrn_count'::TEXT,
         (SELECT COUNT(*)::NUMERIC FROM "MRN"
          WHERE "storeId" = p_store_id AND status = 'PENDING'))
    ) AS t(metric_name, metric_value);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. fn_stock_movement_report: transaction history with in/out/balance per item
--    Provides stock card data in a single DB call
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_stock_movement_report(
    p_store_id UUID,
    p_from_date DATE DEFAULT NULL,
    p_to_date DATE DEFAULT NULL
)
RETURNS TABLE(
    transaction_date TIMESTAMP,
    transaction_type TEXT,
    transaction_id UUID,
    item_id UUID,
    item_code TEXT,
    item_name TEXT,
    quantity_in NUMERIC,
    quantity_out NUMERIC,
    running_balance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH movements AS (
        SELECT
            t.date as transaction_date,
            t.type as transaction_type,
            t.id as transaction_id,
            ti."itemId" as item_id,
            i.code as item_code,
            i.name as item_name,
            CASE WHEN t.type IN ('GRN_IN', 'TRANSFER_IN') THEN ti.quantity ELSE 0 END as quantity_in,
            CASE WHEN t.type IN ('TRANSFER_OUT') THEN ABS(ti.quantity) ELSE 0 END as quantity_out
        FROM "InventoryTransaction" t
        JOIN "InventoryTransactionItem" ti ON ti."transactionId" = t.id
        JOIN "InventoryItem" i ON ti."itemId" = i.id
        WHERE t."storeId" = p_store_id
          AND (p_from_date IS NULL OR t.date::date >= p_from_date)
          AND (p_to_date IS NULL OR t.date::date <= p_to_date)
    )
    SELECT
        m.transaction_date,
        m.transaction_type,
        m.transaction_id,
        m.item_id,
        m.item_code,
        m.item_name,
        m.quantity_in,
        m.quantity_out,
        SUM(m.quantity_in - m.quantity_out) OVER (
            PARTITION BY m.item_id ORDER BY m.transaction_date, m.transaction_id
        ) as running_balance
    FROM movements m
    ORDER BY m.transaction_date DESC, m.item_code;
END;
$$ LANGUAGE plpgsql;
