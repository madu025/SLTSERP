# SLTSERP Database Trigger & Function Management -- Expert Prompt

You are working on SLTSERP, a Next.js 16 + Prisma + Supabase PostgreSQL ERP system for Sri Lanka Telecom's fiber-optic construction operations.

## Architecture Overview

The system uses **Prisma Migrate** as the single source of truth for all database changes:
- Schema (tables, columns, enums, indexes) → managed by `prisma/schema.prisma` + `prisma/migrations/`
- PL/pgSQL functions → defined inside migration SQL files with `$$` dollar-quoting
- Triggers → managed declaratively via `prisma/triggers.json` + auto-generated migrations
- Deployment → `prisma migrate deploy --schema prisma/schema.prisma` applies everything in one command

## Key Constraint

The `--schema prisma/schema.prisma` flag is REQUIRED for all Prisma CLI commands because `prisma/schema/` directory (28 domain fragment files) conflicts with the root `prisma/schema.prisma` file.

## Trigger Management (Dynamic)

Triggers are managed declaratively through a JSON config file:

### Config File: `prisma/triggers.json`
```json
{
  "version": "1.0",
  "triggers": [
    {
      "name": "trg_prevent_negative_stock",
      "table": "InventoryStock",
      "timing": "BEFORE",
      "events": "INSERT OR UPDATE",
      "function": "fn_prevent_negative_stock()",
      "when": null
    }
  ]
}
```

### Fields
| Field | Type | Description |
|---|---|---|
| `name` | string | Trigger name (prefix with `trg_`) |
| `table` | string | Target table name (exact, quoted in SQL) |
| `timing` | enum | `BEFORE`, `AFTER`, or `INSTEAD OF` |
| `events` | string | SQL event list: `INSERT`, `UPDATE`, `DELETE`, or combinations like `INSERT OR UPDATE` |
| `function` | string | PL/pgSQL function to execute (must already exist) |
| `when` | string or null | Optional WHEN condition (e.g., `NEW.quantity < 0`) |

### Sync Script: `scripts/sync-triggers.ts`
Reads `prisma/triggers.json` and generates a migration SQL file that DROPs and recreates all triggers. Generated migration goes to `prisma/migrations/<timestamp>_sync_trigger_definitions/migration.sql`.

### Workflow
```
1. Edit prisma/triggers.json
2. Run: npm run triggers:sync
3. Review generated migration SQL
4. Commit to Git
5. Deploy: prisma migrate deploy --schema prisma/schema.prisma
```

## Current Triggers (11 total)

| Trigger | Table | Timing | Purpose |
|---|---|---|---|
| `trg_pre_erp_auto_calc` | PreErpMaterialBalance | BEFORE INSERT/UPDATE | Auto-calculations before ERP operations |
| `trg_prevent_negative_stock` | InventoryStock | BEFORE INSERT/UPDATE | Blocks stock from going below zero |
| `trg_auto_ledger_checksum` | InventoryLedger | BEFORE INSERT | Auto SHA-256 checksum on audit ledger entries |
| `trg_cycle_count_variance` | CycleCountLine | BEFORE INSERT/UPDATE | Auto-calculates cycle count variance |
| `trg_low_stock_auto_alert` | InventoryStock | AFTER UPDATE (conditional) | Fires notification when stock drops below minLevel |
| `trg_wastage_limit_check` | ContractorWastageItem | BEFORE INSERT | Blocks wastage exceeding allowed limit |
| `trg_variance_adjustment_calc` | MaterialVarianceAdjustment | BEFORE INSERT/UPDATE | Auto-calculates variance quantity |
| `trg_audit_log_immutable` | AuditLog | BEFORE UPDATE OR DELETE | Blocks tampering with audit trail |
| `trg_fiscal_period_lock` | FiscalPeriod | BEFORE UPDATE | Prevents LOCKED period status revert |
| `trg_journal_entry_balance_check` | JournalEntry | BEFORE UPDATE | Validates debit=credit on POST, blocks revert |
| `trg_stage_status_cascade` | ProjectStageInstance | AFTER UPDATE (conditional) | Auto-recalculates Project.progress on stage change |

