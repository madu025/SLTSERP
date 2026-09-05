#!/usr/bin/env bash
# Probe the Coolify API with the stored token and show the real rejection body.
T=$(tr -d '[:space:]' < /root/coolify-api-token)
echo "token id prefix: ${T%%|*}  total length: ${#T}"
for ep in /api/v1/version /api/v1/teams/current /api/v1/resources; do
  echo "--- $ep ---"
  curl -s -w $'\nHTTP %{http_code}\n' -H "Authorization: Bearer $T" "http://127.0.0.1:8000$ep" | head -c 400
  echo
done
echo "--- laravel log tail (auth failures) ---"
docker exec coolify sh -c 'tail -n 25 storage/logs/laravel.log 2>/dev/null | grep -iE "token|auth|abil|denied|exception" | tail -12' 2>&1 | head -15
