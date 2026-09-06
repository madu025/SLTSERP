#!/bin/sh

# Schema comes from source, not from migration history.
#
# The production Postgres (Supabase, reached through the session pooler) was created with
# `prisma db push`, so `_prisma_migrations` is empty and `migrate deploy` would replay all 34
# migrations onto a schema that already exists. `db push` is the declarative equivalent: it
# converges the database on the schema and never rewrites data, which is what a container boot may
# safely do.
#
# The previous version of this file also pointed at a retired single-file schema (192 models,
# since deleted from the repo) instead of the authoritative folder that package.json declares
# (prisma/schema), so anything added to the folder could never reach a container-managed
# database no matter how many times the deploy ran.
#
# SKIP_DB_SYNC=true defers schema convergence to an operator step: `npm run db:sync` from a
# workstation. Use it when several replicas boot at once, when the box must not run DDL on a
# restart, or when an image ships without the prisma CLI.
#
# Boot contract on a SKIP_DB_SYNC=true stack:
#   1. prisma db push does NOT run, so schema drift can never be fatal at boot. One table the
#      schema folder does not declare (_SyncNoiseArchive) used to make db push refuse, this script
#      exit 1, and nginx answer 502 on /api/cron/sync-all for every tick - the clock died from a
#      check a container restart has no business running. Schema convergence is an operator step
#      (npm run db:sync from a workstation).
#   2. prisma/post-push-indexes.sql STILL runs. It is idempotent and safe to re-apply on every boot
#      through the Supabase session pooler, so the operator-class, partial-unique and Notification
#      dedup indexes survive a push made elsewhere.
#   3. "could not apply" - the file MISSING from the bundle, or db execute failing - is one single
#      decision, never a silent skip: a loud WARNING and boot here, FATAL exit 1 on the stacks that
#      still push at boot. A missing file used to print one stdout line and boot happily everywhere,
#      which is how a dropped dedup unique turns into duplicate notifications with no error.
echo "Database synchronization (db push - no migration history)..."

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
  echo "SKIP_DB_SYNC=true - prisma db push skipped; schema drift is non-fatal at boot."
  echo "  No container converges the production schema on this stack, so a Prisma model change needs"
  echo "  an operator step against the production DATABASE_URL (never at boot, never --accept-data-loss):"
  echo "    npm run db:sync                      # db push --schema prisma/schema + post-push-indexes.sql"
elif [ ! -d ./prisma/schema ]; then
  echo "prisma/schema absent from this image - nothing to push."
else
  # A refused push means the change needs a destructive step db push will not take unattended.
  # Starting anyway would run new code against a schema that lacks its tables. This branch is
  # deliberately untouched for the stacks that still converge the schema at boot.
  if ! $PRISMA db push --schema prisma/schema --skip-generate; then
    echo "FATAL: prisma db push did not converge - resolve the drift above or set SKIP_DB_SYNC=true." >&2
    exit 1
  fi
fi

# db push drops every index it does not manage (operator classes, partial uniques), so the
# hand-written set is re-applied after every push - and, unlike the push above, ALSO on the
# SKIP_DB_SYNC path: no push ran here, but those indexes are what dedup and pattern lookups depend
# on, and the file is idempotent so re-running it on every boot is safe.
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
      echo "         Boot continues: SKIP_DB_SYNC=true must not let DDL kill the sync clock. Re-apply with:" >&2
      echo "           prisma db execute --schema prisma/schema --file prisma/post-push-indexes.sql" >&2
    else
      echo "FATAL: indexes NOT applied - $INDEX_FAILURE." >&2
      echo "       This stack converges the schema at boot, so it must not run without its dedup indexes." >&2
      exit 1
    fi
  fi
fi

# Start the application
echo "Starting application..."
exec "$@"
