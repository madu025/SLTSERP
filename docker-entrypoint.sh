#!/bin/sh

echo "🔄 Running DB column sync..."
node scripts/db-sync.js

echo "🚀 Starting application..."
exec "$@"
