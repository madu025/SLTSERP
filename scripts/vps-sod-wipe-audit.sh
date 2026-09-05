#!/usr/bin/env bash
# ==========================================================================
# Read-only analysis of what "delete all SOD data for a fresh start" means in
# this schema. Nothing is deleted here.
#
# Walks the live foreign-key graph outwards from ServiceOrder, reports the exact
# row counts a delete would touch, which ON DELETE actions apply, and which rows
# in tables that must survive (ledger / finance / config / users) would block it.
# ==========================================================================
set -uo pipefail
. /root/sltserp-coolify.env

q() { docker exec "$PG_UUID" psql -U sltserp -d sltserp -tA -c "$1"; }
qs() { docker exec -i "$PG_UUID" psql -U sltserp -d sltserp -tA -f -; }

echo "=== A. tables reached from ServiceOrder through foreign keys ==="
qs <<'SQL' > /root/.closure.txt
with recursive edges as (
  select c.conrelid::oid child, c.confrelid::oid parent, c.confdeltype::text act
  from pg_constraint c
  join pg_class pc on pc.oid = c.conrelid
  join pg_namespace n on n.oid = pc.relnamespace
  where c.contype = 'f' and n.nspname = 'public'
), closure(rel, depth, path, act) as (
  select '"ServiceOrder"'::regclass::oid, 0, array['"ServiceOrder"'::regclass::oid], null::text
  union all
  select e.child, c.depth + 1, c.path || e.child,
         case e.act when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE'
                    when 'n' then 'SET NULL' else 'SET DEFAULT' end
  from closure c join edges e on e.parent = c.rel
  where c.depth < 12 and not e.child = any(c.path)
)
select (select relname from pg_class where oid = g.rel) || '|' || g.acts
from (select rel, string_agg(coalesce(act, '-'), '/') acts from closure where depth > 0 group by rel) g
order by 1;
SQL
printf '%-44s %-26s %s\n' TABLE 'ACTION FROM PARENT' ROWS
while IFS='|' read -r name acts; do
  [ -n "${name:-}" ] || continue
  cnt=$(q "select count(*) from public.\"$name\"")
  printf '%-44s %-26s %s\n' "$name" "$acts" "${cnt:-err}"
done < /root/.closure.txt
echo "  (ServiceOrder itself: $(q 'select count(*) from public."ServiceOrder"') rows)"

echo
echo "=== B. blockers: FKs from OUTSIDE the closure INTO it that are not CASCADE ==="
qs <<'SQL'
with recursive edges as (
  select c.conrelid::oid child, c.confrelid::oid parent, c.confdeltype::text act
  from pg_constraint c join pg_class pc on pc.oid=c.conrelid join pg_namespace n on n.oid=pc.relnamespace
  where c.contype='f' and n.nspname='public'
), closure(rel, path) as (
  select '"ServiceOrder"'::regclass::oid, array['"ServiceOrder"'::regclass::oid]
  union all
  select e.child, c.path || e.child from closure c join edges e on e.parent=c.rel where not e.child = any(c.path)
)
select '  ' || case when ext then 'BLOCKER  ' else 'internal ' end || child || ' -> ' || parent || '  [' || act || ']  child rows=' || rows
from (
  select distinct e.child::regclass::text child, e.parent::regclass::text parent,
    (e.child not in (select rel from closure)) ext,
    case e.act when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE'
               when 'n' then 'SET NULL' else 'SET DEFAULT' end act,
    (select reltuples::bigint from pg_class pc where pc.oid = e.child) rows
  from edges e
  where e.parent in (select rel from closure) and e.act <> 'c'
) x order by ext desc, child;
SQL

echo
echo "=== C. surviving-set tables and whether they point at ServiceOrder ==="
for t in InventoryLedger Invoice ProjectInvoice Penalty ContractorMaterialReturn StockIssue StockTransfer GoodsReceivedNote PaymentReceipt JournalEntry; do
  [ "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='$t'")" = "1" ] || continue
  total=$(q "select count(*) from public.\"$t\"")
  fk=$(q "select coalesce(string_agg(distinct a.attname,','),'-') from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum = any(c.conkey) where c.contype='f' and c.conrelid='public.\"$t\"'::regclass and c.confrelid in ('public.\"ServiceOrder\"'::regclass,'public.\"ServiceOrderStatusHistory\"'::regclass)")
  if [ "$fk" != "-" ]; then
    col=${fk%%,*}
    n=$(q "select count(*) from public.\"$t\" where \"$col\" in (select id from public.\"ServiceOrder\")")
    printf '  %-26s rows=%-9s FK->SOD via %-18s matching=%s\n' "$t" "$total" "$col" "$n"
  else
    printf '  %-26s rows=%-9s no direct FK to ServiceOrder\n' "$t" "$total"
  fi
done

echo
echo "=== D. SOD-scoped tables with no FK path (feeds, sync state, reports, notifications) ==="
qs <<'SQL'
select '  ' || rpad(tablename, 34, ' ') || lpad(n::text, 9, ' ')
from (
  select t.tablename,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', t.tablename), false, true, '')))[1]::text::bigint n
  from pg_tables t
  where t.schemaname = 'public'
    and t.tablename ~* '(sync|cron|snapshot|rawdata|^extension|^sltpat|notification$|^qc|^bridge|^portal|jobrun|^asset|tick|^master)'
) y order by n desc nulls last;
SQL

echo
echo "=== E. notification mix (polymorphic, no FK to ServiceOrder) ==="
q "select '  type ' || rpad(type, 26, ' ') || ' = ' || count(*) from public.\"Notification\" group by type order by count(*) desc limit 15"
q "select '  link 1st segment ' || rpad(pfx, 24, ' ') || ' = ' || count(*) from (select coalesce(split_part(link, '/', 2), '(none)') pfx from public.\"Notification\") x group by pfx order by count(*) desc limit 12"
echo "  dedupHash populated: $(q 'select count(*) from public."Notification" where "dedupHash" is not null') of $(q 'select count(*) from public."Notification"')"

echo
echo "=== F. config/policy/reference tables that must survive ==="
qs <<'SQL'
select '  ' || rpad(tablename, 34, ' ') || lpad(n::text, 9, ' ')
from (
  select t.tablename,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', t.tablename), false, true, '')))[1]::text::bigint n
  from pg_tables t
  where t.schemaname = 'public'
    and (t.tablename ~* '(config|policy|policies|template|authority|chartofaccount|^opmc$|contractor$|^user$|^store$|^inventoryitem$|^inventoryledger$|invoice$|penalty$)'
         or t.tablename = 'ServiceOrderStatus')
) y order by 1;
SQL

echo
echo "=== G. ServiceOrder composition (what a fresh start removes) ==="
q "select '  status ' || st || ' = ' || n from (select status::text st, count(*) n from public.\"ServiceOrder\" group by status) z order by n desc"
q "select '  created ' || mo || ' = ' || count(*) from (select to_char(date_trunc('month', \"createdAt\"), 'YYYY-MM') mo from public.\"ServiceOrder\") y group by mo order by mo" | head -24
