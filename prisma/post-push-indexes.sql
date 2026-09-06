-- ==========================================================================
-- Objects that `prisma db push` cannot manage and drops on every push:
--   * indexes Prisma's schema language cannot express (operator classes on
--     btree text, partial indexes, COALESCE/expression indexes);
--   * the SOD status plpgsql functions + triggers, which live only in
--     migration SQL that production never applies (Supabase is converged with
--     `db push`, not `migrate deploy`).
-- This file MUST be applied after each push, and docker-entrypoint.sh runs it on EVERY boot
-- (including the SKIP_DB_SYNC=true path used by any self-hosted container). It is therefore
-- engineered to be a strict NO-OP on a healthy database:
--   * idempotent  - IF NOT EXISTS / CREATE OR REPLACE / guarded DO blocks;
--   * lock-safe   - the SOD triggers are re-created ONLY when missing or when
--     pg_get_triggerdef genuinely differs, so a normal boot takes NO lock on
--     ServiceOrder (the hottest table) through the shared session pooler;
--   * resilient   - the risky unique index is built inside a DO block with an
--     EXCEPTION handler, so a pre-existing duplicate row warns and continues
--     instead of aborting the whole single implicit transaction and the boot;
--   * non-destructive - never deletes data, never drops an existing index, no
--     enum recreation. All identifiers are schema-qualified (public.) so it is
--     safe under any session search_path.
--
-- Applied by: docker-entrypoint.sh (every boot) and `npm run db:sync` from a workstation.
-- Asserted by: scripts/verify-sync-invariants.ts (fails if any row is missing).
-- ==========================================================================

-- Fail fast instead of hanging: an unbounded lock wait on the shared pooler
-- (project ceiling 15, shared with the Vercel serverless tier) would stall this one-shot
-- `prisma db execute` session so the app never turns healthy.
SET lock_timeout = '3s';
SET statement_timeout = '60s';

-- Notification.link prefix scans. NotificationRepository.updateMany with
-- `link: { startsWith: linkPrefix }` becomes LIKE 'prefix%', which is only
-- indexable with text_pattern_ops under the database's non-C collation.
CREATE INDEX IF NOT EXISTS "Notification_link_pattern_idx"
  ON public."Notification" (link text_pattern_ops);

-- Contractor leaderboard / billing screen: completed orders per contractor.
-- Partial, so it stays small and only tracks the terminal state.
CREATE INDEX IF NOT EXISTS "idx_service_order_contractor_completed"
  ON public."ServiceOrder" ("contractorId", "sltsStatus")
  WHERE "sltsStatus" = 'COMPLETED';

-- Notification dedup identity: one row per (userId, dedupHash) per recipient, so two
-- concurrent writers of the same business event cannot both insert. dedupHash is NULL for
-- every notification that opted out, and those rows must stay unconstrained - hence partial.
-- NotificationRepository.upsertByDedupKey reads with exactly this predicate.
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_userId_dedupHash_key"
  ON public."Notification" ("userId", "dedupHash")
  WHERE "dedupHash" IS NOT NULL;

-- SyncRun's own dedup guard (@@unique([feed, windowKey])) is expressible in Prisma and comes
-- from db push; nothing to do here except prove the table landed.
DO $$
BEGIN
  IF to_regclass('public."SyncRun"') IS NULL THEN
    RAISE NOTICE 'public.SyncRun absent - sync passes will not be auditable';
  END IF;
END
$$;

