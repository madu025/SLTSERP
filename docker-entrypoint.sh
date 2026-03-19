#!/bin/sh

# Applying database migrations on start
echo "Database synchronization..."
if [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy
else
  npx prisma@6.19.1 migrate deploy
fi

# Start the application
echo "Starting application..."
exec "$@"
