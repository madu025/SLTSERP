#!/usr/bin/env bash
# ==========================================================================
# Move the data off Supabase: snapshot the live production schema+data into the
# Coolify-managed Postgres 17 on this box.
#
# Supabase is only READ here (pg_dump). The target database must be empty, and
# the script aborts if it is not, so this can never overwrite anything. The
# running app keeps using Supabase until a separate cutover step.
#
# Client tools come from the postgres:17-alpine image so the dump version always
# matches server 17.x (the host may carry an older pg_dump).
# ==========================================================================
set -uo pipefail
. /root/sltserp-coolify.env

DIR=/root/dbmove
umask 077
mkdir -p "$DIR"
DUMP="$DIR/supabase-public.dump"
LOG="$DIR/prep.log"
: > "$LOG"

say() { printf '%s\n' "$*"; }
die() { printf 'ABORT: %s\n' "$*" >&2; exit 1; }

# Read the source URL out of the deploy .env without echoing it.
eval "$(python3 - <<'PY'
import shlex
d = {}
for line in open('/root/slts-erp/.env', encoding='utf-8', errors='replace'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    d[k.strip()] = v.strip().strip('"').strip("'")
src = d.get('DIRECT_URL') or d.get('DATABASE_URL') or ''
print('SRC_URL=%s' % shlex.quote(src))
PY
)"
[ -n "${SRC_URL:-}" ] || die "no DIRECT_URL/DATABASE_URL found in /root/slts-erp/.env"
say "source URL present (${#SRC_URL} chars), target container $PG_UUID"

runpg() { # docker client helper: runpg <cmd...>
  docker run --rm -v "$DIR:/work" -e PGOPTIONS='-c statement_timeout=0 -c lock_timeout=0' \
    postgres:17-alpine "$@"
}

say "=== 1. source reachability and size ==="
if ! runpg psql "$SRC_URL" -tAc "select current_database()||' | '||version()||' | '||pg_size_pretty(pg_database_size(current_database()))" 2>>"$LOG"; then
  die "cannot reach the source database (see $LOG)"
fi
SRC_TABLES=$(runpg psql "$SRC_URL" -tAc "select count(*) from information_schema.tables where table_schema='public'" 2>>"$LOG")
SRC_FUNCS=$(runpg psql "$SRC_URL" -tAc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'" 2>>"$LOG")
SRC_TRIG=$(runpg psql "$SRC_URL" -tAc "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal" 2>>"$LOG")
SRC_ENUM=$(runpg psql "$SRC_URL" -tAc "select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'" 2>>"$LOG")
say "  public: tables=$SRC_TABLES functions=$SRC_FUNCS triggers=$SRC_TRIG enums=$SRC_ENUM"
runpg psql "$SRC_URL" -tAc "select count(*) from pg_extension" 2>>"$LOG" | awk '{print "  extensions installed: "$1}'
[ "${SRC_TABLES:-0}" -gt 50 ] || die "source looks wrong (only $SRC_TABLES public tables) - refusing to proceed"

say "=== 2. target must be empty ==="
TGT_TABLES=$(docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "select count(*) from information_schema.tables where table_schema='public'" 2>>"$LOG")
[ "${TGT_TABLES:-0}" -eq 0 ] || die "target already holds $TGT_TABLES public tables - nothing in this script will overwrite them"
say "  target public tables=0 (clean)"

say "=== 3. pg_dump of the public schema (custom format) ==="
if [ "${SKIP_DUMP:-0}" = 1 ] && [ -s "$DUMP" ]; then
  say "  reusing the dump already on disk ($(du -h "$DUMP" | cut -f1))"
else
  rm -f "$DUMP"
  runpg pg_dump "$SRC_URL" --format=custom --no-owner --no-privileges --no-acl \
    --schema=public --file=/work/supabase-public.dump 2>>"$LOG" || die "pg_dump failed (see $LOG)"
  ls -lh "$DUMP" | awk '{print "  dump: "$5" -> "$9}'
fi

say "=== 4. restore into the Coolify Postgres ==="
# pg_dump emits its own CREATE SCHEMA public, which exists in every database, so
# --exit-on-error would die on that first harmless statement. Drop the schema and
# let the dump recreate it (owned by sltserp, which is what we want anyway).
# Only legal while the target is verified empty above.
docker exec "$PG_UUID" psql -U sltserp -d sltserp -v ON_ERROR_STOP=1 \
  -c 'drop schema if exists public cascade;' >/dev/null \
  || die "could not drop the public schema"
docker cp "$DUMP" "$PG_UUID":/tmp/supabase-public.dump >/dev/null || die "docker cp failed"
docker exec "$PG_UUID" pg_restore -U sltserp -d sltserp --no-owner --no-privileges --no-acl \
  --exit-on-error /tmp/supabase-public.dump >"$DIR/restore.log" 2>&1
rc=$?
if [ "$rc" -ne 0 ]; then
  say "  pg_restore exited $rc - last messages:"
  tail -15 "$DIR/restore.log" | sed 's/^/    /'
  die "restore did not complete; target may be partial. Inspect $DIR/restore.log before retrying."
fi
say "  restore completed without errors"

say "=== 5. parity check (source vs target) ==="
TGT_TABLES=$(docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "select count(*) from information_schema.tables where table_schema='public'")
TGT_FUNCS=$(docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")
TGT_TRIG=$(docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal")
TGT_ENUM=$(docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'")
printf '  %-10s %-12s %-12s %s\n' ITEM SOURCE TARGET MATCH
printf '  %-10s %-12s %-12s %s\n' tables   "$SRC_TABLES" "$TGT_TABLES" "$([ "$SRC_TABLES" = "$TGT_TABLES" ] && echo yes || echo NO)"
printf '  %-10s %-12s %-12s %s\n' functions "$SRC_FUNCS" "$TGT_FUNCS" "$([ "$SRC_FUNCS" = "$TGT_FUNCS" ] && echo yes || echo NO)"
printf '  %-10s %-12s %-12s %s\n' triggers "$SRC_TRIG" "$TGT_TRIG" "$([ "$SRC_TRIG" = "$TGT_TRIG" ] && echo yes || echo NO)"
printf '  %-10s %-12s %-12s %s\n' enums    "$SRC_ENUM" "$TGT_ENUM" "$([ "$SRC_ENUM" = "$TGT_ENUM" ] && echo yes || echo NO)"

echo "  uuid_generate_v7 present: $(docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "select count(*) from pg_proc where proname='uuid_generate_v7'")"
echo "  row census (top 12 by count):"
docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "
with t as (select format('%I.%I', schemaname, tablename) tbl from pg_tables where schemaname='public')
select tbl, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %s', tbl), false, true, '')))[1]::text::bigint n
from t order by n desc nulls last limit 12;" 2>>"$LOG" | awk -F'|' '{printf "    %-46s %s\n", $1, $2}'

say "=== 6. Prisma migration history is dropped (first-setup model: db push) ==="
docker exec "$PG_UUID" psql -U sltserp -d sltserp -c 'drop table if exists "_prisma_migrations";' 2>&1 | tail -1
say "logs: $LOG , $DIR/restore.log"
