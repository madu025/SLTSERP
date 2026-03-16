#!/bin/sh

# Wait for database to be ready (optional but recommended)
echo "Running database migrations..."
if [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy
else
  npx prisma migrate deploy
fi

# Start the application
echo "Starting application..."
exec "$@"
