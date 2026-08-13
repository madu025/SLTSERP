-- =============================================================
-- Migration: ERP Trigger & Function Gap Remediation
-- Purpose: Close audit-identified gaps across Finance, Project,
--          Vehicle, and Inventory domains
-- Date: 2026-08-13
-- =============================================================

-- ─── P0-1: AuditLog Immutability Trigger ─────────────────────
-- Blocks UPDATE and DELETE on AuditLog to ensure tamper-proof trail

CREATE OR REPLACE FUNCTION fn_audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: AuditLog records cannot be updated. Attempted on id=%', NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: AuditLog records cannot be deleted. Attempted on id=%', OLD.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON "AuditLog";
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION fn_audit_log_immutable();


-- ─── P0-2: FiscalPeriod Lock Guard Trigger ───────────────────
-- Prevents status change from LOCKED back to OPEN

CREATE OR REPLACE FUNCTION fn_fiscal_period_lock_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'LOCKED' AND NEW.status != 'LOCKED' THEN
        RAISE EXCEPTION 'FISCAL_PERIOD_LOCKED: Cannot change status of locked period %-% from LOCKED to %',
            NEW.year, NEW.month, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiscal_period_lock ON "FiscalPeriod";
CREATE TRIGGER trg_fiscal_period_lock
BEFORE UPDATE ON "FiscalPeriod"
FOR EACH ROW
EXECUTE FUNCTION fn_fiscal_period_lock_guard();


-- ─── P0-3: JournalEntry Balance Validation Trigger ───────────
-- BEFORE UPDATE on JournalEntry: when status changes to POSTED,
-- validate that SUM(debit) = SUM(credit) across JournalLines

CREATE OR REPLACE FUNCTION fn_journal_balance_check()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debit DECIMAL;
    v_total_credit DECIMAL;
    v_line_count INT;
BEGIN
    -- Only validate when transitioning to POSTED
    IF NEW.status = 'POSTED' AND (OLD.status IS DISTINCT FROM 'POSTED') THEN
        SELECT COUNT(*),
               COALESCE(SUM(debit), 0),
               COALESCE(SUM(credit), 0)
        INTO v_line_count, v_total_debit, v_total_credit
        FROM "JournalLine"
        WHERE "entryId" = NEW.id;

        IF v_line_count = 0 THEN
            RAISE EXCEPTION 'JOURNAL_NO_LINES: JournalEntry % must have at least one line before posting', NEW.id;
        END IF;

        IF v_total_debit != v_total_credit THEN
            RAISE EXCEPTION 'JOURNAL_UNBALANCED: JournalEntry % has debit=% credit=% (difference=%). Must balance before posting.',
                NEW.id, v_total_debit, v_total_credit, ABS(v_total_debit - v_total_credit);
        END IF;
    END IF;

    -- Block revert from POSTED to DRAFT (only REVERSED allowed via proper reversal flow)
    IF OLD.status = 'POSTED' AND NEW.status = 'DRAFT' THEN
        RAISE EXCEPTION 'JOURNAL_POSTED_IMMUTABLE: Cannot revert POSTED journal % to DRAFT. Use reversal flow instead.', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entry_balance_check ON "JournalEntry";
CREATE TRIGGER trg_journal_entry_balance_check
BEFORE UPDATE ON "JournalEntry"
FOR EACH ROW
EXECUTE FUNCTION fn_journal_balance_check();


-- ─── P2-1: Project Progress Auto-Calculate Trigger ───────────
-- AFTER UPDATE on ProjectStageInstance: when status changes,
-- recalculate parent Project.progress automatically

CREATE OR REPLACE FUNCTION fn_project_progress_calculate(p_project_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total_stages INT;
    v_completed INT;
    v_in_progress INT;
    v_progress DECIMAL;
BEGIN
    SELECT COUNT(*)::INT INTO v_total_stages
    FROM "ProjectStageInstance" psi
    JOIN "ProjectWorkflowInstance" pwi ON psi."projectWorkflowInstanceId" = pwi.id
    WHERE pwi."projectId" = p_project_id;

    IF v_total_stages = 0 THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*)::INT INTO v_completed
    FROM "ProjectStageInstance" psi
    JOIN "ProjectWorkflowInstance" pwi ON psi."projectWorkflowInstanceId" = pwi.id
    WHERE pwi."projectId" = p_project_id AND psi.status = 'COMPLETED';

    SELECT COUNT(*)::INT INTO v_in_progress
    FROM "ProjectStageInstance" psi
    JOIN "ProjectWorkflowInstance" pwi ON psi."projectWorkflowInstanceId" = pwi.id
    WHERE pwi."projectId" = p_project_id AND psi.status = 'IN_PROGRESS';

    v_progress := LEAST(100, ROUND(
        (v_completed::DECIMAL / v_total_stages * 100) +
        (CASE WHEN v_in_progress > 0 THEN (1.0::DECIMAL / v_total_stages * 50) ELSE 0 END)
    ));

    RETURN v_progress;
