#!/usr/bin/env bash
# ==========================================================================
# SLTSERP - Coolify installer launcher (VPS, root)
# ==========================================================================
# Wraps the official installer (reviewed copy at /opt/coolify-v4.3.17) so that:
#   * the admin account is created from ROOT_USER_* env vars - no browser
#     registration page is ever needed,
#   * the credential is generated once and reused on re-runs,
#   * the install runs detached with a log we can read afterwards.
#
# Side effects to expect, all from the upstream script itself:
#   * /etc/docker/daemon.json is created (none exists today) and the Docker
#     daemon is restarted -> our unless-stopped containers bounce and return.
#   * the installer pulls its docker-compose manifests from cdn.coollabs.io.
# ==========================================================================
set -euo pipefail

SRC=/opt/coolify-v4.3.17/scripts/install.sh
CRED=/root/coolify-admin.cred
LOG=/var/log/coolify-install.log
EMAIL="${COOLIFY_ADMIN_EMAIL:-admin@sltserp.local}"

[ -f "$SRC" ] || { echo "installer not found at $SRC"; exit 1; }

if [ -f "$CRED" ]; then
  echo "reusing existing credential file $CRED"
else
  PW="$(openssl rand -hex 16)"
  umask 077
  {
    echo "url=http://172.255.209.243:8000"
    echo "username=root"
    echo "email=$EMAIL"
    echo "password=$PW"
  } > "$CRED"
  chmod 600 "$CRED"
  echo "admin credential written to $CRED (chmod 600)"
fi

PW="$(awk -F= '/^password=/{print $2}' "$CRED")"

echo "starting installer detached; log: $LOG"
nohup env ROOT_USERNAME=root ROOT_USER_EMAIL="$EMAIL" ROOT_USER_PASSWORD="$PW" \
  bash "$SRC" >"$LOG" 2>&1 &
echo "pid=$!"
