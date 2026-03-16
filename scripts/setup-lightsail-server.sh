#!/bin/bash

# ==========================================================================
# SLTSERP - Full One-Click Setup & Run (Remote Server)
# ==========================================================================

# Exit on any error
set -e

REPO_URL="https://github.com/madu025/SLTSERP.git"
PROJECT_DIR=~/slts-erp
TEMP_DIR=~/slts-erp-temp

echo "🚀 Starting Full SLTSERP Setup..."

# 1. Update System & Add Swap (CRITICAL for 2GB RAM build)
echo "--- Updating system & Adding 4GB Swap ---"
sudo apt-get update -y
if [ ! -f /swapfile ]; then
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
sudo apt-get upgrade -y
# Install Docker & Prerequisites
sudo apt-get install -y curl git tar build-essential ca-certificates gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 2. Handle Project Code
echo "--- Handling Project Code ---"
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "Cloning repository..."
    # If the directory exists but is not a git repo (like from our previous scp), move contents
    if [ -d "$PROJECT_DIR" ]; then
        mv "$PROJECT_DIR" "$TEMP_DIR"
    fi
    git clone "$REPO_URL" "$PROJECT_DIR"
    # Copy back the config files we uploaded earlier
    if [ -d "$TEMP_DIR" ]; then
        cp "$TEMP_DIR/.env" "$PROJECT_DIR/" 2>/dev/null || true
        cp "$TEMP_DIR/docker-compose.prod.yml" "$PROJECT_DIR/" 2>/dev/null || true
        cp -r "$TEMP_DIR/nginx" "$PROJECT_DIR/" 2>/dev/null || true
        rm -rf "$TEMP_DIR"
    fi
else
    echo "Project already exists, pulling latest..."
    cd "$PROJECT_DIR"
    git fetch origin main
    git reset --hard origin/main
fi

# 3. Start Application
echo "--- Starting Application with Docker ---"
cd "$PROJECT_DIR"
# Ensure we use the production compose
sudo docker compose -f docker-compose.prod.yml up --build -d

echo ""
echo "=========================================================================="
echo "✅ SERVER SETUP & DEPLOYMENT COMPLETE!"
echo "Your ERP is now running on http://$(curl -s ifconfig.me)"
echo "=========================================================================="
