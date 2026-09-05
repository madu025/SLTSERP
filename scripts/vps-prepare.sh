#!/usr/bin/env bash
# ==========================================================================
# SLTSERP - prepare a fresh Ubuntu VPS as the background-sync host.
# ==========================================================================
# Run this ONCE on the new server, before the first deploy:
#     sudo bash scripts/vps-prepare.sh erp-sync.yourdomain.lk
#
# Pass "none" as the domain to provision docker/swap/directories only and skip
# the certificate step, then re-run with the real domain once DNS points here.
#
# It installs docker + certbot, creates the app directory, obtains the TLS
# certificate, and sets up renewal. It never starts the application - that is
# smart-deploy.ps1 from the workstation (the Next.js build happens locally, so
# this box only ever copies files into an image).
#
# Every step inspects current state first and leaves it alone when it is
# already right, so re-running after a failed attempt is safe.
# Firewall changes are opt-in (--with-ufw) because a wrong order can lock out
# SSH; the script prints the exact commands instead of guessing for you.
# ==========================================================================
set -euo pipefail

DOMAIN="${1:?usage: sudo bash scripts/vps-prepare.sh <domain> [--with-ufw]}"
WITH_UFW=0
[[ "${2:-}" == "--with-ufw" ]] && WITH_UFW=1

APP_DIR="${APP_DIR:-$HOME/slts-erp}"
ACME_WEBROOT=/var/www/certbot
# Optional; without it Let's Encrypt registers the account anonymously (renewals
# are automated by the certbot timer, so expiry mail is a convenience not a need).
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
SKIP_CERT=0
[[ "$DOMAIN" == "none" ]] && SKIP_CERT=1

step() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
    echo "Run with sudo: sudo bash scripts/vps-prepare.sh $DOMAIN" >&2
    exit 1
fi
REAL_USER="${SUDO_USER:-$USER}"

