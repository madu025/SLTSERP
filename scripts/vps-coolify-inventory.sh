#!/usr/bin/env bash
# Coolify inventory + host headroom after installation.
T=$(tr -d '[:space:]' < /root/coolify-api-token)
H="Authorization: Bearer $T"
echo "--- servers ---"
curl -s -H "$H" http://127.0.0.1:8000/api/v1/servers | head -c 900; echo
echo "--- projects ---"
curl -s -H "$H" http://127.0.0.1:8000/api/v1/projects | head -c 500; echo
echo "--- host headroom ---"
free -m | head -2
df -h / | tail -1
docker ps --format '{{.Names}}  {{.Status}}' | sort
