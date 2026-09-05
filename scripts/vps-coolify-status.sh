#!/usr/bin/env bash
# Check that Coolify's deploy queue brought the new database resources up.
T=$(tr -d '[:space:]' < /root/coolify-api-token)
. /root/sltserp-coolify.env
for u in "$PG_UUID" "$REDIS_UUID"; do
  curl -s -H "Authorization: Bearer $T" "http://127.0.0.1:8000/api/v1/databases/$u" \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print('  %-14s status=%-10s state=%-8s image=%s' % (d.get('name'),d.get('status'),d.get('created_at'),d.get('postgres_image') or d.get('redis_image') or d.get('image')))"
done
echo '--- containers ---'
docker ps -a --format '{{.Names}}  {{.Status}}  {{.Image}}' | grep -viE 'coolify' | sort
echo '--- recent coolify logs (deployment of the new resources) ---'
docker logs --since 3m coolify 2>&1 | grep -iE 'deploy|postgres|redis|error' | tail -8
