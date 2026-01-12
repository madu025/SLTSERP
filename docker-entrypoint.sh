#!/bin/sh

# Wait for database to be ready (optional but recommended)
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "Starting application..."
exec "$@"
