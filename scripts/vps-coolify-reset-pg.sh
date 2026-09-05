#!/usr/bin/env bash
# Remove the crash-looping Postgres resource created minutes ago (it holds no
# data) so the corrected provisioning script recreates it cleanly.
set -uo pipefail
T=$(tr -d '[:space:]' < /root/coolify-api-token)
. /root/sltserp-coolify.env

if [ -z "${PG_UUID:-}" ]; then
  echo "no PG_UUID in state - nothing to reset"
  exit 0
fi

echo "deleting database resource $PG_UUID"
curl -s -X DELETE -H "Authorization: Bearer $T" \
  "http://127.0.0.1:8000/api/v1/databases/$PG_UUID?deleteVolumes=true" | head -c 300
echo
sed -i '/^PG_UUID=/d; /^PG_PASSWORD=/d; /^BACKUP_UUID=/d' /root/sltserp-coolify.env
sleep 8
echo "--- state after reset ---"
grep -vE 'PASSWORD' /root/sltserp-coolify.env
echo "--- leftover volumes/containers named for it ---"
docker volume ls | grep "$PG_UUID" || echo "  volume removed"
docker ps -a --format '{{.Names}}' | grep "$PG_UUID" || echo "  container removed"
