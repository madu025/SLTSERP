-- =============================================================
-- Migration: Inventory Triggers & Functions
-- Purpose: Move stock balance logic from app layer to PostgreSQL
-- Date: 2026-08-11
-- =============================================================

-- ─── 1. PreErpMaterialBalance Auto-Calculation Trigger ───────
-- Automatically computes totalInHand, totalUsage, closingBalance
-- Formula: totalInHand = carryForward + received
--          totalUsage = usage + wastage + faulty
--          closingBalance = totalInHand - totalUsage
-- Replaces JS calculation in pre-erp-reconciliation.service.ts

CREATE OR REPLACE FUNCTION fn_pre_erp_auto_calc()
RETURNS TRIGGER AS $$
BEGIN
    NEW."totalInHandQuantity" := NEW."carryForwardQuantity" + NEW."receivedQuantity";
    NEW."totalUsageQuantity" := NEW."usageQuantity" + NEW."wastageQuantity" + NEW."faultyQuantity";
    NEW."closingBalanceQuantity" := NEW."totalInHandQuantity" - NEW."totalUsageQuantity";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pre_erp_auto_calc ON "PreErpMaterialBalance";
CREATE TRIGGER trg_pre_erp_auto_calc
BEFORE INSERT OR UPDATE ON "PreErpMaterialBalance"
FOR EACH ROW
EXECUTE FUNCTION fn_pre_erp_auto_calc();


-- ─── 2. Negative Stock Prevention Trigger ────────────────────
-- Prevents InventoryStock from going below zero
-- Replaces missing validation in app layer

CREATE OR REPLACE FUNCTION fn_prevent_negative_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_current_qty DECIMAL;
    v_change DECIMAL;
    v_new_qty DECIMAL;
BEGIN
    -- Determine the quantity change
    IF TG_OP = 'INSERT' THEN
        v_new_qty := NEW.quantity;
    ELSIF TG_OP = 'UPDATE' THEN
        v_new_qty := NEW.quantity;
    END IF;

    IF v_new_qty < 0 THEN
        RAISE EXCEPTION 'NEGATIVE_STOCK_PREVENTED: Stock for store=% item=% would go to % (current=%). Operation blocked.',
            NEW."storeId", NEW."itemId", v_new_qty, COALESCE(OLD.quantity, 0)
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_negative_stock ON "InventoryStock";
CREATE TRIGGER trg_prevent_negative_stock
BEFORE INSERT OR UPDATE ON "InventoryStock"
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_negative_stock();


-- ── 3. Contractor Balance Sheet RPC Function ────────────────
-- Replaces ContractorInventoryService.getTeamWiseMaterialBalance()
-- Returns balance sheet rows for a contractor/team/month

