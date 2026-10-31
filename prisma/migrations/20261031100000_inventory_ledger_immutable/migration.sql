-- InventoryLedger is an append-only audit trail (AGENTS.md: immutable ledger).
-- Block UPDATE/DELETE at the database level. Controlled maintenance (QA reset,
-- explicit data repair) must opt in per transaction with:
--   SET LOCAL app.allow_inventory_ledger_mutation = 'on';
CREATE OR REPLACE FUNCTION fn_inventory_ledger_immutable() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_inventory_ledger_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'InventoryLedger is immutable (% blocked)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_ledger_immutable ON "InventoryLedger";
CREATE TRIGGER trg_inventory_ledger_immutable
BEFORE UPDATE OR DELETE ON "InventoryLedger"
FOR EACH ROW EXECUTE FUNCTION fn_inventory_ledger_immutable();
