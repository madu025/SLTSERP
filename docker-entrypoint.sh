#!/bin/sh

# Production schema changes are managed by Prisma Migrate. `prisma migrate deploy` is idempotent
# and uses the migration lock, so a container restart or a second replica cannot replay a migration.
# The historical Supabase database must be baselined once with:
#   pnpm run db:migrate:baseline -- --confirm-existing-schema
#
# SKIP_DB_SYNC=true defers migrations to the release pipeline. This is useful when several
# replicas boot at once or when the platform runs `pnpm run db:migrate:deploy` before rollout.
echo "Database synchronization (Prisma Migrate)..."

# Resolved once, before either branch. The image ships the CLI (Dockerfile.prod installs
# prisma@6.19.1 in node_modules), so a boot does not need registry egress. The
# production image must fail closed if the pinned CLI is missing.
if [ -x ./node_modules/.bin/prisma ]; then
  PRISMA=./node_modules/.bin/prisma
elif command -v prisma >/dev/null 2>&1; then
  PRISMA=prisma
else
  echo "FATAL: Prisma CLI is missing from the production image." >&2
  exit 1
fi

if [ "${SKIP_DB_SYNC:-false}" = "true" ]; then
  echo "SKIP_DB_SYNC=true - prisma migrate deploy skipped; release pipeline owns schema changes."
elif [ ! -d ./prisma/schema ]; then
  echo "prisma/schema absent from this image - no migrations to apply."
else
  if ! $PRISMA migrate deploy; then
    echo "FATAL: prisma migrate deploy failed - resolve the migration above or set SKIP_DB_SYNC=true after applying it in the release pipeline." >&2
    exit 1
  fi
fi

# These PostgreSQL objects are intentionally outside Prisma's schema language. The script is
# idempotent, so it can safely run after migrations and on SKIP_DB_SYNC=true replicas.
if [ ! -d ./prisma/schema ]; then
  echo "prisma/schema absent from this image - no indexes to apply."
else
  # One variable, one decision: a MISSING file and a FAILED apply are the same outcome, so neither
  # can slip past as a harmless stdout line.
  INDEX_FAILURE=""
  if [ ! -f ./prisma/post-push-indexes.sql ]; then
    INDEX_FAILURE="prisma/post-push-indexes.sql is MISSING from this bundle (git-ignored by the *.sql rule; .gitignore excepts it, so commit it)"
  elif $PRISMA db execute --schema prisma/schema --file prisma/post-push-indexes.sql; then
    echo "prisma/post-push-indexes.sql applied."
  else
    INDEX_FAILURE="prisma db execute on prisma/post-push-indexes.sql returned non-zero"
  fi

  if [ -n "$INDEX_FAILURE" ]; then
    if [ "${SKIP_DB_SYNC:-false}" = "true" ]; then
      # Non-fatal on this stack by design: a missing file or a pooler hiccup must not crash-loop the
      # container. It is loud, so it is visible in the container logs.
      echo "WARNING: indexes NOT applied - $INDEX_FAILURE." >&2
      echo "         Notification dedup unique, operator-class and partial indexes may be stale or absent," >&2
      echo "         which shows up as duplicate notifications rather than an error." >&2
      echo "         Boot continues: SKIP_DB_SYNC=true defers this to the release pipeline. Re-apply with:" >&2
      echo "           pnpm run db:migrate:deploy" >&2
    else
      echo "FATAL: indexes NOT applied - $INDEX_FAILURE." >&2
      echo "       This stack requires its dedup indexes before serving traffic." >&2
      exit 1
    fi
  fi
fi

# Workflow templates are application data, not Prisma schema objects.  Seed them after migrations
# so a fresh deployment has selectable project types before the web process accepts project writes.
# The seed is idempotent and intentionally separate from prisma/seed.js (which also creates
# bootstrap users and other fixtures).  Operators that run migrations/seeding in a release job can
# set either skip flag and own this step explicitly.
if [ "${SKIP_DB_SYNC:-false}" = "true" ] || [ "${SKIP_WORKFLOW_SEED:-false}" = "true" ]; then
  echo "Workflow template seed skipped (SKIP_DB_SYNC or SKIP_WORKFLOW_SEED is true)."
elif [ -x ./node_modules/.bin/tsx ]; then
  if ! ./node_modules/.bin/tsx prisma/seed-workflows.ts; then
    echo "FATAL: workflow template seed failed - refusing to serve projects without a workflow catalog." >&2
    exit 1
  fi
else
  echo "FATAL: tsx is missing; cannot verify the workflow catalog." >&2
  exit 1
fi

# Canonical capability grants are application data, not schema objects. Vercel
# runs this through `vercel-build`, but Docker deployments use `pnpm run build`.
# Seed it here so Coolify/VPS deployments cannot start with only legacy page
# permissions and then reject valid users at the API RBAC boundary.
# RBAC data is safe to reconcile independently of schema migration ownership.
# Some Coolify releases intentionally set SKIP_DB_SYNC=true because migrations
# run in a separate release step; that must not silently disable authorization
# grants when the schema is already present.
if [ "${SKIP_RBAC_SEED:-false}" = "true" ]; then
  echo "RBAC capability seed skipped (SKIP_RBAC_SEED is true)."
elif [ -x ./node_modules/.bin/tsx ] && [ -f ./scripts/seed-rbac-capabilities.ts ]; then
  if ! ./node_modules/.bin/tsx ./scripts/seed-rbac-capabilities.ts; then
    echo "FATAL: RBAC capability seed failed - refusing to serve with incomplete authorization grants." >&2
    exit 1
  fi
else
  echo "FATAL: RBAC capability seed is unavailable; refusing to serve with incomplete authorization grants." >&2
  exit 1
fi

# Start the application
echo "Starting application..."
exec "$@"