END;
$$ LANGUAGE plpgsql STRICT;

CREATE OR REPLACE FUNCTION fn_stage_status_cascade()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
    v_progress DECIMAL;
    v_new_status TEXT;
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    SELECT pwi."projectId" INTO v_project_id
    FROM "ProjectWorkflowInstance" pwi
    WHERE pwi.id = NEW."projectWorkflowInstanceId";

    IF v_project_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_progress := fn_project_progress_calculate(v_project_id);

    -- Determine auto-status
    IF v_progress >= 100 THEN
        v_new_status := 'COMPLETED';
    ELSIF v_progress > 0 THEN
        SELECT p.status INTO v_new_status FROM "Project" p WHERE p.id = v_project_id;
        IF v_new_status = 'PLANNING' THEN
            v_new_status := 'IN_PROGRESS';
        ELSE
            v_new_status := NULL; -- Keep existing
        END IF;
    ELSE
        v_new_status := NULL;
    END IF;

    IF v_new_status IS NOT NULL THEN
        UPDATE "Project"
        SET progress = v_progress,
            status = v_new_status::"ProjectStatus",
            "endDate" = CASE WHEN v_progress >= 100 AND "endDate" IS NULL THEN NOW() ELSE "endDate" END,
            "updatedAt" = NOW()
        WHERE id = v_project_id;
    ELSE
        UPDATE "Project"
        SET progress = v_progress,
            "updatedAt" = NOW()
        WHERE id = v_project_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stage_status_cascade ON "ProjectStageInstance";
CREATE TRIGGER trg_stage_status_cascade
AFTER UPDATE ON "ProjectStageInstance"
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION fn_stage_status_cascade();


-- ─── P2-2: Cash Book Report Function ─────────────────────────
-- Replaces JS loop in bank-cash.service.ts:46-119
-- Returns cash book rows with running balance via window functions

CREATE OR REPLACE FUNCTION fn_cash_book_report(
    p_gl_account_code TEXT,
    p_from TIMESTAMP DEFAULT NULL,
    p_to TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    entry_id UUID,
    entry_date TIMESTAMP,
    reference_type TEXT,
    reference_id TEXT,
    description TEXT,
    debit DECIMAL,
    credit DECIMAL,
    running_balance DECIMAL
) AS $$
DECLARE
    v_opening_balance DECIMAL := 0;
BEGIN
    -- Calculate opening balance before fromDate
    IF p_from IS NOT NULL THEN
        SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
        INTO v_opening_balance
        FROM "JournalLine" jl
        JOIN "JournalEntry" je ON jl."entryId" = je.id
        WHERE jl."accountCode" = p_gl_account_code
          AND je.status != 'REVERSED'
          AND je.date < p_from;
    END IF;

    RETURN QUERY
    WITH period_lines AS (
        SELECT
            jl.id,
            jl."entryId",
            je.date AS entry_date,
            je."referenceType",
            je."referenceId",
            COALESCE(jl.description, je.description) AS description,
            jl.debit,
            jl.credit,
            SUM(jl.debit - jl.credit) OVER (ORDER BY je.date ASC, jl.id ASC) AS cum_balance
        FROM "JournalLine" jl
        JOIN "JournalEntry" je ON jl."entryId" = je.id
        WHERE jl."accountCode" = p_gl_account_code
          AND je.status != 'REVERSED'
          AND (p_from IS NULL OR je.date >= p_from)
          AND (p_to IS NULL OR je.date <= p_to)
        ORDER BY je.date ASC, jl.id ASC
    )
    SELECT
        pl.id,
        pl."entryId",
        pl.entry_date,
        pl."referenceType",
        pl."referenceId",
        pl.description,
        pl.debit,
        pl.credit,
        v_opening_balance + pl.cum_balance AS running_balance
    FROM period_lines pl;
END;
$$ LANGUAGE plpgsql;


-- ─── P2-3: Asset Register Summary Function ───────────────────
-- Replaces JS loop in fixed-asset.service.ts:64-88

CREATE OR REPLACE FUNCTION fn_asset_register_summary()
RETURNS TABLE (
    total_cost DECIMAL,
    total_accumulated_depreciation DECIMAL,
    total_net_book_value DECIMAL,
    active_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(cost), 0)::DECIMAL AS total_cost,
        COALESCE(SUM("accumulatedDepreciation"), 0)::DECIMAL AS total_accumulated_depreciation,
        COALESCE(SUM("netBookValue"), 0)::DECIMAL AS total_net_book_value,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::INT AS active_count
    FROM "FixedAsset";
END;
$$ LANGUAGE plpgsql;


-- ─── P2-4: Trial Balance Function ────────────────────────────
-- Replaces JS aggregation in LedgerReportService.getAccountBalances()

