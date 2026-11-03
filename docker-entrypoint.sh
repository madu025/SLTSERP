#!/bin/sh
set -eu

# Web containers are intentionally side-effect free at startup. Prisma schema
# changes, SQL indexes, workflow catalogs, and canonical RBAC grants are owned
# by the one-time release job (`pnpm run db:release`) before the web rollout.
#
# Keeping this entrypoint free of database writes prevents every replica (and
# every restart) from racing on migrations or reconciling application data.
# It also makes a failed release visible before traffic is switched to a new
# image instead of discovering it during process boot.
if [ "${RUN_DB_SYNC_ON_STARTUP:-false}" = "true" ]; then
  echo "FATAL: RUN_DB_SYNC_ON_STARTUP is not supported; run pnpm run db:release as the release job." >&2
  exit 1
fi

echo "Starting web process; database release work is managed out-of-band."
exec "$@"
