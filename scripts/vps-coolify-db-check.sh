#!/usr/bin/env bash
# Verify the recreated Postgres actually accepts connections with the tuned conf,
# and map the docker networks Coolify placed it on (needed for the app cutover).
set -uo pipefail
T=$(tr -d '[:space:]' < /root/coolify-api-token)
. /root/sltserp-coolify.env

echo "--- psql inside $PG_UUID ---"
docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "select version();"
docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc \
  "select name||'='||setting from pg_settings where name in ('shared_buffers','effective_cache_size','work_mem','maintenance_work_mem','max_connections','wal_level','random_page_cost','effective_io_concurrency','max_wal_size','log_min_duration_statement') order by name;"
docker exec "$PG_UUID" psql -U sltserp -d sltserp -tAc "select current_database(), current_user, count(*) from pg_stat_activity;"

echo "--- networks: coolify db / queue / existing app stack ---"
for c in "$PG_UUID" "$REDIS_UUID" sltserp-app sltserp-nginx; do
  printf '%-26s %s\n' "$c" "$(docker inspect -f '{{range $n,$v := .NetworkSettings.Networks}}{{$n}}={{$v.IPAddress}} {{end}}' "$c" 2>/dev/null)"
done

echo "--- all docker networks ---"
docker network ls --format '{{.Name}}  {{.Driver}}  {{.Scope}}' | sort

echo "--- db env keys as Coolify sees them ---"
docker exec "$PG_UUID" env | grep -E 'POSTGRES_|_PORT' | sort

echo "--- connection-string endpoint available? ---"
python3 -c "
import json
d=json.load(open('/opt/coolify-v4.3.17/openapi.json'))
for p,ops in sorted(d['paths'].items()):
    if 'connection' in p or p.startswith('/databases/') and 'env' in p:
        print('  ', p, list(ops))
"
echo "--- app-tier endpoints (what Coolify can own for the sync workers) ---"
python3 -c "
import json
d=json.load(open('/opt/coolify-v4.3.17/openapi.json'))
for p,ops in sorted(d['paths'].items()):
    if p.startswith('/applications') or p.startswith('/deploy') or p.startswith('/scheduled') or p.startswith('/services'):
        print('  ', p, list(ops))
"