## Current DB Functions (50 total)

All functions are defined in migration files and applied via `prisma migrate deploy`. Categories:

### Inventory Core
- `fn_pre_erp_auto_calc()` - Pre-ERP auto calculations
- `fn_prevent_negative_stock()` - Negative stock prevention
- `fn_contractor_balance_sheet(UUID, TEXT, TIMESTAMP)` - Contractor balance sheet
- `fn_store_material_balance(UUID)` - Store material balance
- `fn_expiring_batches(UUID, INT)` - Expiring batch detection
- `fn_low_stock_alerts(UUID)` - Low stock alert generation
- `fn_store_inventory_value(UUID)` - Store inventory valuation
- `fn_calc_stock_value()` - Stock value calculation (trigger function)

### FIFO & Automation
- `fn_auto_ledger_checksum()` - Auto SHA-256 checksum generation
- `fn_next_document_number(TEXT)` - Atomic document number sequencing
- `fn_fifo_pick_store_batches(UUID, UUID, DECIMAL)` - FIFO batch picking for stores
- `fn_fifo_pick_contractor_batches(UUID, UUID, DECIMAL)` - FIFO batch picking for contractors
- `fn_calc_cycle_variance()` - Cycle count variance calculation

### Alerts & Validation
- `fn_notify_low_stock()` - Low stock notification trigger function
- `fn_update_stock_request_status(UUID)` - Stock request status cascade
- `fn_calculate_rop_all_items()` - Reorder point calculation for all items
- `fn_update_rop_levels()` - Update reorder levels
- `fn_validate_wastage_limit()` - Wastage limit validation
- `fn_calc_variance_adjustment()` - Variance adjustment calculation
- `fn_sod_total_material_cost(UUID)` - Total material cost for SOD
- `fn_verify_ledger_integrity(UUID?, UUID?)` - Ledger integrity verification (optional store/item filters)
- `fn_determine_next_stage(UUID)` - Determine next workflow stage

### Multi-Store & Reporting
- `fn_multi_store_material_balance(UUID)` - Multi-store material balance
- `fn_multi_store_expiring_batches(UUID, INT)` - Multi-store expiring batches
- `fn_contractor_stock_summary(UUID)` - Contractor stock summary
- `fn_store_dashboard_summary(UUID)` - Store dashboard KPIs
- `fn_stock_movement_report(UUID, TIMESTAMP, TIMESTAMP)` - Stock movement report

### Bulk Operations
- `fn_bulk_stock_issue(JSONB)` - Bulk stock issuance
- `fn_bulk_boq_actual_update(JSONB)` - Bulk BOQ actual updates
- `fn_bulk_stock_initialize(JSONB)` - Bulk stock initialization
- `fn_wastage_approval_check(UUID)` - Wastage approval check
- `fn_bulk_pat_status_sync(JSONB)` - Bulk PAT status sync
- `fn_vehicle_location_update(JSONB)` - Vehicle location update
- `fn_bulk_gis_snap_update(JSONB)` - Bulk GIS snap updates
- `fn_bulk_serial_status_update(JSONB)` - Bulk serial status updates

### Finance & SOD
- `fn_validate_journal_entry(JSONB)` - Journal entry validation (double-entry + CoA)
- `fn_resolve_coa_accounts(TEXT[])` - Bulk Chart of Accounts resolution
- `fn_sod_dashboard_summary(UUID, INT, INT)` - SOD dashboard summary
- `fn_sod_material_usage_summary(UUID)` - SOD material usage aggregation
- `fn_contractor_performance_metrics(UUID, DATE, DATE)` - Contractor KPIs
- `fn_cash_book_report(TEXT, TIMESTAMP, TIMESTAMP)` - Cash book with running balance (window functions)
- `fn_asset_register_summary()` - Fixed asset register totals (single aggregate query)
- `fn_trial_balance(TIMESTAMP, TIMESTAMP)` - Trial balance across all CoA accounts

