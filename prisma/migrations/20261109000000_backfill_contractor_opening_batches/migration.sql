-- Contractor stock rows (ContractorStock) that were loaded without any ContractorBatchStock cannot be
-- consumed: SOD material entry picks FIFO from batches and refuses a shortage. Give each such row one
-- opening batch holding exactly its current quantity. Stock quantities do not change, so no ledger
-- movement is needed. Idempotent: only rows with no batch coverage are touched.
DO $$
DECLARE r record; v_batch uuid;
BEGIN
  FOR r IN
    SELECT s."contractorId", s."itemId", s.quantity, i."costPrice", i."unitPrice"
    FROM "ContractorStock" s
    JOIN "InventoryItem" i ON i.id = s."itemId"
    WHERE s.quantity > 0
      AND NOT EXISTS (SELECT 1 FROM "ContractorBatchStock" b WHERE b."contractorId" = s."contractorId" AND b."itemId" = s."itemId" AND b.quantity > 0)
  LOOP
    INSERT INTO "InventoryBatch" ("batchNumber", "itemId", "initialQty", "costPrice", "unitPrice")
    VALUES ('OPENING-' || substr(r."contractorId"::text, 1, 8), r."itemId", r.quantity, coalesce(r."costPrice", 0), coalesce(r."unitPrice", 0))
    RETURNING id INTO v_batch;
    INSERT INTO "ContractorBatchStock" ("contractorId", "itemId", "batchId", quantity, "updatedAt")
    VALUES (r."contractorId", r."itemId", v_batch, r.quantity, now());
  END LOOP;
END $$;
