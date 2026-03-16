#!/bin/bash

# ==========================================================================
# SLTSERP - Manual Docker Deployment Script
# Use this to update the server manually without GitHub Actions.
# ==========================================================================

# Exit on any error
set -e

PROJECT_DIR=~/slts-erp

echo "🚀 Starting Manual Docker Deployment..."

# 1. Go to project directory
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    echo "--- Pulling latest changes from Git ---"
    # Ensure we are on the right branch
    git fetch origin main
    git reset --hard origin/main
else
    echo "❌ Error: Project directory $PROJECT_DIR not found."
    echo "Please clone the repository first: git clone <your-repo-url> $PROJECT_DIR"
    exit 1
fi

# 2. Check for .env file
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file missing in $PROJECT_DIR"
    echo "Please create a .env file with DATABASE_URL, NEXTAUTH_SECRET, etc."
    exit 1
fi

# 3. Build and Restart Containers
echo "--- Rebuilding Docker images and restarting containers ---"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up --build -d

# 4. Prune old images to save space
echo "--- Cleaning up old images ---"
docker image prune -f

echo ""
echo "=========================================================================="
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "App is running on port 80 via Nginx."
echo "=========================================================================="
