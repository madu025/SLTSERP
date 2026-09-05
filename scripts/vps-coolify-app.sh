#!/usr/bin/env bash
# ==========================================================================
# Hand the sync/app tier to Coolify: register the Next.js app (the process that
# runs the BullMQ workers and drains the Master Tick queue) as a Coolify
# resource, and make Coolify authoritative for its env vars.
#
# NON-DESTRUCTIVE ON PURPOSE: instant_deploy=false and auto-deploy off, so no
# second app container is created. The compose stack keeps serving until the
# cutover window. Do not trigger a deploy before the database restore has run.
# ==========================================================================
set -uo pipefail
T=$(tr -d '[:space:]' < /root/coolify-api-token)
BASE=http://127.0.0.1:8000/api/v1
STATE=/root/sltserp-coolify.env
. "$STATE"

umask 077
WORK=/root/.coolify-provision
mkdir -p "$WORK"
say() { printf '%s\n' "$*"; }
fail() { printf 'FAILED: %s\n' "$*" >&2; exit 1; }
api() {
  local m=$1 p=$2 f=${3:-} status
  if [ -n "$f" ]; then
    status=$(curl -s -o "$WORK/api.body" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $T" -H 'Content-Type: application/json' --data @"$f" "$BASE$p")
  else
    status=$(curl -s -o "$WORK/api.body" -w '%{http_code}' -X "$m" -H "Authorization: Bearer $T" "$BASE$p")
  fi
  if [ "$status" -ge 200 ] 2>/dev/null && [ "$status" -lt 300 ] 2>/dev/null; then cat "$WORK/api.body"; return 0; fi
  fail "$m $p -> HTTP $status: $(head -c 500 "$WORK/api.body")"
}

say "=== headroom (a Coolify build runs npm ci + next build on this box) ==="
free -m | awk 'NR>=2 && NR<=3 {printf "  %-8s total=%-6s used=%-6s avail=%s\n",$1,$2,$3,$7}'
swapon --show --noheadings 2>/dev/null | awk '{print "  swapfile: "$1" size="$3}' || true
[ -z "$(swapon --show --noheadings 2>/dev/null)" ] && say "  swapfile: NONE"
df -h /var/lib/docker | awk 'NR==2{print "  docker fs: used "$3" of "$2" ("$5")"}'
printf '  app container memory now: '; docker stats --no-stream --format '{{.MemUsage}}' sltserp-app 2>/dev/null || echo n/a

say "=== storage mount contract ==="
python3 - <<'PY'
import json
d = json.load(open('/opt/coolify-v4.3.17/openapi.json'))
for path in ('/applications/{uuid}/storages', '/applications/{uuid}/envs',
             '/applications/{uuid}/envs/bulk'):
    op = d['paths'][path]['post'] if path.endswith('/envs') else d['paths'][path].get('post') or d['paths'][path].get('patch')
    sch = op['requestBody']['content']['application/json']['schema']
    if '$ref' in sch:
        sch = d['components']['schemas'][sch['$ref'].split('/')[-1]]
    props = sch.get('properties') or (sch.get('items') or {}).get('properties', {})
    print('%s\n  required=%s\n  fields=%s' % (path, sch.get('required') or (sch.get('items') or {}).get('required'), sorted(props)))
PY

# ------------------------------------------------------------------- app --
if [ -z "${APP_UUID:-}" ]; then
  say "=== registering the app resource (no deploy) ==="
  python3 - "$SERVER_UUID" "$PROJECT_UUID" "$ENV_NAME" "$ENV_UUID" "$PG_UUID" "$REDIS_UUID" "$PG_PASSWORD" "$REDIS_PASSWORD" > "$WORK/app.json" <<'PY'
import json, sys
srv, proj, envn, envu, pgu, rdu, pgpw, rdpw = sys.argv[1:9]
print(json.dumps({
    "server_uuid": srv, "project_uuid": proj,
    "environment_name": envn, "environment_uuid": envu,
    "name": "sltserp-sync",
    "description": "Next.js app plus BullMQ workers - executes the master tick",
    "git_repository": "https://github.com/madu025/SLTSERP.git",
    "git_branch": "main",
    "build_pack": "dockerfile",
    "dockerfile_location": "/Dockerfile",
    "ports_exposes": "3000",
    "instant_deploy": False,
    "is_auto_deploy_enabled": False,
    "is_raw_compose_deployment_enabled": False,
    "health_check_enabled": False,
    "base_directory": "",
    "limits_cpus": "2",
    "limits_memory": "1536M",
    "limits_memory_reservation": "384M",
    "docker_images_to_keep": 3,
    "tags": ["sltserp", "sync"],
}))
PY
  api POST /applications/public "$WORK/app.json" > "$WORK/appres.json"
  APP_UUID=$(python3 -c "import json;print(json.load(open('$WORK/appres.json'))['uuid'])")
  say "app uuid: $APP_UUID"
  sed -i '/^APP_UUID=/d' "$STATE"; echo "APP_UUID=$APP_UUID" >> "$STATE"
else
  say "app resource already registered: $APP_UUID"
fi

# -------------------------------------------------------------- env mirror --
say "=== seeding Coolify env vars (values never printed) ==="
python3 - "$T" "$BASE" "$APP_UUID" "$PG_UUID" "$REDIS_UUID" "$PG_PASSWORD" "$REDIS_PASSWORD" <<'PY'
import json, re, sys, urllib.request
tok, base, app, pgu, rdu, pgpw, rdpw = sys.argv[1:8]

def post(payload):
    req = urllib.request.Request(base + '/applications/%s/envs' % app,
                                 data=json.dumps(payload).encode(),
                                 headers={'Authorization': 'Bearer ' + tok,
                                          'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()[:120]
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200]

def shape(v):
    return re.sub(r'://[^@/\s]*@', '://***@', v)[:70]

seen, rows = set(), []
src = '/root/slts-erp/.env'
with open(src, encoding='utf-8', errors='replace') as fh:
    for line in fh:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip()
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', k):
            continue
        v = v.strip().strip('"').strip("'")
        rows.append((k, v))

# The VPS-targeted values always win over whatever the running box still uses.
overrides = {
    'NODE_ENV': 'production',
    'TZ': 'Asia/Colombo',
    'HOSTNAME': '0.0.0.0',
    'DISABLE_BACKGROUND_WORKERS': 'false',
    'CRON_INLINE_MODE': 'false',
    'DATABASE_URL': 'postgresql://sltserp:%s@%s:5432/sltserp' % (pgpw, pgu),
    'DIRECT_URL': 'postgresql://sltserp:%s@%s:5432/sltserp' % (pgpw, pgu),
    'REDIS_URL': 'redis://:%s@%s:6379' % (rdpw, rdu),
}
merged = {k: v for k, v in rows}
merged.update(overrides)

for k in sorted(merged):
    if k in seen:
        continue
    seen.add(k)
    st, body = post({'key': k, 'value': merged[k], 'is_literal': True,
                     'is_multiline': False, 'is_preview': False, 'is_shown_once': False})
    mark = 'ok ' if st in (200, 201) else 'ERR'
    # Never print a value. URLs may be shown credential-stripped because the
    # Coolify container name they point at is the whole point of the line.
    shown = shape(merged[k]) if k.endswith('_URL') else '(%d chars)' % len(merged[k])
    tag = '  <- target' if k in overrides else ''
    print('  %s %-32s %s%s' % (mark, k, shown, tag))
    if st not in (200, 201):
        print('      %s' % body.decode(errors='replace'))
print('  total keys pushed: %d (from .env: %d)' % (len(seen), len(rows)))
PY

say "=== resource summary ==="
api GET "/applications/$APP_UUID" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('  name=%s uuid=%s status=%s build_pack=%s dockerfile=%s repo=%s branch=%s deploy=%s' % (
  d.get('name'), d.get('uuid'), d.get('status'), d.get('build_pack'),
  d.get('dockerfile_location'), d.get('git_repository'), d.get('git_branch'), d.get('instant_deploy')))
"