CREATE OR REPLACE FUNCTION fn_contractor_balance_sheet(
    p_contractor_id UUID,
    p_team_id UUID DEFAULT NULL,
    p_month TEXT DEFAULT NULL,
    p_year INT DEFAULT NULL
)
RETURNS TABLE (
    item_id UUID,
    item_code TEXT,
    item_name TEXT,
    unit TEXT,
    team_name TEXT,
    opening_stock DECIMAL,
    store_receipts DECIMAL,
    sod_consumptions DECIMAL,
    allowed_wastage DECIMAL,
    closing_balance DECIMAL,
    variance DECIMAL,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH contractor_stocks AS (
        SELECT
            cs."itemId",
            cs.quantity as van_stock,
            i.code,
            i.name,
            i.unit,
            i."isWastageAllowed",
            i."maxWastagePercentage"
        FROM "ContractorStock" cs
        JOIN "InventoryItem" i ON cs."itemId" = i.id
        WHERE cs."contractorId" = p_contractor_id
    ),
    sod_consumptions AS (
        SELECT
            su."itemId",
            SUM(su.quantity) as total_consumed
        FROM "SODMaterialUsage" su
        JOIN "ServiceOrder" so ON su."serviceOrderId" = so.id
        WHERE so."contractorId" = p_contractor_id
          AND (p_team_id IS NULL OR so."teamId" = p_team_id)
          AND (p_month IS NULL OR to_char(so."completedDate", 'YYYY-MM') = p_month)
          AND so."sltsStatus" = 'COMPLETED'
        GROUP BY su."itemId"
    ),
    wastage_data AS (
        SELECT
            wi."itemId",
            SUM(wi.quantity) as total_wastage
        FROM "ContractorWastageItem" wi
        JOIN "ContractorWastage" w ON wi."wastageId" = w.id
        WHERE w."contractorId" = p_contractor_id
        GROUP BY wi."itemId"
    )
    SELECT
        cs."itemId" as item_id,
        cs.code as item_code,
        cs.name as item_name,
        cs.unit,
        CASE
            WHEN p_team_id IS NOT NULL THEN 'Selected Team'
            ELSE 'All Contractor Teams'
        END as team_name,
        0::numeric as opening_stock,
        ROUND((cs.van_stock + COALESCE(sc.total_consumed, 0) + COALESCE(
            CASE WHEN cs."isWastageAllowed" THEN COALESCE(sc.total_consumed, 0) * 0.05 ELSE 0 END,
            COALESCE(wd.total_wastage, 0)
        ))::numeric, 2) as store_receipts,
        ROUND(COALESCE(sc.total_consumed, 0)::numeric, 2) as sod_consumptions,
        ROUND(COALESCE(
            CASE WHEN wd.total_wastage > 0 THEN wd.total_wastage
                 WHEN cs."isWastageAllowed" THEN COALESCE(sc.total_consumed, 0) * 0.05
                 ELSE 0
            END, 0
        )::numeric, 2) as allowed_wastage,
        ROUND(cs.van_stock::numeric, 2) as closing_balance,
        0::numeric as variance,
        CASE
            WHEN cs.van_stock < 5 THEN 'LOW_STOCK_WARNING'
            WHEN COALESCE(
                CASE WHEN wd.total_wastage > 0 THEN wd.total_wastage
                     WHEN cs."isWastageAllowed" THEN COALESCE(sc.total_consumed, 0) * 0.05
                     ELSE 0
                END, 0
            ) > COALESCE(sc.total_consumed, 0) * 0.1 THEN 'HIGH_WASTAGE'
            ELSE 'RECONCILED'
        END as status
    FROM contractor_stocks cs
    LEFT JOIN sod_consumptions sc ON cs."itemId" = sc."itemId"
    LEFT JOIN wastage_data wd ON cs."itemId" = wd."itemId"
    ORDER BY cs.name;
END;
$$ LANGUAGE plpgsql;


-- ─── 4. Store Material Balance RPC Function ──────────────────
-- Returns current stock levels with reorder alerts for a store

CREATE OR REPLACE FUNCTION fn_store_material_balance(
    p_store_id UUID,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    item_id UUID,
    item_code TEXT,
    item_name TEXT,
    current_stock DECIMAL,
    allocated_stock DECIMAL,
    available_stock DECIMAL,
    min_level DECIMAL,
    reorder_needed BOOLEAN,
    total_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s."itemId" as item_id,
        i.code as item_code,
        i.name as item_name,
        s.quantity as current_stock,
        s."allocatedQuantity" as allocated_stock,
        (s.quantity - s."allocatedQuantity") as available_stock,
        s."minLevel" as min_level,
        (s.quantity - s."allocatedQuantity") <= s."minLevel" as reorder_needed,
        ROUND((s.quantity * COALESCE(i."unitPrice", 0))::numeric, 2) as total_value
    FROM "InventoryStock" s
    JOIN "InventoryItem" i ON s."itemId" = i.id
    WHERE s."storeId" = p_store_id
      AND (p_category IS NULL OR i.category = p_category)
    ORDER BY i.name;
END;
$$ LANGUAGE plpgsql;


-- ─── 5. Expiring Batches RPC Function ────────────────────────
-- Returns batches expiring within N days for a store

CREATE OR REPLACE FUNCTION fn_expiring_batches(
    p_store_id UUID,
    p_days_ahead INT DEFAULT 30
)
RETURNS TABLE (
    batch_id UUID,
    batch_number TEXT,
    item_code TEXT,
    item_name TEXT,
    quantity DECIMAL,
    expiry_date TIMESTAMP,
    days_until_expiry INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
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
    WHERE bs."storeId" = p_store_id
      AND b."expiryDate" IS NOT NULL
      AND b."expiryDate" <= (CURRENT_DATE + p_days_ahead)
      AND bs.quantity > 0
    ORDER BY b."expiryDate" ASC;
END;
$$ LANGUAGE plpgsql;


-- ─── 6. Low Stock Alert RPC Function ─────────────────────────
-- Returns items below minimum stock level for a store

CREATE OR REPLACE FUNCTION fn_low_stock_alerts(
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
        s."itemId" as item_id,
        i.code as item_code,
        i.name as item_name,
        s.quantity as current_stock,
        s."minLevel" as min_level,
        (s."minLevel" - s.quantity) as deficit
    FROM "InventoryStock" s
    JOIN "InventoryItem" i ON s."itemId" = i.id
    WHERE s."storeId" = p_store_id
      AND s.quantity <= s."minLevel"
    ORDER BY (s."minLevel" - s.quantity) DESC;
END;
$$ LANGUAGE plpgsql;


-- ─── 7. Inventory Value Summary RPC Function ─────────────────
-- Returns total inventory value by category for a store

CREATE OR REPLACE FUNCTION fn_store_inventory_value(
    p_store_id UUID
)
RETURNS TABLE (
    category TEXT,
    item_count INT,
    total_quantity DECIMAL,
    total_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.category,
        COUNT(DISTINCT s."itemId")::INT as item_count,
        SUM(s.quantity) as total_quantity,
        ROUND(SUM(s.quantity * COALESCE(i."unitPrice", 0))::numeric, 2) as total_value
    FROM "InventoryStock" s
    JOIN "InventoryItem" i ON s."itemId" = i.id
    WHERE s."storeId" = p_store_id
      AND s.quantity > 0
    GROUP BY i.category
    ORDER BY total_value DESC;
END;
$$ LANGUAGE plpgsql;