### Project & Workflow
- `fn_project_progress_calculate(UUID)` - Calculate project progress from workflow stages
- `fn_stage_status_cascade()` - Trigger fn: auto-updates Project.progress on stage change

### Vehicle & Fleet
- `fn_vehicle_utilization_summary(UUID, TIMESTAMP, TIMESTAMP)` - Vehicle utilization report (distance, fuel, efficiency)

### Audit & Integrity (Trigger Functions)
- `fn_audit_log_immutable()` - Trigger fn: blocks UPDATE/DELETE on AuditLog
- `fn_fiscal_period_lock_guard()` - Trigger fn: prevents LOCKED -> OPEN status change
- `fn_journal_balance_check()` - Trigger fn: validates debit=credit before POSTED

### Inventory Alerts
- `fn_expiring_batch_alerts(UUID, INT)` - Batches expiring within N days

### Utilities
- `uuid_generate_v7()` - UUIDv7 generation (time-ordered)

## Adding a New DB Function

1. Create a migration: `npx prisma migrate dev --name describe_function --create-only --schema prisma/schema.prisma`
2. Edit the generated `prisma/migrations/<timestamp>/migration.sql`
3. Write the function:
```sql
CREATE OR REPLACE FUNCTION fn_my_function(param1 UUID, param2 INT)
RETURNS TABLE (col1 TEXT, col2 DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT ...
    FROM ...
    WHERE ...;
END;
$$ LANGUAGE plpgsql;
```
4. Test: `npx prisma migrate deploy --schema prisma/schema.prisma`
5. Call from TypeScript:
```typescript
const result = await prisma.$queryRaw`SELECT * FROM fn_my_function(${id}::uuid, ${limit})`;
```

## Adding a New Trigger

1. Write the trigger function in a migration (must exist before trigger)
2. Add trigger definition to `prisma/triggers.json`
3. Run `npm run triggers:sync`
4. Commit and deploy

## Modifying an Existing Trigger

1. Edit the trigger entry in `prisma/triggers.json` (change timing, events, function, when condition)
2. Run `npm run triggers:sync`
3. Commit and deploy
4. The generated migration will DROP the old trigger and CREATE the new version

## Removing a Trigger

1. Remove the trigger entry from `prisma/triggers.json`
2. Run `npm run triggers:sync`
3. The generated migration will only DROP the removed trigger (others recreated)
4. Commit and deploy

## Modifying a Trigger Function

If the trigger function logic changes:
1. Create a new migration with `CREATE OR REPLACE FUNCTION fn_xxx(...)`
2. If the trigger definition also changes, update `triggers.json` and run `npm run triggers:sync`
3. If only the function body changes (same signature), no trigger change needed -- `CREATE OR REPLACE` updates it

## New Client Setup

```bash
# Set environment variables
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DIRECT_URL=postgresql://user:pass@host:5432/dbname

# Apply all migrations (creates everything: tables + 50 functions + 11 triggers)
npx prisma migrate deploy --schema prisma/schema.prisma
```

## Docker Build Pipeline

```sh
# docker-entrypoint.sh
prisma migrate deploy --schema prisma/schema.prisma   # Schema + functions + triggers
node server.js                                          # Start app
```

## Important Notes

1. **Never use `prisma db push` in production** -- it bypasses migration tracking
2. **Never use `prisma migrate dev` in production** -- it's development-only and uses a shadow database
3. **Always use `--schema prisma/schema.prisma`** -- without it, Prisma can't find migrations
4. **PL/pgSQL `$$` quoting works natively** in `prisma migrate deploy` -- Prisma sends full SQL files as single batches
5. **Triggers reference functions** -- the function must exist before the trigger is created
6. **Migration files are immutable** -- never edit an already-applied migration; create a new one instead
7. **All changes go through migrations** -- this ensures reproducibility across environments
