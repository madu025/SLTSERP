#!/bin/sh

# Schema comes from source, not from migration history.
#
# The production Postgres (Coolify on the VPS) was created with `prisma db push`, so
# `_prisma_migrations` is empty and `migrate deploy` would replay all 34 migrations onto a schema
# that already exists. `db push` is the declarative equivalent: it converges the database on the
# schema and never rewrites data, which is what a container boot may safely do.
#
# The previous version of this file also pointed at the retired single-file schema
# (prisma/schema.prisma - 192 models) instead of the authoritative folder that package.json
# declares (prisma/schema - 259 models), so anything added to the folder could never reach a
# container-managed database no matter how many times the deploy ran.
#
# SKIP_DB_SYNC=true defers the sync to the deploy job (scripts/vps-prisma-parity.sh APPLY=1). Use it
# when several replicas boot at once, or when an image ships without the prisma CLI.
echo "Database synchronization (db push - no migration history)..."

if [ "${SKIP_DB_SYNC:-false}" = "true" ]; then
  echo "SKIP_DB_SYNC=true - schema sync deferred to the deploy job."
elif [ ! -d ./prisma/schema ]; then
  echo "prisma/schema absent from this image - nothing to push."
else
  if [ -x ./node_modules/.bin/prisma ]; then
    PRISMA=./node_modules/.bin/prisma
  else
    PRISMA="npx --yes prisma@6.19.1"
  fi

  # A refused push means the change needs a destructive step db push will not take unattended.
  # Starting anyway would run new code against a schema that lacks its tables.
  if ! $PRISMA db push --schema prisma/schema --skip-generate; then
    echo "FATAL: prisma db push did not converge - resolve the drift above or set SKIP_DB_SYNC=true." >&2
    exit 1
  fi

  # db push drops every index it does not manage (operator classes, partial uniques), so the
  # hand-written set is re-applied after every push. The Notification dedup unique index lives
  # there, so a silent failure would turn into duplicate notifications rather than an error.
  if ! $PRISMA db execute --schema prisma/schema --file prisma/post-push-indexes.sql; then
    echo "FATAL: prisma/post-push-indexes.sql was not applied - dedup and pattern indexes are absent." >&2
    exit 1
  fi
fi

# Start the application
echo "Starting application..."
exec "$@"
