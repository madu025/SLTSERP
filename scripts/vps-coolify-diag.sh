#!/usr/bin/env bash
# Why is the new Postgres failing, and which endpoint updates a database resource?
. /root/sltserp-coolify.env
echo "--- postgres container stderr ---"
docker logs "$PG_UUID" --tail 20 2>&1 | tail -20
echo "--- update endpoints for databases ---"
python3 -c "
import json
d=json.load(open('/opt/coolify-v4.3.17/openapi.json'))
for p,ops in d['paths'].items():
    if 'database' in p and any(m in ops for m in ('put','patch','post')):
        print('  ', p, {m: ops[m].get('summary') for m in ops})
"
