-- =============================================================
-- Migration P0-2: Inventory Automation Triggers & Functions
-- Purpose: SHA-256 checksum, document numbers, FIFO picking,
--          cycle count variance - all at DB level
-- Date: 2026-08-11
-- =============================================================


-- ─── P0-1: SHA-256 Auto-Checksum Trigger on InventoryLedger ──
-- Replaces JS crypto.createHash('sha256') in audit-ledger.service.ts
-- Uses pgcrypto digest() - already installed (v1.3)
-- Auto-fetches previous checksum for hash chaining

CREATE OR REPLACE FUNCTION fn_auto_ledger_checksum()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_checksum TEXT;
    v_payload TEXT;
BEGIN
    -- Fetch previous checksum for hash chain (latest entry for same store+item)
    SELECT checksum INTO v_prev_checksum
    FROM "InventoryLedger"
    WHERE "storeId" = NEW."storeId"
      AND "itemId" = NEW."itemId"
    ORDER BY "createdAt" DESC
    LIMIT 1;

    -- Default to 'GENESIS' if no previous entry
    IF v_prev_checksum IS NULL THEN
        v_prev_checksum := 'GENESIS';
    END IF;

    -- Set previousChecksum if not already provided
    IF NEW."previousChecksum" IS NULL THEN
        NEW."previousChecksum" := v_prev_checksum;
    END IF;

    -- Build payload: storeId:itemId:quantityAfter:createdAt:previousChecksum
    v_payload := NEW."storeId" || ':' ||
                 NEW."itemId" || ':' ||
                 NEW."quantityAfter"::TEXT || ':' ||
                 NEW."createdAt"::TEXT || ':' ||
                 COALESCE(NEW."previousChecksum", 'GENESIS');

    -- Compute SHA-256 using pgcrypto
    NEW.checksum := encode(digest(v_payload, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_ledger_checksum ON "InventoryLedger";
CREATE TRIGGER trg_auto_ledger_checksum
BEFORE INSERT ON "InventoryLedger"
FOR EACH ROW
EXECUTE FUNCTION fn_auto_ledger_checksum();


-- ─── P0-2: Atomic Document Number Generation ─────────────────
-- Replaces JS DocumentCounter.upsert + increment in audit-ledger.service.ts
-- Usage: SELECT fn_next_document_number('MIN');
-- Returns: MIN-2026-08-0042

CREATE OR REPLACE FUNCTION fn_next_document_number(
    p_type TEXT
)
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

    -- Atomic upsert: increment sequence or create new counter
    INSERT INTO "DocumentCounter" (type, period, sequence)
    VALUES (p_type, v_period, 1)
    ON CONFLICT (type, period)
    DO UPDATE SET sequence = "DocumentCounter".sequence + 1
    RETURNING sequence INTO v_seq;

    RETURN p_type || '-' || v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;


-- ─── P0-3a: FIFO Store Batch Picking RPC Function ────────────
-- Replaces JS pickStoreBatchesFIFO() in stock.service.ts
-- Orders by expiryDate ASC (nulls last), then createdAt ASC (FEFO)
-- Usage: SELECT * FROM fn_fifo_pick_store_batches(store_id, item_id, 50);

CREATE OR REPLACE FUNCTION fn_fifo_pick_store_batches(
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
    v_remaining DECIMAL;
    v_take DECIMAL;
BEGIN
    v_remaining := p_required_qty;

    -- Cursor: FIFO order (expiry ASC nulls last, then createdAt ASC)
    FOR batch_id, available_qty, batch_created_at, batch_expiry_date, cost_price, unit_price IN
        SELECT
            bs."batchId",
            bs.quantity,
            b."createdAt",
            b."expiryDate",
            b."costPrice",
            b."unitPrice"
        FROM "InventoryBatchStock" bs
        JOIN "InventoryBatch" b ON bs."batchId" = b.id
        WHERE bs."storeId" = p_store_id
          AND bs."itemId" = p_item_id
          AND bs.quantity > 0
        ORDER BY b."expiryDate" ASC NULLS LAST, b."createdAt" ASC
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_take := LEAST(available_qty, v_remaining);
        pick_qty := v_take;

        RETURN NEXT;

        v_remaining := v_remaining - v_take;
    END LOOP;

    -- If remaining > 0, return a shortage row (batch_id = NULL)
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
$$ LANGUAGE plpgsql;


-- ─── P0-3b: FIFO Contractor Batch Picking RPC Function ───────
-- Replaces JS pickContractorBatchesFIFO() in stock.service.ts
-- Usage: SELECT * FROM fn_fifo_pick_contractor_batches(contractor_id, item_id, 50);

CREATE OR REPLACE FUNCTION fn_fifo_pick_contractor_batches(
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
    v_remaining DECIMAL;
    v_take DECIMAL;
BEGIN
    v_remaining := p_required_qty;

    FOR batch_id, available_qty, batch_created_at, cost_price, unit_price IN
        SELECT
            cbs."batchId",
            cbs.quantity,
            b."createdAt",
            b."costPrice",
            b."unitPrice"
        FROM "ContractorBatchStock" cbs
        JOIN "InventoryBatch" b ON cbs."batchId" = b.id
        WHERE cbs."contractorId" = p_contractor_id
          AND cbs."itemId" = p_item_id
          AND cbs.quantity > 0
        ORDER BY b."createdAt" ASC
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
$$ LANGUAGE plpgsql;


-- ─── P0-4: Cycle Count Variance Auto-Calc Trigger ────────────
-- Replaces JS varianceQty = countedQty - systemQty in cycle-count.service.ts
-- Auto-calculates varianceQty and varianceValue on INSERT/UPDATE

CREATE OR REPLACE FUNCTION fn_calc_cycle_variance()
RETURNS TRIGGER AS $$
BEGIN
    NEW."varianceQty" := NEW."countedQty" - NEW."systemQty";
    NEW."varianceValue" := NEW."varianceQty" * NEW."unitCost";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cycle_count_variance ON "CycleCountLine";
CREATE TRIGGER trg_cycle_count_variance
BEFORE INSERT OR UPDATE ON "CycleCountLine"
FOR EACH ROW
EXECUTE FUNCTION fn_calc_cycle_variance();
