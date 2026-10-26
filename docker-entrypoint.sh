#!/bin/sh

# Production schema changes are managed by Prisma Migrate. `prisma migrate deploy` is idempotent
# and uses the migration lock, so a container restart or a second replica cannot replay a migration.
# The historical Supabase database must be baselined once with:
#   npm run db:migrate:baseline -- --confirm-existing-schema
#
# SKIP_DB_SYNC=true defers migrations to the release pipeline. This is useful when several
# replicas boot at once or when the platform runs `npm run db:migrate:deploy` before rollout.
echo "Database synchronization (Prisma Migrate)..."

# Resolved once, before either branch. The image ships the CLI (Dockerfile.prod installs
# prisma@6.19.1 globally), so a boot does not need npm-registry egress; npx remains the last
# resort for an image built without it.
if [ -x ./node_modules/.bin/prisma ]; then
  PRISMA=./node_modules/.bin/prisma
elif command -v prisma >/dev/null 2>&1; then
  PRISMA=prisma
else
  PRISMA="npx --yes prisma@6.19.1"
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
      echo "           npm run db:migrate:deploy" >&2
    else
      echo "FATAL: indexes NOT applied - $INDEX_FAILURE." >&2
      echo "       This stack requires its dedup indexes before serving traffic." >&2
      exit 1
    fi
  fi
fi

# Start the application
echo "Starting application..."
exec "$@"