CREATE OR REPLACE FUNCTION fn_trial_balance(
    p_from TIMESTAMP DEFAULT NULL,
    p_to TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    account_code TEXT,
    account_name TEXT,
    account_type TEXT,
    total_debit DECIMAL,
    total_credit DECIMAL,
    closing_balance DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        coa.code AS account_code,
        coa.name AS account_name,
        coa.type::TEXT AS account_type,
        COALESCE(SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END), 0)::DECIMAL AS total_debit,
        COALESCE(SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END), 0)::DECIMAL AS total_credit,
        COALESCE(SUM(jl.debit - jl.credit), 0)::DECIMAL AS closing_balance
    FROM "ChartOfAccount" coa
    LEFT JOIN "JournalLine" jl ON jl."accountCode" = coa.code
    LEFT JOIN "JournalEntry" je ON jl."entryId" = je.id AND je.status != 'REVERSED'
        AND (p_from IS NULL OR je.date >= p_from)
        AND (p_to IS NULL OR je.date <= p_to)
    WHERE coa."isActive" = TRUE
    GROUP BY coa.code, coa.name, coa.type
    ORDER BY coa.code;
END;
$$ LANGUAGE plpgsql;


-- ─── P2-5: Vehicle Utilization Summary Function ──────────────
-- Replaces JS .reduce() in VehicleService.ts:334-346

CREATE OR REPLACE FUNCTION fn_vehicle_utilization_summary(
    p_vehicle_id UUID,
    p_from TIMESTAMP DEFAULT NULL,
    p_to TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    total_trips INT,
    total_distance_km DECIMAL,
    total_fuel_consumed_liters DECIMAL,
    total_fuel_cost DECIMAL,
    average_efficiency_km_per_liter DECIMAL,
    cost_per_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(t.trip_count, 0)::INT AS total_trips,
        COALESCE(t.total_dist, 0)::DECIMAL AS total_distance_km,
        COALESCE(f.total_fuel, 0)::DECIMAL AS total_fuel_consumed_liters,
        COALESCE(f.total_cost, 0)::DECIMAL AS total_fuel_cost,
        CASE
            WHEN COALESCE(f.total_fuel, 0) > 0
            THEN ROUND(COALESCE(t.total_dist, 0) / f.total_fuel, 2)::DECIMAL
            ELSE 0::DECIMAL
        END AS average_efficiency_km_per_liter,
        CASE
            WHEN COALESCE(t.total_dist, 0) > 0
            THEN ROUND(COALESCE(f.total_cost, 0) / t.total_dist, 2)::DECIMAL
            ELSE 0::DECIMAL
        END AS cost_per_km
    FROM (
        SELECT
            COUNT(*)::INT AS trip_count,
            SUM("actual_distance_km") AS total_dist
        FROM "VMTrip"
        WHERE vehicle_id = p_vehicle_id
          AND trip_status = 'COMPLETED'
          AND (p_from IS NULL OR "actual_start_time" >= p_from)
          AND (p_to IS NULL OR "actual_start_time" <= p_to)
    ) t
    CROSS JOIN LATERAL (
        SELECT
            SUM(quantity_liters) AS total_fuel,
            SUM(total_cost) AS total_cost
        FROM "VMFuelLog"
        WHERE vehicle_id = p_vehicle_id
          AND (p_from IS NULL OR fuel_date >= p_from)
          AND (p_to IS NULL OR fuel_date <= p_to)
    ) f;
END;
$$ LANGUAGE plpgsql STRICT;


-- ─── P3-1: Inventory Batch Expiry Alert Function ─────────────
-- Returns batches expiring within N days for notification

CREATE OR REPLACE FUNCTION fn_expiring_batch_alerts(
    p_store_id UUID DEFAULT NULL,
    p_days_ahead INT DEFAULT 30
)
RETURNS TABLE (
    batch_id UUID,
    batch_number TEXT,
    item_id UUID,
    item_name TEXT,
    store_id UUID,
    store_name TEXT,
    quantity DECIMAL,
    expiry_date TIMESTAMP,
    days_until_expiry INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id AS batch_id,
        b."batchNumber",
        b."itemId",
        i.name AS item_name,
        bs."storeId",
        s.name AS store_name,
        bs.quantity,
        b."expiryDate",
        (b."expiryDate"::DATE - CURRENT_DATE)::INT AS days_until_expiry
    FROM "InventoryBatch" b
    JOIN "InventoryBatchStock" bs ON bs."batchId" = b.id
    JOIN "InventoryItem" i ON i.id = b."itemId"
    JOIN "InventoryStore" s ON s.id = bs."storeId"
    WHERE b."expiryDate" IS NOT NULL
      AND b."expiryDate" <= NOW() + (p_days_ahead || ' days')::INTERVAL
      AND b."expiryDate" > NOW()
      AND bs.quantity > 0
      AND (p_store_id IS NULL OR bs."storeId" = p_store_id)
    ORDER BY b."expiryDate" ASC;
END;
$$ LANGUAGE plpgsql;
