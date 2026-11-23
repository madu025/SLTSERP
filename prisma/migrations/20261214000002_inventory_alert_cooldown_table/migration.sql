-- The low-stock trigger (trg_low_stock_auto_alert -> fn_notify_low_stock) reads and writes "InventoryAlertCooldown", but the table does not exist in production, so any
-- update of InventoryStock that reaches the minimum level fails with "relation does not exist" and rolls the whole stock movement back (found by the inventory lifecycle test:
-- the receive step of a request failed when the transit stock fell to zero). Create the table the function expects. Idempotent.
CREATE TABLE IF NOT EXISTS "InventoryAlertCooldown" (
    "storeId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "lastAlertAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("storeId", "itemId")
);
