ALTER TABLE "StockIssue" ADD COLUMN IF NOT EXISTS "reservationId" UUID;
ALTER TABLE "ProjectMaterialReservationLine" ADD COLUMN IF NOT EXISTS "issuedQty" DECIMAL(14,4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "StockIssue_reservationId_idx"
  ON "StockIssue"("reservationId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockIssue_reservationId_fkey') THEN
    ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "ProjectMaterialReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Direct issues may only consume unallocated batch stock. Reserved quantities
-- are consumed by the reservation-aware issue approval path.
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
    FOR batch_id, available_qty, batch_created_at, batch_expiry_date, cost_price, unit_price IN
        SELECT bs."batchId", bs.quantity - bs."allocatedQuantity", b."createdAt", b."expiryDate", b."costPrice", b."unitPrice"
        FROM "InventoryBatchStock" bs
        JOIN "InventoryBatch" b ON bs."batchId" = b.id
        WHERE bs."storeId" = p_store_id
          AND bs."itemId" = p_item_id
          AND bs.quantity - bs."allocatedQuantity" > 0
        ORDER BY b."expiryDate" ASC NULLS LAST, b."createdAt" ASC
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
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.fn_fifo_pick_store_batches(uuid, uuid, numeric) SET search_path = '';
