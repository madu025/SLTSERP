#!/usr/bin/env bash
# ==========================================================================
# Prisma parity check for the moved database: compare the authoritative multi-file
# schema (prisma/schema/*.prisma, 258 models) against the live Coolify Postgres
# that was just restored, and report the exact SQL Prisma would apply.
#
# The production image ships a prebuilt bundle only (no prisma CLI), so the tooling
# runs from node:22-slim (Debian, glibc + openssl 3) with the CLI pinned to the exact
# version in package-lock. npm/engine caches live in named volumes, so only the first
# run pays the download. Never exposes a port. APPLY=1 is required before any write.
# ==========================================================================
set -uo pipefail
. /root/sltserp-coolify.env
APPLY=${APPLY:-0}

PC=/root/prisma-check
SRC="$PC/schema"
PRISMA_VERSION=6.19.1
NODE_IMAGE=node:22-slim
[ -d "$SRC" ] || { echo "ABORT: $SRC missing - upload prisma/schema first"; exit 1; }
docker image inspect "$NODE_IMAGE" >/dev/null 2>&1 || docker pull "$NODE_IMAGE" >/dev/null

URL="postgresql://sltserp:${PG_PASSWORD}@${PG_UUID}:5432/sltserp"
run() { docker run --rm --network coolify --entrypoint sh -e DATABASE_URL="$URL" -e DIRECT_URL="$URL" \
             -e npm_config_fund=false -e npm_config_update_notifier=false \
             -v prisma-npx-cache:/root/.npm -v prisma-engine-cache:/root/.cache/prisma \
             -v "$PC:/pc" -w /pc "$NODE_IMAGE" -c "set -e; $1"; }
PRISMA="npx --yes prisma@$PRISMA_VERSION"
DIFF="$PRISMA migrate diff --from-schema-datasource /pc/schema/_base.prisma --to-schema-datamodel /pc/schema"

echo "=== toolchain (pinned prisma $PRISMA_VERSION via npx, first run downloads) ==="
run "$PRISMA --version | head -4" 2>&1 | sed 's/^/  /'

echo "=== prisma validate (folder schema, no database touched) ==="
run "$PRISMA validate --schema /pc/schema" 2>&1 | tail -5 | sed 's/^/  /'

echo "=== what the database is missing or holding extra (read-only diff) ==="
run "$DIFF --exit-code" >"$PC/diff.txt" 2>&1
rc=$?
case "$rc" in
  0) echo "  diff rc=0: live schema already matches the Prisma schema (no SQL needed)" ;;
  1) echo "  diff rc=1: drift detected, SQL below" ;;
  *) echo "  diff rc=$rc (unexpected - output follows)"; tail -20 "$PC/diff.txt" | sed 's/^/    /' ;;
esac
if [ -s "$PC/diff.txt" ]; then
  grep -vE '^$' "$PC/diff.txt" | head -40 | sed 's/^/    /'
  echo "    ... total lines: $(wc -l < "$PC/diff.txt")"
fi

echo "=== raw SQL Prisma would emit (first 60 lines) ==="
run "$DIFF --script" 2>&1 | head -60 | sed 's/^/  /'

rediff() {
  run "$DIFF --script" >"$PC/rediff.txt" 2>&1
  local body
  body=$(grep -vE 'prisma:warn|Please manually install' "$PC/rediff.txt" | grep -vE '^[[:space:]]*$')
  if [ -z "$body" ]; then
    echo "  parity: live database matches the Prisma schema exactly"
  else
    echo "  remaining difference:"; printf '%s\n' "$body" | head -20 | sed 's/^/    /'
  fi
}

if [ "$APPLY" = 1 ]; then
  echo "=== applying with prisma db push (first-setup model, no migration history) ==="
  run "$PRISMA db push --schema /pc/schema --skip-generate" 2>&1 | tail -20 | sed 's/^/  /'
  if [ -f "$PC/post-push.sql" ]; then
    echo "=== re-applying the indexes Prisma cannot express ==="
    docker exec -i "$PG_UUID" psql -U sltserp -d sltserp -v ON_ERROR_STOP=1 <"$PC/post-push.sql" | sed 's/^/  /'
  else
    echo "  WARNING: $PC/post-push.sql missing - pattern/partial indexes were NOT restored"
  fi
else
  echo "APPLY=0: nothing was written to the database."
fi

echo "=== final parity (schema vs live database) ==="
rediff

echo "=== object census in the live database (for the record) ==="
docker exec "$PG_UUID" psql -U sltserp -d sltserp -tA -c \
  "select '  tables='||count(*) from information_schema.tables where table_schema='public'"
grep -c '^model ' "$PC"/schema/*.prisma 2>/dev/null | awk -F: '{s+=$2} END {print "  models declared in the uploaded schema: " s}'