-- --------------------------------------------------------------------------
-- Migration-only expression index: hard DB guard against duplicate
-- material-usage lines (migration 20260901150000_uq_sod_material_usage).
-- The bridge push and an ERP-side sync raced on AN202607230049085 and both
-- inserted the same Drop Wire line twice. Prisma cannot declare COALESCE
-- expression indexes, so db push drops this - which is exactly what allowed a
-- duplicated material-usage row. Re-assert it on every boot.
-- NOTE: the other audited migration-only indexes are plain and already
-- declared in prisma/schema, so db push recreates them and they are NOT
-- needed here:
--   * 20260821140000 ServiceOrder_status_sltsStatus_receivedDate_idx ->
--     @@index([status, sltsStatus, receivedDate]) in service-order.prisma.
--   * 20260903130000 DailyReportSnapshot_snapshotDate_rtom_key / _idx ->
--     @@unique([snapshotDate, rtom]) + @@index([snapshotDate]) in system.prisma.
-- --------------------------------------------------------------------------
-- Resilient build: a pre-existing duplicate material-usage line makes CREATE
-- UNIQUE INDEX raise unique_violation (this race actually happened on
-- AN202607230049085). Because `prisma db execute --file` submits this script
-- as ONE simple query = a single implicit transaction, an uncaught error here
-- would roll back EVERY statement and (non-skip path) exit 1 -> boot loop.
-- The EXCEPTION handler contains the failure to this subtransaction, warns with
-- the offending condition, and lets the rest of the script run. Never deletes
-- data and never drops the index if it already exists.
DO $idx$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "uq_sod_material_usage_line"
    ON public."SODMaterialUsage" ("serviceOrderId", "itemId", "usageType",
        COALESCE("batchId"::text, ''), COALESCE("serialNumber", ''));
  RAISE NOTICE 'uq_sod_material_usage_line present (created or already existed).';
EXCEPTION
  WHEN unique_violation OR duplicate_table OR duplicate_object THEN
    RAISE WARNING 'uq_sod_material_usage_line NOT applied [SQLSTATE %]: %. A duplicate material-usage line already exists on the (serviceOrderId, itemId, usageType, COALESCE-batchId, COALESCE-serialNumber) key; resolve the duplicate row(s) manually. Boot continues and the other guards still run.', SQLSTATE, SQLERRM;
  WHEN others THEN
    RAISE WARNING 'uq_sod_material_usage_line NOT applied [SQLSTATE %]: %. Boot continues and the other guards still run.', SQLSTATE, SQLERRM;
END
$idx$;

-- --------------------------------------------------------------------------
-- SOD status invariant (migrations 20260831110000 + 20260831130000). A
-- portal-terminal sltsStatus can never sit on top of a still-active workflow
-- status - the root cause class of the "install-closed shows PENDING" bug.
-- This is the 20260831130000 body, i.e. the stale list reflects the ASSIGNED
-- enum value re-added there: an ASSIGNED workflow status must not coexist
-- with a terminal portal sltsStatus. BEFORE UPDATE, so the bad write is
-- rejected with SOD_STATUS_INVARIANT_VIOLATION.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_sod_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW."sltsStatus" IN ('INSTALL_CLOSED', 'COMPLETED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED')
     AND NEW."status" IN ('PENDING', 'INPROGRESS', 'ASSIGNED', 'PROV_CLOSED') THEN
    RAISE EXCEPTION 'SOD_STATUS_INVARIANT_VIOLATION: soNum=% cannot write status=% while sltsStatus=% (terminal portal status requires terminal workflow status)',
      NEW."soNum", NEW."status", NEW."sltsStatus";
  END IF;
  RETURN NEW;
END;
$fn$;

-- Guard: touch ServiceOrder ONLY when this trigger is missing or its definition
-- genuinely differs. Production probing confirms both SOD triggers already
-- match, so a normal boot takes NO lock and changes nothing here.
DO $guard$
DECLARE
  v_live     text;
  v_intended text := 'CREATE TRIGGER trg_sod_status_validate BEFORE UPDATE ON public."ServiceOrder" FOR EACH ROW EXECUTE FUNCTION public.fn_validate_sod_status_transition()';
  v_live_n   text;
  v_int_n    text;
