-- Fix inventory valuation: use actual PO procurement cost instead of empty InventoryItem.unitPrice
-- Root cause: InventoryItem.unitPrice is 0 for all items; real prices exist in PurchaseOrderItem
-- Solution: Weighted average PO price per item via StockRequestItem -> InventoryItem chain

-- 1. Fix fn_store_material_balance: per-item stock valuation with PO cost
CREATE OR REPLACE FUNCTION fn_store_material_balance(
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
        SELECT sri."itemId",
               ROUND(AVG(poi."unitPrice")::numeric, 2) as avg_price
        FROM "PurchaseOrderItem" poi
        JOIN "StockRequestItem" sri ON sri.id = poi."stockRequestItemId"
        WHERE poi."unitPrice" > 0
        GROUP BY sri."itemId"
    )
    SELECT
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
    LEFT JOIN item_prices ip ON ip."itemId" = s."itemId"
    WHERE s."storeId" = p_store_id
      AND (p_category IS NULL OR i.category = p_category)
    ORDER BY i.name;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix fn_store_inventory_value: category-wise valuation with PO cost
CREATE OR REPLACE FUNCTION fn_store_inventory_value(p_store_id UUID)
RETURNS TABLE(
    category TEXT, item_count INTEGER, total_quantity NUMERIC, total_value NUMERIC
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
        i.category,
        COUNT(DISTINCT s."itemId")::INT as item_count,
        SUM(s.quantity) as total_quantity,
        ROUND(SUM(s.quantity * COALESCE(ip.avg_price, i."unitPrice", 0))::numeric, 2) as total_value
    FROM "InventoryStock" s
    JOIN "InventoryItem" i ON s."itemId" = i.id
    LEFT JOIN item_prices ip ON ip."itemId" = s."itemId"
    WHERE s."storeId" = p_store_id
      AND s.quantity > 0
    GROUP BY i.category
    ORDER BY total_value DESC;
END;
$$ LANGUAGE plpgsql;
