#!/usr/bin/env bash
# Enable the Coolify API, close public registration, drop the junk tokens left by
# failed minting attempts, then re-probe. All through psql on coolify-db.
set -uo pipefail
DB='docker exec coolify-db psql -U coolify -d coolify -Atc'
KEEP=4

echo "=== where the flags live ==="
$DB "select table_name||'.'||column_name from information_schema.columns where column_name in ('is_api_enabled','is_registration_enabled','allow_force_https') order by 1"

echo "=== enabling API, disabling registration ==="
$DB "update instance_settings set is_api_enabled=true, is_registration_enabled=false" 2>&1 | sed 's/^/  /'
$DB "select id||' api='||is_api_enabled::text||' reg='||is_registration_enabled::text from instance_settings" 2>&1 | sed 's/^/  now: /'

echo "=== removing duplicate cli-automation tokens (keeping id $KEEP) ==="
$DB "select '  before: id='||id from personal_access_tokens where name='cli-automation'"
$DB "delete from personal_access_tokens where name='cli-automation' and id <> $KEEP" 2>&1 | sed 's/^/  /'
$DB "select '  after:  id='||id||' team='||team_id::text from personal_access_tokens"

echo "=== re-probe API ==="
T=$(tr -d '[:space:]' < /root/coolify-api-token)
curl -s -w $'\n  HTTP %{http_code}\n' -H "Authorization: Bearer $T" http://127.0.0.1:8000/api/v1/version
curl -s -w $'\n  HTTP %{http_code}\n' -H "Authorization: Bearer $T" http://127.0.0.1:8000/api/v1/teams/current | head -c 300