BEGIN
  SELECT pg_get_triggerdef(t.oid)
    INTO v_live
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'ServiceOrder'
     AND c.relnamespace = 'public'::regnamespace
     AND t.tgname = 'trg_sod_status_validate'
     AND NOT t.tgisinternal
   LIMIT 1;

  -- Normalize both sides (strip schema qualification and parentheses, collapse
  -- whitespace) so pg_get_triggerdef formatting variance can never make a
  -- matching trigger look different and force a needless ACCESS EXCLUSIVE
  -- DROP+CREATE on the hottest table.
  v_int_n := btrim(regexp_replace(replace(replace(replace(v_intended, 'public.', ''), '(', ''), ')', ''), '\s+', ' ', 'g'));
  IF v_live IS NOT NULL THEN
    v_live_n := btrim(regexp_replace(replace(replace(replace(v_live, 'public.', ''), '(', ''), ')', ''), '\s+', ' ', 'g'));
  END IF;

  IF v_live IS NULL THEN
    BEGIN
      EXECUTE v_intended;
      RAISE NOTICE 'trg_sod_status_validate was missing - created.';
    EXCEPTION WHEN others THEN
      RAISE WARNING 'trg_sod_status_validate missing but could not be created [SQLSTATE %]: % - boot continues.', SQLSTATE, SQLERRM;
    END;
  ELSIF v_live_n IS DISTINCT FROM v_int_n THEN
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS trg_sod_status_validate ON public."ServiceOrder"';
      EXECUTE v_intended;
      RAISE NOTICE 'trg_sod_status_validate differed from intended - re-created.';
    EXCEPTION WHEN others THEN
      -- The subtransaction rolls the DROP back too, so the existing trigger survives.
      RAISE WARNING 'trg_sod_status_validate differs but could not be re-created [SQLSTATE %]: % (likely lock_timeout) - existing trigger untouched, boot continues.', SQLSTATE, SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'trg_sod_status_validate already matches intended definition - no lock taken.';
  END IF;
END
$guard$;

-- --------------------------------------------------------------------------
-- SOD status attribution audit (migration 20260831103500). Fires only when the
-- status VALUE changes, and captures the SQL query + application_name + client
-- address so out-of-band writes (manual SQL, scripts, foreign systems) are
-- attributed in AuditLog. AFTER UPDATE.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_sod_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public."AuditLog" ("userId", "action", "entity", "entityId", "oldValue", "newValue", "ipAddress", "createdAt")
  VALUES (
    NULL,
    'DB_STATUS_CHANGE',
    'ServiceOrder',
    NEW."soNum",
    jsonb_build_object('status', OLD.status, 'sltsStatus', OLD."sltsStatus"),
    jsonb_build_object(
      'status', NEW.status,
      'sltsStatus', NEW."sltsStatus",
      'query', current_query(),
      'applicationName', current_setting('application_name', true)
    ),
    CASE WHEN inet_client_addr() IS NULL THEN NULL ELSE inet_client_addr()::text END,
    now()
  );
  RETURN NEW;
END;
$fn$;

-- Guard: same no-lock-when-matching contract for the audit trigger. The WHEN
-- clause deparse (paren nesting) is normalized away, so an already-correct
-- trigger is recognized as matching and left untouched.
DO $guard$
DECLARE
  v_live     text;
  v_intended text := 'CREATE TRIGGER trg_sod_status_audit AFTER UPDATE ON public."ServiceOrder" FOR EACH ROW WHEN ((OLD.status IS DISTINCT FROM NEW.status)) EXECUTE FUNCTION public.fn_audit_sod_status_change()';
  v_live_n   text;
  v_int_n    text;
BEGIN
  SELECT pg_get_triggerdef(t.oid)
    INTO v_live
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'ServiceOrder'
     AND c.relnamespace = 'public'::regnamespace
     AND t.tgname = 'trg_sod_status_audit'
     AND NOT t.tgisinternal
   LIMIT 1;

  v_int_n := btrim(regexp_replace(replace(replace(replace(v_intended, 'public.', ''), '(', ''), ')', ''), '\s+', ' ', 'g'));
  IF v_live IS NOT NULL THEN
    v_live_n := btrim(regexp_replace(replace(replace(replace(v_live, 'public.', ''), '(', ''), ')', ''), '\s+', ' ', 'g'));
  END IF;

  IF v_live IS NULL THEN
    BEGIN
      EXECUTE v_intended;
      RAISE NOTICE 'trg_sod_status_audit was missing - created.';
    EXCEPTION WHEN others THEN
      RAISE WARNING 'trg_sod_status_audit missing but could not be created [SQLSTATE %]: % - boot continues.', SQLSTATE, SQLERRM;
    END;
  ELSIF v_live_n IS DISTINCT FROM v_int_n THEN
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS trg_sod_status_audit ON public."ServiceOrder"';
      EXECUTE v_intended;
      RAISE NOTICE 'trg_sod_status_audit differed from intended - re-created.';
    EXCEPTION WHEN others THEN
      RAISE WARNING 'trg_sod_status_audit differs but could not be re-created [SQLSTATE %]: % (likely lock_timeout) - existing trigger untouched, boot continues.', SQLSTATE, SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'trg_sod_status_audit already matches intended definition - no lock taken.';
  END IF;
END
$guard$;
