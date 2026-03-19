#!/bin/sh

# Run database sync (push schema without crashing container)
echo "🔄 Synchronizing Database..."
node scripts/db-sync.js || echo "⚠️ Database sync warning"

# Start the application
echo "🚀 Starting application..."
exec "$@"
