#!/usr/bin/env bash
# Hand Coolify the operational duties it can already do, and align them with the
# fixed 0/10/20/30/40/50 tick grid (no work may land on a grid minute).
# Also: is the GitHub repo reachable without credentials? That decides how the
# app/sync tier can be sourced.
set -uo pipefail
T=$(tr -d '[:space:]' < /root/coolify-api-token)
BASE=http://127.0.0.1:8000/api/v1
. /root/sltserp-coolify.env

echo "=== 1. cleanup window off the tick grid: 0 0 * * * -> 17 4 * * * ==="
cat > /root/.dk.json <<'JSON'
{"docker_cleanup_frequency":"17 4 * * *","docker_cleanup_threshold":80,"force_docker_cleanup":true,"delete_unused_volumes":false,"delete_unused_networks":false,"disable_application_image_retention":false}
JSON
curl -s -X PATCH -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  --data @/root/.dk.json "$BASE/servers/$SERVER_UUID/docker-cleanup" -o /root/.dk.out -w 'HTTP %{http_code}\n'
head -c 300 /root/.dk.out; echo
rm -f /root/.dk.json /root/.dk.out

echo "=== 2. stop Coolify from self-updating nightly (manual updates only) ==="
docker exec coolify php artisan tinker --execute='
$s = App\Models\InstanceSettings::get();
$before = $s->is_auto_update_enabled;
$s->is_auto_update_enabled = false;
$s->save();
$s2 = App\Models\InstanceSettings::get();
echo "auto_update before=" . var_export($before, true) . " after=" . var_export($s2->is_auto_update_enabled, true) . " update_check=" . $s2->update_check_frequency . PHP_EOL;' 2>&1 | tail -2

echo "=== 3. unauthenticated reachability of the source repo ==="
for url in madu025/SLTSERP; do
  code=$(curl -s -o /root/.gh.json -w '%{http_code}' -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$url")
  echo "  api.github.com/repos/$url -> HTTP $code $(python3 -c "import json;d=json.load(open('/root/.gh.json'));print('private_field='+str(d.get('private'))+' '+str(d.get('message',''))" 2>/dev/null)"
  rm -f /root/.gh.json
done

echo "=== 4. is the app source even present on the box (build context)? ==="
ls -la /root/slts-erp | head -20
du -sh /root/slts-erp 2>/dev/null
find /root/slts-erp -maxdepth 1 -name '.git*' -o -maxdepth 1 -name 'package.json' | head
