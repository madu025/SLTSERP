#!/usr/bin/env bash
# Mint a Coolify API token for CLI/CI control (no browser), then lock down
# public registration. Idempotent: an existing working token is reused.
set -uo pipefail

TOK=/root/coolify-api-token
RAW=/root/coolify-api-token.raw
DB='docker exec coolify-db psql -U coolify -d coolify -Atc'

probe() {
  local t="$1"
  [ -z "$t" ] && return 1
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $t" \
    http://127.0.0.1:8000/api/v1/teams/current)
  [ "$code" = "200" ]
}

if [ -s "$TOK" ] && probe "$(tr -d '[:space:]' < "$TOK")"; then
  echo "existing token in $TOK is valid - reusing"
else
  : > "$RAW"
  echo "=== attempt 1: session-aware tinker (currentTeam must be a Team model) ==="
  docker exec coolify php artisan tinker --execute='session(["currentTeam"=>App\Models\Team::find(0)]); $u=App\Models\User::find(0); $t=$u->createToken("cli-automation",["*"]); echo "TOK=".$t->plainTextToken.PHP_EOL;' >"$RAW" 2>&1
  grep -o 'TOK=[^[:space:]]*' "$RAW" | head -1 | sed 's/TOK=//' >"$TOK"
  chmod 600 "$TOK"
  
  if ! probe "$(cat "$TOK")"; then
    echo "=== attempt 2: direct row insert (Sanctum-compatible) ==="
    # Replicates App\Models\User::createToken(): plaintext = 40 alnum chars + crc32b
    # of those chars; the stored column is sha256(plaintext); the returned credential
    # is "<row id>|<plaintext>".
    PLAIN=$(docker exec coolify php -r '$s="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; $e=""; for($i=0;$i<40;$i++){$e.=$s[random_int(0,strlen($s)-1)];} echo $e.hash("crc32b",$e);')
    HASH=$(printf '%s' "$PLAIN" | sha256sum | cut -d' ' -f1)
    SQL="insert into personal_access_tokens (name,token,abilities,team_id,tokenable_id,tokenable_type,created_at,updated_at) values ('cli-automation','$HASH','[\"*\"]',0,0,'App\\Models\\User',now(),now()) returning id"
    ID=$($DB "$SQL" 2>&1)
    echo "  insert returned: ${ID:-<empty>}"
    if [ -n "${ID:-}" ] && [ "$ID" = "${ID//[^0-9]/}" ]; then
      printf '%s|%s\n' "$ID" "$PLAIN" >"$TOK"
      chmod 600 "$TOK"
    fi
  fi
  
  if probe "$(cat "$TOK" | tr -d '[:space:]')"; then
    echo "token OK (stored in $TOK, chmod 600, deliberately not printed)"
  else
    echo "TOKEN FAILED - tinker output was:"; tail -8 "$RAW"
    echo "  tokens table:"; $DB "select '  id='||id||' name='||name||' team='||team_id||' hash10='||left(token,10) from personal_access_tokens"
    exit 1
  fi
fi

echo "=== registration lockdown ==="
$DB "select column_name from information_schema.columns where table_name='instance_settings' and column_name ilike '%registration%'" | sed 's/^/  column: /'
$DB "update instance_settings set is_registration_enabled=false where is_registration_enabled=true" 2>&1 | sed 's/^/  update: /'
$DB "select id,name,is_registration_enabled from instance_settings" 2>&1 | sed 's/^/  now:    /'

echo "=== root user ==="
$DB "select id||' | '||email||' | created '||created_at::text from users"
