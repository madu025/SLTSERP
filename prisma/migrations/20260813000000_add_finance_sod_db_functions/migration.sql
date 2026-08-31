-- =============================================================
-- Migration: Phase 1 DB Function Optimization
-- Purpose: Reduce system stress by moving heavy computation
--          from JS to PostgreSQL for Finance and SOD modules
-- Date: 2026-08-13
-- =============================================================

-- ─── FINANCE MODULE: Journal Entry Validation ────────────────
-- Replaces 50+ DB round-trips in ledger.service.ts with 1-2 queries
-- Validates double-entry integrity + CoA resolution in single call

CREATE OR REPLACE FUNCTION fn_validate_journal_entry(
    p_lines JSONB
)
RETURNS TABLE (
    is_valid BOOLEAN,
    total_debit DECIMAL,
    total_credit DECIMAL,
    invalid_accounts TEXT[],
    error_message TEXT
) AS $$
DECLARE
    v_line_count INT;
    v_total_debit DECIMAL := 0;
    v_total_credit DECIMAL := 0;
    v_invalid_accounts TEXT[] := ARRAY[]::TEXT[];
    v_error_msg TEXT := NULL;
    v_line JSONB;
    v_account_code TEXT;
    v_debit DECIMAL;
    v_credit DECIMAL;
    v_coa_exists BOOLEAN;
    v_is_postable BOOLEAN;
    v_is_active BOOLEAN;
BEGIN
    -- Get line count
    v_line_count := jsonb_array_length(p_lines);
    
    IF v_line_count = 0 THEN
        is_valid := FALSE;
        total_debit := 0;
        total_credit := 0;
        invalid_accounts := ARRAY[]::TEXT[];
        error_message := 'Journal Entry must contain at least one line';
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Validate each line
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_account_code := v_line->>'accountCode';
        v_debit := COALESCE((v_line->>'debit')::DECIMAL, 0);
        v_credit := COALESCE((v_line->>'credit')::DECIMAL, 0);
        
        -- Check for negative amounts
        IF v_debit < 0 OR v_credit < 0 THEN
            is_valid := FALSE;
            total_debit := v_total_debit;
            total_credit := v_total_credit;
            invalid_accounts := v_invalid_accounts;
            error_message := 'Journal line debit and credit amounts must be non-negative';
            RETURN NEXT;
            RETURN;
        END IF;
        
        -- Accumulate totals
        v_total_debit := v_total_debit + v_debit;
        v_total_credit := v_total_credit + v_credit;
        
        -- Validate CoA account
        SELECT EXISTS(
            SELECT 1 FROM "ChartOfAccount" WHERE code = v_account_code
        ), 
        COALESCE((SELECT "isPostable" FROM "ChartOfAccount" WHERE code = v_account_code), FALSE),
        COALESCE((SELECT "isActive" FROM "ChartOfAccount" WHERE code = v_account_code), FALSE)
        INTO v_coa_exists, v_is_postable, v_is_active;
        
        IF NOT v_coa_exists THEN
            v_invalid_accounts := v_invalid_accounts || v_account_code;
        ELSIF NOT v_is_postable THEN
            v_invalid_accounts := v_invalid_accounts || (v_account_code || ' (non-postable)');
        ELSIF NOT v_is_active THEN
            v_invalid_accounts := v_invalid_accounts || (v_account_code || ' (inactive)');
        END IF;
    END LOOP;
    
    -- Check double-entry balance
    IF ABS(v_total_debit - v_total_credit) > 0.001 THEN
        is_valid := FALSE;
        total_debit := v_total_debit;
        total_credit := v_total_credit;
        invalid_accounts := v_invalid_accounts;
        error_message := FORMAT(
            'Unbalanced Journal Entry: Total Debit (%s) !== Total Credit (%s)',
            v_total_debit::TEXT, v_total_credit::TEXT
        );
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Check for invalid accounts
    IF array_length(v_invalid_accounts, 1) > 0 THEN
        is_valid := FALSE;
        total_debit := v_total_debit;
        total_credit := v_total_credit;
        invalid_accounts := v_invalid_accounts;
        error_message := FORMAT(
            'Unknown or invalid account codes: %s',
            array_to_string(v_invalid_accounts, ', ')
        );
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- All validations passed
    is_valid := TRUE;
    total_debit := v_total_debit;
    total_credit := v_total_credit;
    invalid_accounts := ARRAY[]::TEXT[];
    error_message := NULL;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;


