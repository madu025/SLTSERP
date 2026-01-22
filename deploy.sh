#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest changes
echo "📥 Pulling latest code from GitHub..."
git pull

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose up -d --build

# Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 10

# Run migrations
echo "🔄 Running database migrations..."
docker-compose exec -T app npx prisma migrate deploy

# Show status
echo "✅ Deployment complete!"
echo ""
echo "📊 Container status:"
docker-compose ps

echo ""
echo "📝 View logs with: docker-compose logs -f app"
