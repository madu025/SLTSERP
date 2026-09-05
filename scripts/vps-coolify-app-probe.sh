#!/usr/bin/env bash
# What can Coolify use as the app (sync worker) source of truth?
# Probe: existing checkout auth, github reachability, deploy-key API contract,
# and the current container env so it can be mirrored later.
set -uo pipefail
cd /root/slts-erp 2>/dev/null || echo "NO /root/slts-erp"

echo "--- checkout ---"
git -C /root/slts-erp remote -v 2>&1 | head -4
git -C /root/slts-erp log -1 --format='%h %ci %d' 2>&1
git -C /root/slts-erp config --get credential.helper 2>&1
git -C /root/slts-erp status --porcelain 2>&1 | head -5

echo "--- ssh keys present ---"
ls -la /root/.ssh 2>/dev/null | grep -E 'id_|authorized' 

echo "--- github ssh auth as this box ---"
timeout 15 ssh -o StrictHostKeyChecking=no -o BatchMode=yes -T git@github.com 2>&1 | head -3

echo "--- deploy-key / tail / webhook endpoints ---"
python3 -c "
import json
d=json.load(open('/opt/coolify-v4.3.17/openapi.json'))
for p,ops in sorted(d['paths'].items()):
    if any(k in p for k in ('deploy-key','/tail','webhook','/servers/')):
        print('  ', p, list(ops))
"

echo "--- private-deploy-key required fields ---"
python3 -c "
import json
d=json.load(open('/opt/coolify-v4.3.17/openapi.json'))
op=d['paths']['/applications/private-deploy-key']['post']
ref=op['requestBody']['content']['application/json']['schema']['\$ref'].split('/')[-1]
s=d['components']['schemas'][ref]
props=s['properties']
print('required:', s.get('required'))
for k in sorted(props):
    v=props[k]
    dv=v.get('default', v.get('examples', v.get('example','')))
    print('  %-42s %-10s default=%s' % (k, v.get('type','?'), dv))
"

echo "--- how the app container is currently started ---"
docker inspect -f 'image={{.Config.Image}} network={{range $n,$v := .NetworkSettings.Networks}}{{$n}}={{$v.IPAddress}} {{end}} restart={{.HostConfig.RestartPolicy.Name}} entrypoint={{.Config.Entrypoint}}' sltserp-app
echo '--- upstream target in nginx ---'
grep -nE 'proxy_pass|server .*3000|location' nginx/conf.d/*.conf 2>/dev/null | head -20
echo '--- compose file services ---'
grep -nE '^\s{2}[a-z-]+:|image:|container_name:|DATABASE_URL|REDIS_URL|ports:|command:' docker-compose.vps.yml | head -40