-- ─── FINANCE MODULE: Bulk CoA Resolution ─────────────────────
-- Resolves multiple account codes in single query (N queries → 1)

CREATE OR REPLACE FUNCTION fn_resolve_coa_accounts(
    p_codes TEXT[]
)
RETURNS TABLE (
    code TEXT,
    account_id UUID,
    account_name TEXT,
    is_postable BOOLEAN,
    is_active BOOLEAN,
    is_valid BOOLEAN,
    error_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.code,
        c.id as account_id,
        c.name as account_name,
        c."isPostable",
        c."isActive",
        CASE
            WHEN c.id IS NULL THEN FALSE
            WHEN NOT c."isPostable" THEN FALSE
            WHEN NOT c."isActive" THEN FALSE
            ELSE TRUE
        END as is_valid,
        CASE
            WHEN c.id IS NULL THEN 'Account not found'
            WHEN NOT c."isPostable" THEN 'Non-postable (header) account'
            WHEN NOT c."isActive" THEN 'Inactive account'
            ELSE NULL
        END as error_reason
    FROM UNNEST(p_codes) AS input_code
    LEFT JOIN "ChartOfAccount" c ON c.code = input_code;
END;
$$ LANGUAGE plpgsql;


-- ─── SOD MODULE: Dashboard Summary ───────────────────────────
-- Replaces 5-8 separate queries with single DB function call
-- Zero-egress computation: all aggregation happens in PostgreSQL

CREATE OR REPLACE FUNCTION fn_sod_dashboard_summary(
    p_opmc_id UUID DEFAULT NULL,
    p_month INT DEFAULT NULL,
    p_year INT DEFAULT NULL
)
RETURNS TABLE (
    total_orders INT,
    completed_orders INT,
    pending_pat INT,
    pending_grn INT,
    invoiced_orders INT,
    total_revenue DECIMAL,
    total_material_cost DECIMAL,
    avg_completion_days DECIMAL,
    contractor_count INT
) AS $$
DECLARE
    v_date_filter TEXT;
BEGIN
    -- Build date filter
    IF p_month IS NOT NULL AND p_year IS NOT NULL THEN
        v_date_filter := TO_CHAR(p_year, 'FM9999') || '-' || LPAD(p_month::TEXT, 2, '0');
    ELSE
        v_date_filter := NULL;
    END IF;
    
    RETURN QUERY
    WITH filtered_sods AS (
        SELECT
            so.id,
            so."soNum",
            so."sltsStatus",
            so."completedDate",
            so."contractorId",
            so."opmcPatStatus",
            so."invoiced",
            so."revenueAmount",
            so."createdAt",
            CASE
                WHEN so."completedDate" IS NOT NULL AND so."receivedDate" IS NOT NULL
                THEN EXTRACT(DAY FROM so."completedDate" - so."receivedDate")
                ELSE NULL
            END as completion_days
        FROM "ServiceOrder" so
        WHERE (p_opmc_id IS NULL OR so."opmcId" = p_opmc_id)
          AND (v_date_filter IS NULL OR TO_CHAR(so."createdAt", 'YYYY-MM') = v_date_filter)
    ),
    material_costs AS (
        SELECT
            su."serviceOrderId",
            COALESCE(SUM(su.quantity * COALESCE(NULLIF(su."costPrice", 0), su."unitPrice", 0)), 0) as total_cost
        FROM "SODMaterialUsage" su
        WHERE su."serviceOrderId" IN (SELECT id FROM filtered_sods)
        GROUP BY su."serviceOrderId"
    )
    SELECT
        COUNT(*)::INT as total_orders,
        COUNT(*) FILTER (WHERE fs."sltsStatus" = 'COMPLETED')::INT as completed_orders,
        COUNT(*) FILTER (WHERE fs."opmcPatStatus" IS NULL OR fs."opmcPatStatus" = 'PENDING')::INT as pending_pat,
        COUNT(*) FILTER (WHERE fs."sltsStatus" IN ('INPROGRESS', 'COMPLETED') AND fs."completedDate" IS NOT NULL)::INT as pending_grn,
        COUNT(*) FILTER (WHERE fs."invoiced" = TRUE)::INT as invoiced_orders,
        ROUND(COALESCE(SUM(fs."revenueAmount"), 0)::NUMERIC, 2) as total_revenue,
        ROUND(COALESCE(SUM(mc.total_cost), 0)::NUMERIC, 2) as total_material_cost,
        ROUND(AVG(fs.completion_days)::NUMERIC, 1) as avg_completion_days,
        COUNT(DISTINCT fs."contractorId")::INT as contractor_count
    FROM filtered_sods fs
    LEFT JOIN material_costs mc ON mc."serviceOrderId" = fs.id;
END;
$$ LANGUAGE plpgsql;


-- ─── SOD MODULE: Material Usage Summary ──────────────────────
-- Aggregates material usage for a SOD in single query

CREATE OR REPLACE FUNCTION fn_sod_material_usage_summary(
    p_sod_id UUID
)
RETURNS TABLE (
    item_id UUID,
    item_code TEXT,
    item_name TEXT,
    unit TEXT,
    total_qty DECIMAL,
    total_cost DECIMAL,
    avg_unit_cost DECIMAL,
    usage_types TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        su."itemId",
        i.code as item_code,
        i.name as item_name,
        i.unit,
        ROUND(SUM(su.quantity)::NUMERIC, 2) as total_qty,
        ROUND(SUM(su.quantity * COALESCE(NULLIF(su."costPrice", 0), su."unitPrice", 0))::NUMERIC, 2) as total_cost,
        ROUND(AVG(COALESCE(NULLIF(su."costPrice", 0), su."unitPrice", 0))::NUMERIC, 2) as avg_unit_cost,
        ARRAY_AGG(DISTINCT su."usageType") as usage_types
    FROM "SODMaterialUsage" su
    JOIN "InventoryItem" i ON su."itemId" = i.id
    WHERE su."serviceOrderId" = p_sod_id
    GROUP BY su."itemId", i.code, i.name, i.unit
    ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;


-- ─── SOD MODULE: Contractor Performance Metrics ──────────────
-- Calculates contractor KPIs in single DB call

DROP FUNCTION IF EXISTS fn_contractor_performance_metrics(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION fn_contractor_performance_metrics(
    p_contractor_id UUID,
    p_from_date DATE DEFAULT NULL,
    p_to_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_sods INT,
    completed_sods INT,
    avg_completion_days DECIMAL,
    on_time_completion_pct DECIMAL,
    total_revenue DECIMAL,
    total_material_cost DECIMAL,
    avg_material_cost_pct DECIMAL,
    total_wastage_value DECIMAL,
    total_return_count INT,
    quality_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH contractor_sods AS (
        SELECT
            so.id,
            so."sltsStatus",
            so."revenueAmount",
            so."completedDate",
            so."receivedDate",
            CASE
                WHEN so."completedDate" IS NOT NULL AND so."receivedDate" IS NOT NULL
                THEN EXTRACT(DAY FROM so."completedDate" - so."receivedDate")
                ELSE NULL
            END as completion_days,
            CASE
                WHEN so."completedDate" IS NOT NULL AND so."receivedDate" IS NOT NULL
                THEN EXTRACT(DAY FROM so."completedDate" - so."receivedDate") <= 14
                ELSE NULL
            END as is_on_time
        FROM "ServiceOrder" so
        WHERE so."contractorId" = p_contractor_id
          AND (p_from_date IS NULL OR so."createdAt" >= p_from_date)
          AND (p_to_date IS NULL OR so."createdAt" <= p_to_date)
    ),
    sod_costs AS (
        SELECT
            su."serviceOrderId",
            COALESCE(SUM(su.quantity * COALESCE(NULLIF(su."costPrice", 0), su."unitPrice", 0)), 0) as material_cost
        FROM "SODMaterialUsage" su
        WHERE su."serviceOrderId" IN (SELECT id FROM contractor_sods)
          AND su."usageType" IN ('USED', 'USED_F1', 'USED_G1')
        GROUP BY su."serviceOrderId"
    ),
    wastage_totals AS (
        SELECT
            w."contractorId",
            COALESCE(SUM(wi.quantity * COALESCE(i."unitPrice", 0)), 0) as wastage_value
        FROM "ContractorWastageItem" wi
        JOIN "ContractorWastage" w ON wi."wastageId" = w.id
        JOIN "InventoryItem" i ON wi."itemId" = i.id
        WHERE w."contractorId" = p_contractor_id
          AND (p_from_date IS NULL OR w."createdAt" >= p_from_date)
          AND (p_to_date IS NULL OR w."createdAt" <= p_to_date)
        GROUP BY w."contractorId"
    ),
    return_counts AS (
        SELECT
            r."contractorId",
            COUNT(*)::INT as cnt
        FROM "ContractorMaterialReturn" r
        WHERE r."contractorId" = p_contractor_id
          AND (p_from_date IS NULL OR r."createdAt" >= p_from_date)
          AND (p_to_date IS NULL OR r."createdAt" <= p_to_date)
        GROUP BY r."contractorId"
    )
    SELECT
        COUNT(*)::INT as total_sods,
        COUNT(*) FILTER (WHERE cs."sltsStatus" = 'COMPLETED')::INT as completed_sods,
        ROUND(AVG(cs.completion_days)::NUMERIC, 1) as avg_completion_days,
        ROUND(
            (COUNT(*) FILTER (WHERE cs.is_on_time = TRUE)::DECIMAL / 
             NULLIF(COUNT(*) FILTER (WHERE cs.is_on_time IS NOT NULL), 0)) * 100,
            1
        ) as on_time_completion_pct,
        ROUND(COALESCE(SUM(cs."revenueAmount"), 0)::NUMERIC, 2) as total_revenue,
        ROUND(COALESCE(SUM(sc.material_cost), 0)::NUMERIC, 2) as total_material_cost,
        ROUND(
            (COALESCE(SUM(sc.material_cost), 0) / NULLIF(SUM(cs."revenueAmount"), 0)) * 100,
            1
        ) as avg_material_cost_pct,
        ROUND(COALESCE((SELECT wastage_value FROM wastage_totals), 0)::NUMERIC, 2) as total_wastage_value,
        COALESCE((SELECT cnt FROM return_counts), 0) as total_return_count,
        ROUND(
            CASE
                WHEN COUNT(*) FILTER (WHERE cs."sltsStatus" = 'COMPLETED') > 0 THEN
                    GREATEST(0, 100 - 
                        (COALESCE((SELECT wastage_value FROM wastage_totals), 0) / 
                         NULLIF(SUM(cs."revenueAmount"), 0)) * 100 * 2
                    )
                ELSE 0
            END::NUMERIC,
            1
        ) as quality_score
    FROM contractor_sods cs
    LEFT JOIN sod_costs sc ON sc."serviceOrderId" = cs.id;
END;
$$ LANGUAGE plpgsql;


-- ─── Index Optimization for New Functions ─────────────────────
-- Add indexes to support new DB function queries

CREATE INDEX IF NOT EXISTS idx_service_order_contractor_completed 
ON "ServiceOrder" ("contractorId", "sltsStatus") 
WHERE "sltsStatus" = 'COMPLETED';

CREATE INDEX IF NOT EXISTS idx_sod_material_usage_service_order 
ON "SODMaterialUsage" ("serviceOrderId") 
INCLUDE ("itemId", "quantity", "unitPrice", "costPrice", "usageType");

CREATE INDEX IF NOT EXISTS idx_chart_of_account_code_lookup 
ON "ChartOfAccount" (code) 
INCLUDE ("isPostable", "isActive", "name");