# ---------------------------------------------------------------- DNS check
step "Checking that $DOMAIN resolves to this host"
LOCAL_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
BOX_IP6=$(ip -6 route get 2001:4860:4860::8888 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
PUB_IP=$(curl -fs --max-time 10 https://api.ipify.org || echo "")
# Ask for the A and AAAA answers separately: a free DNS provider often hands back
# the IPv6 line first, which made a correct IPv4 record look like a mismatch.
RESOLVED4=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | paste -sd' ' - || true)
RESOLVED6=$(getent ahostsv6 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | paste -sd' ' - || true)
echo "   interface ip : ${LOCAL_IP:-unknown} / ${BOX_IP6:-no ipv6}"
echo "   public ip    : ${PUB_IP:-unresolved}"
echo "   $DOMAIN v4 -> ${RESOLVED4:-none}"
echo "   $DOMAIN v6 -> ${RESOLVED6:-none}"
MATCHES=0
[[ -n "$PUB_IP" && " $RESOLVED4 " == *" $PUB_IP "* ]] && MATCHES=1
[[ -n "$LOCAL_IP" && " $RESOLVED4 " == *" $LOCAL_IP "* ]] && MATCHES=1
[[ -n "$BOX_IP6" && " $RESOLVED6 " == *" $BOX_IP6 "* ]] && MATCHES=1
if [[ -z "$RESOLVED4$RESOLVED6" ]]; then
    warn "No DNS answer yet. Point an A record at this server before certbot runs."
elif [[ "$MATCHES" == 0 ]]; then
    warn "$DOMAIN resolves to ${RESOLVED4:-$RESOLVED6} but this box is ${PUB_IP:-$LOCAL_IP}. Certificate will fail."
elif [[ -z "$RESOLVED4" && -n "$RESOLVED6" ]]; then
    warn "Only an IPv6 answer exists. Let's Encrypt must be able to reach this box over IPv6."
fi

# ------------------------------------------------------------------ packages
step "Installing base packages (docker, compose plugin, certbot, rsync)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq apt-transport-https ca-certificates curl gnupg \
    ufw rsync certbot docker.io docker-compose-v2 >/dev/null

if systemctl is-enabled --quiet docker 2>/dev/null; then
    echo "   docker service already enabled"
else
    systemctl enable --now docker
fi
id -nG "$REAL_USER" | grep -qw docker || usermod -aG docker "$REAL_USER"
echo "   docker: $(docker --version), compose: $(docker compose version --short)"

# --------------------------------------------------------------------- swap
step "Checking swap (prisma generate and node workers need headroom)"
SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')
if [[ -z "$SWAP_MB" || "$SWAP_MB" -lt 512 ]]; then
    if [[ -f /swapfile ]]; then
        warn "/swapfile exists but swap is ${SWAP_MB}MB - check swapon --show"
    else
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null
        swapon /swapfile
        grep -q ' /swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
        echo "   added 2G /swapfile"
    fi
else
    echo "   already ${SWAP_MB}MB"
fi

# ------------------------------------------------------------------ firewall
step "Firewall"
ufw status verbose || true
if [[ "$WITH_UFW" == "1" ]]; then
    ufw allow OpenSSH
    ufw allow 80
    ufw allow 443
    ufw --force enable
    echo "   allowed 22/80/443 only. 3000 (app) and 6379 (redis) stay closed;"
    echo "   the compose file publishes neither to the host."
else
    warn "Firewall left as-is. When ready: ufw allow OpenSSH; ufw allow 80; ufw allow 443; ufw enable"
    warn "Never open 3000 or 6379 - Redis is shared with the app over the docker network only."
fi

# ----------------------------------------------------------------- directories
step "Directories"
mkdir -p "$APP_DIR" "$ACME_WEBROOT"
chown "$REAL_USER":"$REAL_USER" "$APP_DIR"
echo "   app dir   : $APP_DIR"
echo "   acme root : $ACME_WEBROOT"

# ---------------------------------------------------------------- certificate
if [[ "$SKIP_CERT" == "1" ]]; then
    step "TLS certificate skipped (domain = none)"
    warn "Re-run this script with the real domain once its A record points at this box."
else
step "TLS certificate for $DOMAIN"
# Let's Encrypt wants a contact address for expiry notices; only the non-interactive
# form is safe here because this script runs over ssh without a tty.
if [[ -n "$CERTBOT_EMAIL" ]]; then
    MAIL_OPTS=(-m "$CERTBOT_EMAIL")
else
    MAIL_OPTS=(--register-unsafely-without-email)
fi
if certbot certificates 2>/dev/null | grep -q "Certificate Name: $DOMAIN"; then
    echo "   certificate already issued, skipping"
else
    # Nothing is listening on :80 yet on a fresh box, so standalone is the easiest
    # first issue. Renewals then go through the webroot so nginx never has to stop.
    certbot certonly --standalone -d "$DOMAIN" --agree-tos --no-eff-email \
        "${MAIL_OPTS[@]}"
fi
certbot certonly --webroot -w "$ACME_WEBROOT" -d "$DOMAIN" --keep-until-expiring --quiet \
    --agree-tos "${MAIL_OPTS[@]}" || true
fi

HOOK=/etc/letsencrypt/renewal-hooks/deploy/sltserp-nginx.sh
if [[ ! -f "$HOOK" ]]; then
    mkdir -p "$(dirname "$HOOK")"
    cat >"$HOOK" <<EOF
#!/usr/bin/env bash
# Reload the proxy so a renewed certificate is actually served.
docker compose -f "$APP_DIR/docker-compose.vps.yml" restart nginx >/dev/null 2>&1 || true
EOF
    chmod 755 "$HOOK"
    echo "   wrote renewal deploy hook $HOOK"
fi
if systemctl list-timers --all 2>/dev/null | grep -q certbot; then
    echo "   certbot renewal timer is active"
else
    warn "No certbot timer found. Add: systemctl enable --now certbot-renew.timer (or cron '@daily certbot renew')"
fi

cat <<EOF

Done. Next steps:

  1. On this box, create $APP_DIR/.env with the same contents as the local
     .env, plus one extra line nginx needs:
         SLTSERP_DOMAIN=$DOMAIN

  2. From the workstation (PowerShell), build and ship:
         ./smart-deploy.ps1 -Ip <this-ip> -Key <path-to-pem> -ComposeFile docker-compose.vps.yml

  3. Watch the worker boot - the whole point of this box is this line:
         ssh $REAL_USER@<this-ip> 'docker logs sltserp-app' | head -50
     Look for: [INSTRUMENTATION] Node.js runtime detected, initializing workers...
     If you see "Vercel serverless environment detected" or "workers disabled",
     the container environment is wrong and the sync will not drain.

  4. Move the single clock (cron-job.org) to this host - run locally:
         node scripts/setup-cron.js https://$DOMAIN

  5. Leave Vercel alone on purpose. Its /api/cron/sync-all still works in the
     40s inline mode, so if this VPS ever dies you restore service with one
     command and no code change:
         node scripts/setup-cron.js https://sltserp.vercel.app
     Only one of the two is ever called, because cron-job.org holds one job -
     there is no second clock running in the background.
EOF
