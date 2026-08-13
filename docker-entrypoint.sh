#!/bin/sh

# Database setup: applies ALL migrations including PL/pgSQL functions.
# Prisma sends each migration SQL file as a complete batch to PostgreSQL,
# so CREATE FUNCTION with $$ quoting works natively.
# One command = schema + functions + triggers + indexes. No separate patch needed.
echo "Database synchronization..."
if [ -f "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
else
  npx prisma@6.19.1 migrate deploy --schema prisma/schema.prisma
fi

# Start the application
echo "Starting application..."
exec "$@"
