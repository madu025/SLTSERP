#!/usr/bin/env bash
# ==========================================================================
# SLTSERP - Coolify pre-flight and host preparation (VPS)
# ==========================================================================
# Run as root on 172.255.209.243:  bash /root/vps-coolify-setup.sh
#
# What this does: verifies the box can carry Coolify alongside the running
# stack, prepares the data directories, and prints the one command the
# operator must run themselves (the upstream installer is a remote script
# piped into bash - it is deliberately not fetched or executed here).
#
# What this does NOT do: install Coolify, touch the running containers,
# change any port binding, or enable a firewall.
# ==========================================================================
set -uo pipefail

log() { printf '%s\n' "$*"; }
ok()  { printf '  [ok]   %s\n' "$*"; }
warn(){ printf '  [warn] %s\n' "$*"; }
die() { printf '  [fail] %s\n' "$*"; exit 1; }

ADD_SWAP="${1:-}"   # optional: "--add-swap" creates a 2G swapfile if none exists

log "=== 1. OS and architecture ==="
. /etc/os-release
case "${VERSION_ID:-}" in
  20.04|22.04|24.04) ok "Ubuntu ${PRETTY_NAME:-?} (LTS, supported by the quick installer)" ;;
  *)                 warn "Ubuntu ${VERSION_ID:-unknown} - the quick installer only supports 20.04/22.04/24.04 LTS; others need the manual method" ;;
esac
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|aarch64) ok "arch $ARCH (64-bit)" ;;
  *)              die "arch $ARCH is not supported" ;;
esac

log "=== 2. Docker ==="
command -v docker >/dev/null 2>&1 || die "docker is not installed"
DOCKER_MAJOR="$(docker version --format '{{.Server.Version}}' 2>/dev/null | cut -d. -f1)"
ok "docker server ${DOCKER_MAJOR:-unknown}"
[ -n "$DOCKER_MAJOR" ] && [ "$DOCKER_MAJOR" -lt 24 ] && die "Coolify needs Docker 24+ (found $DOCKER_MAJOR)"
docker info -f 'docker root: {{.DockerRootDir}}' 2>/dev/null || true
# Snap-delivered Docker is unsupported by Coolify. Check the binary path, not
# `docker info` text - that contains 'containerd.snapshotter' and always matches 'snap'.
case "$(readlink -f "$(command -v docker)")" in
  /snap/*) die "docker is installed from snap, which Coolify does not support" ;;
  *)       ok "docker binary is not snap-delivered ($(dpkg -S "$(readlink -f "$(command -v docker)")" 2>/dev/null || echo 'unknown package'))" ;;
esac

log "=== 3. Resources ==="
CORES="$(nproc)"
[ "$CORES" -ge 2 ] && ok "cpu: ${CORES} cores (min 2)" || die "cpu: ${CORES} cores, Coolify needs 2"
MEM_MB="$(free -m | awk '/^Mem:/{print $2}')"
AVAIL_MB="$(free -m | awk '/^Mem:/{print $7}')"
[ "$MEM_MB" -ge 3500 ] && ok "ram: ${MEM_MB} MB total, ${AVAIL_MB} MB available" || warn "ram: ${MEM_MB} MB total - Coolify itself wants roughly 1 GB on top of the app"
FREE_GB="$(df -BG --output=avail / | tail -1 | tr -dc '0-9')"
[ "$FREE_GB" -ge 30 ] && ok "disk: ${FREE_GB} GB free on / (min 30 GB)" || die "disk: ${FREE_GB} GB free, Coolify needs 30 GB"
SWAP_MB="$(free -m | awk '/^Swap:/{print $2}')"
if [ "$SWAP_MB" -ge 1024 ]; then
  ok "swap: ${SWAP_MB} MB"
elif [ "$ADD_SWAP" = "--add-swap" ]; then
  warn "swap: ${SWAP_MB} MB - creating /swapfile-coolify (2G)"
  if [ -f /swapfile-coolify ]; then warn "/swapfile-coolify already exists, leaving it alone"; else
    if fallocate -l 2G /swapfile-coolify && chmod 600 /swapfile-coolify && mkswap /swapfile-coolify && swapon /swapfile-coolify; then
      grep -q '/swapfile-coolify' /etc/fstab || echo '/swapfile-coolify none swap sw 0 0' >> /etc/fstab
      ok "swap enabled: $(free -m | awk '/^Swap:/{print $2}') MB"
    else
      rm -f /swapfile-coolify; warn "could not create swap (no fallocate space?) - continuing"
    fi
  fi
else
  warn "swap: ${SWAP_MB} MB - if a build ever runs on this box, re-run with --add-swap"
fi

log "=== 4. Port ownership (Coolify's own Traefik proxy binds 80/443) ==="
HELD=0
for p in 80 443; do
  if ss -ltn 2>/dev/null | grep -qE "[:.]${p}[[:space:]]"; then
    OWNER="$(ss -ltnp 2>/dev/null | grep -E "[:.]${p}[[:space:]]" | head -1 | sed -e 's/.*users:((\"//' -e 's/\".*//')"
    warn ":${p} is in use (${OWNER:-unknown}) - Coolify's proxy will not start while it is held"
    HELD=1
  else
    ok ":${p} free"
  fi
done
ss -ltn 2>/dev/null | grep -qE '[:.]8000[[:space:]]' && warn ":8000 in use - the Coolify dashboard would not bind" || ok ":8000 free (Coolify dashboard)"
if [ "$HELD" = "1" ]; then
  log ""
  log "  Decision recorded for the install: keep sltserp-nginx (certbot, exposes ONLY"
  log "  /api/cron/* and /api/health on sltserp-sync.duckdns.org) as the front door and"
  log "  install Coolify with its proxy DISABLED, so the 'VPS = cron ingress + workers'"
  log "  contract is untouched. Traefik can take over 80/443 later as its own change."
fi

log "=== 5. Data directories (identical to the documented manual layout) ==="
mkdir -p /data/coolify/{source,ssh,applications,databases,backups,services,proxy,webhooks-during-maintenance}
mkdir -p /data/coolify/ssh/{keys,mux}
mkdir -p /data/coolify/proxy/dynamic
ok "/data/coolify ready: $(du -sh /data/coolify 2>/dev/null | cut -f1)"

log "=== 6. Running stack that must survive ==="
docker ps --format '  {{.Names}}  {{.Status}}' 2>/dev/null | sed '/^$/d'
log ""
log "  Coolify creates and owns only what it deploys. It does not adopt these containers."
log "  When SLTSERP moves under Coolify the old ones are stopped explicitly, never removed"
log "  by an install step."

log ""
log "=========================== NEXT STEP (operator runs this) ==========================="
log "  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash"
log ""
log "  Immediately after it finishes (the docs warn the registration page is open to whoever"
log "  reaches it first):"
log "    1. open http://172.255.209.243:8000 and create the single admin account"
log "    2. Settings -> disable multi-user registration"
log "    3. Server -> Proxy -> disable (sltserp-nginx keeps 80/443)"
log "    4. restrict :8000 to your own IPs before leaving it running overnight"
log "===================================================================================="
