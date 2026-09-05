#!/usr/bin/env bash
# Read-only: capture the exact DDL of every index that Prisma considers "extra"
# relative to the schema folder, plus the table/model count reconciliation.
set -uo pipefail
. /root/sltserp-coolify.env

echo "=== indexes on Notification / ServiceOrder (full DDL) ==="
docker exec "$PG_UUID" psql -U sltserp -d sltserp -c \
  "select tablename, indexname, indexdef from pg_indexes
     where tablename in ('Notification','ServiceOrder') order by tablename, indexname"

echo "=== public tables not backed by a model in prisma/schema (name/@@map diff) ==="
docker exec "$PG_UUID" psql -U sltserp -d sltserp -tA -c \
  "select tablename from pg_tables where schemaname='public' order by 1" > /tmp/db_tables.txt
grep -hoE '^(model|type) +[A-Za-z0-9_]+' /root/prisma-check/schema/*.prisma | awk '{print $2}' | sort -u > /tmp/model_names.txt
grep -hoE '@@map\("[^"]+"\)' /root/prisma-check/schema/*.prisma | sed -E 's/@@map\("(.*)"\)/\1/' | sort -u > /tmp/mapped.txt
cat /tmp/model_names.txt /tmp/mapped.txt | sort -u > /tmp/schema_names.txt
echo "  in DB but not in schema:"
comm -23 /tmp/db_tables.txt /tmp/schema_names.txt | sed 's/^/    /'
echo "  in schema but not in DB:"
comm -13 /tmp/db_tables.txt /tmp/schema_names.txt | sed 's/^/    /'
