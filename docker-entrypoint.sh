#!/bin/sh

echo "🔄 Applying database migrations..."

# Run migrations using the bundled prisma binary
if [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy && echo "✅ Migrations applied" || echo "⚠️ Migration warning (non-fatal)"
else
  echo "⚠️ Prisma binary not found - running raw SQL sync..."
  node scripts/db-sync.js || echo "⚠️ DB sync warning (non-fatal)"
fi

echo "🚀 Starting application..."
exec "$@"
