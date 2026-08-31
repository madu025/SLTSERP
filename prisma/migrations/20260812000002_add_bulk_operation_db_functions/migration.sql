-- ============================================================================
-- P0-P1 Bulk DB Functions: Eliminate N+1 queries & JS-side computation
-- 8 functions covering inventory, fleet, GIS, and service-order hot paths
-- ============================================================================

-- 1. fn_bulk_stock_issue
-- Replaces: stock.service.ts createStockIssue N+1 loop
-- Accepts items as parallel arrays, does FIFO pick + batch decrement + stock
-- update + ledger entry + serial status change all in one atomic DB call.
CREATE OR REPLACE FUNCTION fn_bulk_stock_issue(
    p_store_id UUID,
    p_item_ids UUID[],
    p_quantities NUMERIC[],
    p_issued_by_id UUID,
    p_issue_number TEXT,
    p_issue_type TEXT,
    p_contractor_id UUID DEFAULT NULL,
    p_serials TEXT[][] DEFAULT '{}'::TEXT[]
)
RETURNS TABLE(item_id UUID, batch_id UUID, picked_qty NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
    i INT;
    j INT;
    v_item_id UUID;
    v_qty NUMERIC;
    v_stock_qty NUMERIC;
    v_picked_batch_id UUID;
    v_picked_qty NUMERIC;
    v_serials TEXT[];
    v_serial TEXT;
BEGIN
    IF array_length(p_item_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    FOR i IN 1..array_length(p_item_ids, 1) LOOP
        v_item_id := p_item_ids[i];
        v_qty := p_quantities[i];

        -- Validate sufficient stock
        SELECT COALESCE("quantity", 0) INTO v_stock_qty
        FROM "InventoryStock"
        WHERE "storeId" = p_store_id AND "itemId" = v_item_id;

        IF v_stock_qty IS NULL OR v_stock_qty < v_qty THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: item %', v_item_id;
        END IF;

        -- FIFO batch pick (reuses existing fn_fifo_pick_store_batches)
        FOR v_picked_batch_id, v_picked_qty IN
            SELECT batch_id, pick_qty FROM fn_fifo_pick_store_batches(p_store_id, v_item_id, v_qty)
        LOOP
            -- Decrement batch stock
            UPDATE "InventoryBatchStock"
            SET "quantity" = "quantity" - v_picked_qty
            WHERE "storeId" = p_store_id AND "batchId" = v_picked_batch_id;

            RETURN QUERY SELECT v_item_id, v_picked_batch_id, -v_picked_qty;
        END LOOP;

        -- Decrement global store stock
        UPDATE "InventoryStock"
        SET "quantity" = "quantity" - v_qty
        WHERE "storeId" = p_store_id AND "itemId" = v_item_id;

        -- Insert immutable ledger entry
        INSERT INTO "InventoryLedger"
            (id, "storeId", "itemId", "transactionType", "referenceType", "referenceId",
             "quantityBefore", "quantityChange", "quantityAfter", "performedById",
             "idempotencyKey", "checksum", "createdAt")
        SELECT
            uuid_generate_v7(),
            p_store_id,
            v_item_id,
            'STOCK_ISSUE',
            'StockIssue',
            p_issue_number,
            v_stock_qty,
            -v_qty,
            v_stock_qty - v_qty,
            p_issued_by_id,
            'stock-issue-' || p_issue_number || '-' || v_item_id::text,
            encode(sha256((uuid_generate_v7()::text || p_store_id::text || v_item_id::text || (v_stock_qty - v_qty)::text || now()::text)::bytea), 'hex'),
            now();

        -- Update serial statuses
        IF p_serials IS NOT NULL AND array_length(p_serials, 1) >= i THEN
            v_serials := p_serials[i];
            IF v_serials IS NOT NULL AND array_length(v_serials, 1) IS NOT NULL THEN
                FOR j IN 1..array_length(v_serials, 1) LOOP
                    v_serial := trim(v_serials[j]);
                    IF v_serial <> '' THEN
                        UPDATE "InventoryItemSerial"
                        SET status = 'ISSUED',
                            "storeId" = NULL,
                            "contractorId" = COALESCE(p_contractor_id, "contractorId")
                        WHERE "serialNumber" = v_serial;
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END LOOP;
END;
$$;


-- 2. fn_bulk_boq_actual_update
-- Replaces: project-stock-issue.service.ts N+1 loop (findFirst + update per item)
-- Single UPDATE with JOIN to increment actualQuantity and actualCost.
CREATE OR REPLACE FUNCTION fn_bulk_boq_actual_update(
    p_project_id UUID,
    p_item_ids UUID[],
    p_quantities NUMERIC[]
)
RETURNS INTEGER -- number of BOQ items updated
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INT := 0;
    i INT;
BEGIN
    IF array_length(p_item_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    FOR i IN 1..array_length(p_item_ids, 1) LOOP
        UPDATE "ProjectBOQItem"
        SET "actualQuantity" = "actualQuantity" + p_quantities[i],
            "actualCost" = "actualCost" + (p_quantities[i] * "unitRate")
        WHERE "projectId" = p_project_id
          AND "materialId" = p_item_ids[i];

        IF FOUND THEN
            v_updated := v_updated + 1;
        END IF;
    END LOOP;

    RETURN v_updated;
END;
$$;


-- 3. fn_bulk_stock_initialize
-- Replaces: stock.service.ts initializeStock N+1 loop
-- Accepts items as parallel arrays. For each item: upserts InventoryStock,
-- creates batch + batch stock if increasing.
CREATE OR REPLACE FUNCTION fn_bulk_stock_initialize(
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
    v_diff NUMERIC;
    v_cost_price NUMERIC;
    v_unit_price NUMERIC;
    v_batch_id UUID;
BEGIN
    IF array_length(p_item_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    FOR i IN 1..array_length(p_item_ids, 1) LOOP
        v_item_id := p_item_ids[i];
        v_new_qty := ROUND(p_quantities[i]::numeric, 4);

        -- Get current stock
        SELECT COALESCE("quantity", 0) INTO v_old_qty
        FROM "InventoryStock"
        WHERE "storeId" = p_store_id AND "itemId" = v_item_id;

        IF v_old_qty IS NULL THEN v_old_qty := 0; END IF;
        v_diff := ROUND(v_new_qty - v_old_qty, 4);

        IF v_diff = 0 THEN
            RETURN QUERY SELECT v_item_id, v_old_qty, v_new_qty;
            CONTINUE;
        END IF;

        IF v_diff > 0 THEN
            -- Get item prices
            SELECT COALESCE("costPrice", 0), COALESCE("unitPrice", 0)
            INTO v_cost_price, v_unit_price
            FROM "InventoryItem" WHERE id = v_item_id;

            -- Create batch
            v_batch_id := uuid_generate_v7();
            INSERT INTO "InventoryBatch" (id, "batchNumber", "itemId", "initialQty", "costPrice", "unitPrice", "createdAt")
            VALUES (v_batch_id, 'ADJ-' || extract(epoch from now())::bigint::text || i::text, v_item_id, v_diff, v_cost_price, v_unit_price, now());

            -- Create batch stock
            INSERT INTO "InventoryBatchStock" (id, "storeId", "itemId", "batchId", "quantity", "updatedAt")
            VALUES (uuid_generate_v7(), p_store_id, v_item_id, v_batch_id, v_diff, now());
        ELSE
            -- Decrease: FIFO pick
            FOR v_batch_id IN
                SELECT batch_id FROM fn_fifo_pick_store_batches(p_store_id, v_item_id, ABS(v_diff))
            LOOP
                UPDATE "InventoryBatchStock"
                SET "quantity" = GREATEST(0, "quantity" - ABS(v_diff))
                WHERE "storeId" = p_store_id AND "batchId" = v_batch_id;
            END LOOP;
        END IF;

        -- Upsert global stock
        INSERT INTO "InventoryStock" (id, "storeId", "itemId", "quantity", "createdAt", "updatedAt")
        VALUES (uuid_generate_v7(), p_store_id, v_item_id, v_new_qty, now(), now())
        ON CONFLICT ("storeId", "itemId")
        DO UPDATE SET "quantity" = v_new_qty, "updatedAt" = now();

        RETURN QUERY SELECT v_item_id, v_old_qty, v_new_qty;
    END LOOP;
END;
$$;


-- 4. fn_wastage_approval_check
-- Replaces: wastage.service.ts JS nested loop for approval computation
-- Returns single row with requires_approval, total_value, excess_details.
CREATE OR REPLACE FUNCTION fn_wastage_approval_check(
    p_contractor_id UUID,
    p_store_id UUID,
    p_month TEXT,
    p_item_ids UUID[],
    p_quantities NUMERIC[]
)
RETURNS TABLE(requires_approval BOOLEAN, total_wastage_value NUMERIC, excess_details TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    i INT;
    v_item_id UUID;
    v_qty NUMERIC;
    v_item_name TEXT;
    v_cost_price NUMERIC;
    v_is_wastage_allowed BOOLEAN;
    v_max_wastage_pct NUMERIC;
    v_total_issued NUMERIC;
    v_wastage_pct NUMERIC;
    v_total_value NUMERIC := 0;
    v_requires_approval BOOLEAN := FALSE;
    v_excess TEXT := '';
    v_excess_item TEXT;
BEGIN
    -- Contractor wastage ALWAYS requires approval
    IF p_contractor_id IS NOT NULL THEN
        v_requires_approval := TRUE;
    END IF;

    FOR i IN 1..array_length(p_item_ids, 1) LOOP
        v_item_id := p_item_ids[i];
        v_qty := p_quantities[i];

        -- Get item metadata
        SELECT name, COALESCE("costPrice", 0), COALESCE("isWastageAllowed", true),
               COALESCE("maxWastagePercentage", 0)
        INTO v_item_name, v_cost_price, v_is_wastage_allowed, v_max_wastage_pct
        FROM "InventoryItem" WHERE id = v_item_id;

        -- Accumulate wastage value
        v_total_value := v_total_value + (v_qty * v_cost_price);

        -- Check if wastage is not allowed for this item
        IF NOT v_is_wastage_allowed THEN
            v_requires_approval := TRUE;
        END IF;

        -- For contractor issues: check wastage percentage limits
        IF p_contractor_id IS NOT NULL THEN
            SELECT COALESCE(SUM(ci."quantity"), 0) INTO v_total_issued
            FROM "ContractorMaterialIssueItem" ci
            JOIN "ContractorMaterialIssue" mi ON mi.id = ci."issueId"
            WHERE mi."contractorId" = p_contractor_id
              AND mi."month" = p_month
              AND ci."itemId" = v_item_id;

            IF v_total_issued > 0 THEN
                v_wastage_pct := (v_qty / v_total_issued) * 100;
                IF v_wastage_pct > v_max_wastage_pct THEN
                    v_requires_approval := TRUE;
                    v_excess_item := v_item_name || ' (Wastage: ' || ROUND(v_wastage_pct::numeric, 1) || '% > Allowed: ' || ROUND(v_max_wastage_pct::numeric, 1) || '%)';
                    IF v_excess <> '' THEN v_excess := v_excess || '; '; END IF;
                    v_excess := v_excess || v_excess_item;
                END IF;
            ELSIF v_qty > 0 THEN
                v_requires_approval := TRUE;
                v_excess_item := v_item_name || ' (Wastage reported but no issues recorded)';
                IF v_excess <> '' THEN v_excess := v_excess || '; '; END IF;
                v_excess := v_excess || v_excess_item;
            END IF;
        END IF;
    END LOOP;

    -- Value-based approval threshold
    IF v_total_value > 10000 THEN
        v_requires_approval := TRUE;
    END IF;

    RETURN QUERY SELECT v_requires_approval, v_total_value, v_excess;
END;
$$;


-- 5. fn_bulk_pat_status_sync
-- Replaces: sod.sync.service.ts chunked Promise.all N+1 updates
-- Accepts parallel arrays of soNum + status + statusDate, single bulk UPDATE.
CREATE OR REPLACE FUNCTION fn_bulk_pat_status_sync(
    p_so_nums TEXT[],
    p_statuses TEXT[],
    p_status_dates TIMESTAMPTZ[]
)
RETURNS INTEGER -- number of rows updated
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INT := 0;
    i INT;
BEGIN
    IF array_length(p_so_nums, 1) IS NULL THEN
        RETURN 0;
    END IF;

    FOR i IN 1..array_length(p_so_nums, 1) LOOP
        UPDATE "ServiceOrder"
        SET "opmcPatStatus" = p_statuses[i]::"PatStatusEnum",
            "opmcPatDate" = p_status_dates[i],
            "isInvoicable" = CASE
                WHEN p_statuses[i] = 'PAT_PASSED'
                     AND "hoPatStatus" = 'PAT_PASSED'
                     AND "sltsPatStatus" = 'PAT_PASSED'
                THEN TRUE
                ELSE "isInvoicable"
            END
        WHERE "soNum" = p_so_nums[i];

        IF FOUND THEN
            v_updated := v_updated + 1;
        END IF;
    END LOOP;

    RETURN v_updated;
END;
$$;


-- 6. fn_vehicle_location_update
-- Replaces: VehicleService.ts Promise.all (update vehicle + insert GPS log)
-- Atomic: updates vehicle location AND creates GPS history in one call.
CREATE OR REPLACE FUNCTION fn_vehicle_location_update(
    p_vehicle_id UUID,
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_speed_kmh NUMERIC DEFAULT NULL,
    p_heading NUMERIC DEFAULT NULL,
    p_accuracy INT DEFAULT 10
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update vehicle current location
    UPDATE "VMVehicle"
    SET latitude = p_latitude,
        longitude = p_longitude,
        location_timestamp = now(),
        location_accuracy_meters = p_accuracy
    WHERE id = p_vehicle_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id;
    END IF;

    -- Insert GPS location history
    INSERT INTO "VMGPSLocation" (id, vehicle_id, latitude, longitude, speed_kmh, heading, accuracy_meters, recorded_at, "createdAt")
    VALUES (uuid_generate_v7(), p_vehicle_id, p_latitude, p_longitude, p_speed_kmh, p_heading, p_accuracy, now(), now());
END;
$$;


-- 7. fn_bulk_gis_snap_update
-- Replaces: GISReconciliationService.ts N individual pole/closure coordinate updates
-- Accepts parallel arrays of IDs + coordinates, single bulk UPDATE per table.
CREATE OR REPLACE FUNCTION fn_bulk_gis_snap_update(
    p_pole_ids UUID[] DEFAULT '{}'::UUID[],
    p_pole_lats NUMERIC[] DEFAULT '{}'::NUMERIC[],
    p_pole_lngs NUMERIC[] DEFAULT '{}'::NUMERIC[],
    p_closure_ids UUID[] DEFAULT '{}'::UUID[],
    p_closure_lats NUMERIC[] DEFAULT '{}'::NUMERIC[],
    p_closure_lngs NUMERIC[] DEFAULT '{}'::NUMERIC[]
)
RETURNS TABLE(poles_updated INTEGER, closures_updated INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
    v_poles_updated INT := 0;
    v_closures_updated INT := 0;
    i INT;
BEGIN
    -- Bulk update poles
    IF array_length(p_pole_ids, 1) IS NOT NULL THEN
        FOR i IN 1..array_length(p_pole_ids, 1) LOOP
            UPDATE "GISPole"
            SET latitude = p_pole_lats[i], longitude = p_pole_lngs[i], "updatedAt" = now()
            WHERE id = p_pole_ids[i];
            IF FOUND THEN v_poles_updated := v_poles_updated + 1; END IF;
        END LOOP;
    END IF;

    -- Bulk update closures
    IF array_length(p_closure_ids, 1) IS NOT NULL THEN
        FOR i IN 1..array_length(p_closure_ids, 1) LOOP
            UPDATE "GISClosure"
            SET latitude = p_closure_lats[i], longitude = p_closure_lngs[i], "updatedAt" = now()
            WHERE id = p_closure_ids[i];
            IF FOUND THEN v_closures_updated := v_closures_updated + 1; END IF;
        END LOOP;
    END IF;

    RETURN QUERY SELECT v_poles_updated, v_closures_updated;
END;
$$;


-- 8. fn_bulk_serial_status_update
-- Replaces: stock.service.ts per-serial update loop
-- Single UPDATE with ANY() for N serials.
CREATE OR REPLACE FUNCTION fn_bulk_serial_status_update(
    p_serial_numbers TEXT[],
    p_new_status TEXT,
    p_store_id UUID DEFAULT NULL,
    p_contractor_id UUID DEFAULT NULL
)
RETURNS INTEGER -- number of serials updated
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INT;
BEGIN
    IF array_length(p_serial_numbers, 1) IS NULL THEN
        RETURN 0;
    END IF;

    UPDATE "InventoryItemSerial"
    SET status = p_new_status,
        "storeId" = p_store_id,
        "contractorId" = COALESCE(p_contractor_id, "contractorId"),
        "updatedAt" = now()
    WHERE "serialNumber" = ANY(p_serial_numbers);

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;
