#!/usr/bin/env bash
# ==========================================================================
# Fresh start: purge all SOD-related data from the Coolify-managed Postgres
# (the copy just restored from Supabase). Rollback = re-run
# scripts/vps-db-move.sh, because Supabase is still the untouched source.
#
# Survives by design:
#   reference/config  User, Contractor, OPMC, InventoryItem, stores,
#                     NotificationTemplate, ProcessGatePolicy, SODRevenueConfig,
#                     SystemConfig, ChartOfAccount, authorities
#   money and custody Invoice, ProjectInvoice, JournalEntry, StockIssue, Penalty,
#                     ContractorMaterialReturn, and ALL InventoryLedger rows
#   history of record AuditLog, SystemErrorLog
#
# MODE=dry  (default) runs every delete inside a transaction, then rolls back.
# MODE=exec commits, and the post-state is asserted against the projection.
# ==========================================================================
set -uo pipefail
. /root/sltserp-coolify.env
MODE=${MODE:-dry}

q() { docker exec "$PG_UUID" psql -U sltserp -d sltserp -tA -c "$1"; }
c() { q "select count(*) from public.\"$1\""; }
exists() { [ "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='$1'")" = "1" ]; }

DB=$(q "select current_database()")
[ "$DB" = "sltserp" ] || { echo "ABORT: connected to '$DB', expected sltserp"; exit 1; }
echo "target: database=$DB container=$PG_UUID mode=$MODE"

# Rows scoped to SODs that have no foreign key to ServiceOrder, so they do not
# cascade: portal/scrape feeds, derived daily reports, SOD notifications.
NOTIF_WHERE="(link ilike '%service-orders%' or metadata::text like '%\"soNum\"%')"

# Tables emptied by this wipe: the orders plus everything that must not outlive them.
WIPE_TABLES="ServiceOrder ServiceOrderStatusHistory ServiceOrderComment SODMaterialUsage SODForensicAudit SODIptvSerial SODErectedPole CollectedCPE RestoreRequest ContractorMaterialReturnItem ServiceOrderDelayReason SLTPATStatus ExtensionRawData DailyReportSnapshot"
# Tables that must be untouched, listed so the run proves it.
KEEP_TABLES="InventoryLedger Invoice ProjectInvoice JournalEntry StockIssue Penalty ContractorMaterialReturn NotificationTemplate ProcessGatePolicy SODRevenueConfig SystemConfig ChartOfAccount User OPMC Contractor AuditLog SystemErrorLog"

DELETE_SQL="delete from public.\"SLTPATStatus\";
delete from public.\"ExtensionRawData\";
delete from public.\"DailyReportSnapshot\";
delete from public.\"Notification\" where $NOTIF_WHERE;
delete from public.\"ServiceOrder\";"

declare -a LINES
before_of() { c "$1"; }

echo
echo "=== triggers that will fire during the wipe (audit writers must be known) ==="
q "select '  ' || t.tgname || ' on ' || c.relname || ' ' || case when t.tgtype::int & 8 <> 0 then 'DELETE ' else '' end || case when t.tgtype::int & 4 <> 0 then 'UPDATE ' else '' end || case when t.tgtype::int & 2 <> 0 then 'INSERT ' else '' end || ' -> ' || p.proname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal order by c.relname"

echo
echo "=== projection ==="
printf '%-28s %10s %12s %10s\n' TABLE NOW EXPECTED_AFTER NOTE
for t in $WIPE_TABLES Notification; do
  exists "$t" || { echo "  $t: absent in this schema (skipped)"; continue; }
  n=$(before_of "$t")
  if [ "$t" = "Notification" ]; then
    exp=$(( n - $(q "select count(*) from public.\"Notification\" where $NOTIF_WHERE") ))
    printf '%-28s %10s %12s %10s\n' "$t" "$n" "$exp" "partial"
    LINES+=("Notification|$n|$exp|partial")
  else
    printf '%-28s %10s %12s %10s\n' "$t" "$n" 0 "wipe"
    LINES+=("$t|$n|0|wipe")
  fi
done
for t in $KEEP_TABLES; do
  exists "$t" || continue
  n=$(before_of "$t")
  printf '%-28s %10s %12s %10s\n' "$t" "$n" "$n" "keep"
  LINES+=("$t|$n|$n|keep")
done

echo
echo "=== executing the delete set ($MODE) ==="
if [ "$MODE" = "exec" ]; then
  docker exec -i "$PG_UUID" psql -U sltserp -d sltserp -v ON_ERROR_STOP=1 <<EOF || exit 1
begin;
set local statement_timeout = 0;
set local lock_timeout = '20s';
$DELETE_SQL
commit;
EOF
  q "vacuum analyze" >/dev/null
  echo "  committed"
else
  docker exec -i "$PG_UUID" psql -U sltserp -d sltserp -v ON_ERROR_STOP=1 <<EOF
begin;
set local statement_timeout = 0;
set local lock_timeout = '20s';
$DELETE_SQL
rollback;
EOF
  echo "  rolled back (dry run) - every statement above ran and was accepted by the constraints"
fi

echo
echo "=== verification ==="
printf '%-28s %10s %12s %10s %s\n' TABLE BEFORE ACTUAL EXPECTED RESULT
fails=0
for row in "${LINES[@]}"; do
  IFS='|' read -r t before exp note <<< "$row"
  actual=$(c "$t")
  if [ "$MODE" = "exec" ]; then ok=$([ "$actual" = "$exp" ] && echo pass || { echo FAIL; }); else ok="(n/a)"; fi
  [ "$ok" = "FAIL" ] && fails=$((fails + 1))
  printf '%-28s %10s %12s %10s %-6s %s\n' "$t" "$before" "$actual" "$exp" "$ok" "$note"
done

echo
if [ "$MODE" = "exec" ]; then
  echo "result: $fails mismatch(es); db size $(q 'select pg_size_pretty(pg_database_size(current_database()))'), orphan check below"
  qs <<'SQL'
select '  notifications without a user:   ' || count(*) from public."Notification" n where not exists (select 1 from public."User" u where u.id = n."userId");
select '  status history without an SOD:  ' || count(*) from public."ServiceOrderStatusHistory" h where not exists (select 1 from public."ServiceOrder" s where s.id = h."serviceOrderId");
select '  audit rows referencing an SOD:  ' || count(*) from public."AuditLog" where "entityType" in ('SERVICE_ORDER','ServiceOrder');
SQL
  echo "  InventoryLedger still intact:   $(c InventoryLedger) rows, checksummed sample: $(q "select count(distinct \"itemId\") from public.\"InventoryLedger\"")"
else
  echo "dry run complete. Commit with: MODE=exec bash /root/sod-wipe.sh"
fi
