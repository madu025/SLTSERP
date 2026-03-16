#!/bin/bash

# ==========================================================================
# SLTSERP - AWS Lightsail Ubuntu Setup Script
# This script sets up a fresh Ubuntu server for the SLTSERP application.
# ==========================================================================

# Exit on any error
set -e

echo "🚀 Starting SLTSERP Server Setup..."

# 1. Update System
echo "--- Updating system packages ---"
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install Essential Tools
echo "--- Installing essential tools ---"
sudo apt-get install -y curl git tar build-essential nginx

# 3. Install Node.js (Version 20.x)
echo "--- Installing Node.js 20 ---"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Install PM2 Globally
echo "--- Installing PM2 ---"
sudo npm install -g pm2

# 5. Setup Project Directory
echo "--- Creating project directory ---"
mkdir -p ~/slts-erp
sudo chown ubuntu:ubuntu ~/slts-erp

# 6. Install Docker (Required for Local Postgres/Docker-Compose)
echo "--- Installing Docker & Docker Compose ---"
sudo apt-get install -y ca-certificates gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 7. Configure Nginx as Reverse Proxy
echo "--- Configuring Nginx ---"
cat <<EOF | sudo tee /etc/nginx/sites-available/slts-erp
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Optional: Increase client body size for file uploads
    client_max_body_size 20M;
}
EOF

sudo ln -sf /etc/nginx/sites-available/slts-erp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 8. Setup Firewall (UFW)
echo "--- Configuring Firewall ---"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
echo "y" | sudo ufw enable

# 9. Final Instructions
echo ""
echo "=========================================================================="
echo "✅ SERVER SETUP COMPLETE!"
echo "=========================================================================="
echo "Next Steps:"
echo "1. Put your DATABASE_URL in ~/slts-erp/.env"
echo "2. Add your server's IP and SSH Key to GitHub Actions Secrets:"
echo "   - SERVER_IP"
echo "   - SSH_PRIVATE_KEY"
echo "3. Push your code to GitHub (main branch) to trigger auto-deployment."
echo "4. After first deploy, PM2 will start the app automatically."
echo "=========================================================================="
