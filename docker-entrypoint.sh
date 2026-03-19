#!/bin/sh

echo "🔄 Synchronizing database schema..."

# Try direct binary first, then npx as fallback
PRISMA_BIN="./node_modules/.bin/prisma"

if [ -f "$PRISMA_BIN" ]; then
  echo "✅ Found prisma binary at $PRISMA_BIN"
  $PRISMA_BIN db push --accept-data-loss && echo "✅ DB schema synced" || echo "⚠️ DB push warning (non-fatal)"
else
  echo "⚠️ Prisma binary not found, trying node scripts/db-sync.js..."
  node scripts/db-sync.js || echo "⚠️ DB sync warning (non-fatal)"
fi

echo "🚀 Starting application..."
exec "$@"
