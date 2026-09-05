#!/usr/bin/env bash
# ==========================================================================
# SLTSERP - create the Coolify resources for the database move (API only).
# Non-destructive: creates a brand new Postgres 17 + Redis and a scheduled
# backup. Nothing is restored or switched over here, and the running app
# keeps talking to Supabase until the cutover step.
# Idempotent: state is kept in /root/sltserp-coolify.env and reused.
# ==========================================================================
set -uo pipefail

T=$(tr -d '[:space:]' < /root/coolify-api-token)
BASE=http://127.0.0.1:8000/api/v1
SERVER_UUID=4rsokr1xcbrlfnej4uruvdjj
STATE=/root/sltserp-coolify.env
[ -f "$STATE" ] && . "$STATE"
# Carry generated passwords across runs under their stored names, otherwise a
# second run would blank them out of the state file.
PG_PW=${PG_PW:-${PG_PASSWORD:-}}
RD_PW=${RD_PW:-${REDIS_PASSWORD:-}}

# Payload files carry database passwords, so they never live in world-readable /tmp.
umask 077
WORK=/root/.coolify-provision
mkdir -p "$WORK"

say() { printf '%s\n' "$*"; }
fail() { printf 'FAILED: %s\n' "$*" >&2; exit 1; }

# api METHOD PATH [JSONFILE] -> response body on stdout; exits unless 2xx
api() {
  local m=$1 p=$2 f=${3:-} status
  if [ -n "$f" ]; then
    status=$(curl -s -o "$WORK/api.body" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $T" -H 'Content-Type: application/json' --data @"$f" "$BASE$p")
  else
    status=$(curl -s -o "$WORK/api.body" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $T" "$BASE$p")
  fi
  if [ "$status" -ge 200 ] 2>/dev/null && [ "$status" -lt 300 ] 2>/dev/null; then
    cat "$WORK/api.body"
    return 0
  fi
  fail "$m $p -> HTTP $status: $(head -c 400 "$WORK/api.body")"
}

# ---------------------------------------------------------------- project --
if [ -z "${PROJECT_UUID:-}" ]; then
  say "=== project ==="
  api GET /projects > "$WORK/projects.json"
  PROJECT_UUID=$(python3 -c "import json;d=json.load(open('$WORK/projects.json'));m=[p for p in d if p['name']=='sltserp'];print(m[0]['uuid'] if m else '')")
  if [ -z "$PROJECT_UUID" ]; then
    python3 -c "import json;print(json.dumps({'name':'sltserp','description':'SLTSERP ERP - VPS Postgres, queue and workers (moved off Supabase)'}))" > "$WORK/newproj.json"
    api POST /projects "$WORK/newproj.json" > "$WORK/createdproj.json"
    PROJECT_UUID=$(python3 -c "import json;print(json.load(open('$WORK/createdproj.json'))['uuid'])")
  fi
  say "project uuid: $PROJECT_UUID"
fi

if [ -z "${ENV_UUID:-}" ]; then
  api GET "/projects/$PROJECT_UUID" > "$WORK/proj.json"
  ENV_LINE=$(python3 -c "import json;d=json.load(open('$WORK/proj.json'));e=[x for x in d['environments'] if x['name']=='production'] or d['environments'];print(e[0]['name'], e[0]['uuid'])")
  ENV_NAME=${ENV_LINE% *}
  ENV_UUID=${ENV_LINE##* }
  say "environment: $ENV_NAME / $ENV_UUID"
fi

# --------------------------------------------------------------- postgres --
if [ -z "${PG_UUID:-}" ]; then
  say "=== postgres 17 ==="
  PG_PW=${PG_PW:-$(openssl rand -hex 24)}
  python3 - "$SERVER_UUID" "$PROJECT_UUID" "$ENV_NAME" "$ENV_UUID" "$PG_PW" > "$WORK/pg.json" <<'PY'
import base64, json, sys
srv, proj, envn, envu, pw = sys.argv[1:6]
conf = "\n".join([
    "max_connections = 100",
    "shared_buffers = 512MB",
    "effective_cache_size = 2GB",
    "work_mem = 16MB",
    "maintenance_work_mem = 128MB",
    "wal_level = replica",
    "checkpoint_completion_target = 0.9",
    "min_wal_size = 1GB",
    "max_wal_size = 4GB",
    "random_page_cost = 1.1",
    "effective_io_concurrency = 300",
    "log_min_duration_statement = 1000",
    "log_line_prefix = '%m [%p] '",
])
print(json.dumps({
    "server_uuid": srv, "project_uuid": proj,
    "environment_name": envn, "environment_uuid": envu,
    "name": "sltserp-db", "description": "SLTSERP primary database - moved off Supabase",
    "image": "docker.io/library/postgres:17-alpine",
    "postgres_db": "sltserp", "postgres_user": "sltserp", "postgres_password": pw,
    "postgres_conf": base64.b64encode(conf.encode()).decode(),
    "is_public": False, "instant_deploy": True,
    "limits_cpus": "2", "limits_memory": "1536M", "limits_memory_reservation": "256M",
    "tags": ["sltserp", "database"],
}))
PY
  api POST /databases/postgresql "$WORK/pg.json" > "$WORK/pgres.json"
  PG_UUID=$(python3 -c "import json;print(json.load(open('$WORK/pgres.json'))['uuid'])")
  say "postgres uuid: $PG_UUID"
fi

# ------------------------------------------------------------------ redis --
if [ -z "${REDIS_UUID:-}" ]; then
  say "=== redis (BullMQ) ==="
  RD_PW=${RD_PW:-$(openssl rand -hex 20)}
  python3 - "$SERVER_UUID" "$PROJECT_UUID" "$ENV_NAME" "$ENV_UUID" "$RD_PW" > "$WORK/rd.json" <<'PY'
import base64, json, sys
srv, proj, envn, envu, pw = sys.argv[1:6]
# Mirrors docker-compose.vps.yml: noeviction so a full queue fails loudly
# instead of silently dropping the delayed jobs that carry our bucket cadences.
conf = "\n".join([
    "maxmemory 200mb",
    "maxmemory-policy noeviction",
    "save 60 1",
    "loglevel warning",
])
print(json.dumps({
    "server_uuid": srv, "project_uuid": proj,
    "environment_name": envn, "environment_uuid": envu,
    "name": "sltserp-queue", "description": "BullMQ queue and cache for the sync workers",
    "image": "docker.io/library/redis:7-alpine",
    "redis_password": pw, "redis_conf": base64.b64encode(conf.encode()).decode(),
    "is_public": False, "instant_deploy": True,
    "limits_cpus": "1", "limits_memory": "320M", "limits_memory_reservation": "64M",
    "tags": ["sltserp", "queue"],
}))
PY
  api POST /databases/redis "$WORK/rd.json" > "$WORK/rdres.json"
  REDIS_UUID=$(python3 -c "import json;print(json.load(open('$WORK/rdres.json'))['uuid'])")
  say "redis uuid: $REDIS_UUID"
fi

# ----------------------------------------------------------------- backup --
if [ -z "${BACKUP_UUID:-}" ]; then
  say "=== scheduled backup (03:15 UTC = 08:45 Colombo, local disk, 14 copies) ==="
  python3 -c 'import json;print(json.dumps({
    "frequency":"15 3 * * *","databases_to_backup":"sltserp","dump_all":False,
    "enabled":True,"save_s3":False,"backup_now":False,"timeout":1800,
    "database_backup_retention_amount_locally":14,
    "database_backup_retention_days_locally":7}))' > "$WORK/bk.json"
  api POST "/databases/$PG_UUID/backups" "$WORK/bk.json" > "$WORK/bkres.json"
  BACKUP_UUID=$(python3 -c "import json;d=json.load(open('$WORK/bkres.json'));print(d.get('uuid',''))" 2>/dev/null)
  say "backup uuid: ${BACKUP_UUID:-$(head -c 200 "$WORK/bkres.json")}"
fi

umask 077
cat > "$STATE" <<EOF
SERVER_UUID=$SERVER_UUID
PROJECT_UUID=$PROJECT_UUID
ENV_NAME=${ENV_NAME:-production}
ENV_UUID=$ENV_UUID
PG_UUID=$PG_UUID
PG_PASSWORD=${PG_PW:-}
REDIS_UUID=$REDIS_UUID
REDIS_PASSWORD=${RD_PW:-}
BACKUP_UUID=${BACKUP_UUID:-}
EOF
say "state (incl. generated passwords) written to $STATE, mode 600"

say "=== containers now ==="
docker ps --format '{{.Names}}  {{.Status}}  {{.Image}}' | sort
