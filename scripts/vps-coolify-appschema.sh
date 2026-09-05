#!/usr/bin/env bash
# Read-only probe: (1) Coolify git-source payload contracts for the app tier,
# (2) whether freeform compose services can be created over the API (pgbouncer/minio),
# (3) current server-level automation (docker cleanup, sentinel, proxy) so we know
#     what Coolify is already doing by itself.
set -uo pipefail
T=$(tr -d '[:space:]' < /root/coolify-api-token)
BASE=http://127.0.0.1:8000/api/v1
. /root/sltserp-coolify.env
g() { curl -s -H "Authorization: Bearer $T" "$BASE$1"; }

echo "=== app endpoint contracts ==="
python3 - <<'PY'
import json
d = json.load(open('/opt/coolify-v4.3.17/openapi.json'))
for path in ('/applications/dockerfile', '/applications/dockerimage',
             '/applications/private-deploy-key', '/applications/private-github-app',
             '/applications/public', '/services', '/deploy'):
    op = d['paths'].get(path, {}).get('post')
    if not op:
        print(path, '-> no POST'); continue
    sch = op.get('requestBody', {}).get('content', {}).get('application/json', {}).get('schema', {})
    if '$ref' in sch:
        name = sch['$ref'].split('/')[-1]
        sch = d['components']['schemas'][name]
    else:
        name = path
    props = sch.get('properties', {})
    print('\n%s  (schema %s)' % (path, name))
    print('  required:', sch.get('required'))
    for k in sorted(props):
        v = props[k]
        t = v.get('type', '?')
        enum = (' enum=' + str(v['enum'])) if v.get('enum') else ''
        dv = v.get('default', v.get('example', ''))
        print('  %-40s %-8s default=%s%s' % (k, t, repr(dv)[:60], enum))
PY

echo
echo "=== server automation state ==="
printf 'docker-cleanup : '; g "/servers/$SERVER_UUID/docker-cleanup" | head -c 500; echo
printf 'sentinel       : '; g "/servers/$SERVER_UUID/sentinel" | head -c 500; echo
printf 'proxy          : '; g "/servers/$SERVER_UUID/proxy" | head -c 300; echo
printf 'resources      : '; g "/servers/$SERVER_UUID/resources" | head -c 700; echo
echo "=== instance settings (what else Coolify owns) ==="
docker exec coolify php artisan tinker --execute='
$s = App\Models\InstanceSettings::get();
echo json_encode([
  "skip_build_step" => $s->skip_build_step,
  "disable_images_cleanup" => $s->disable_images_cleanup,
  "concurrent_build_limit" => $s->concurrent_build_limit,
  "force_docker_cleanup" => $s->force_docker_cleanup,
  "docker_cleanup_frequency" => $s->docker_cleanup_frequency,
  "docker_cleanup_threshold" => $s->docker_cleanup_threshold,
  "server_batch_limit" => $s->server_batch_limit,
  "is_auto_update_enabled" => $s->is_auto_update_enabled,
  "auto_update_frequency" => $s->auto_update_frequency,
  "update_check_frequency" => $s->update_check_frequency,
  "is_api_enabled" => $s->is_api_enabled,
]);' 2>&1 | tail -3
