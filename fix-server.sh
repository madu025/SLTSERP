#!/bin/bash
cat << 'EOF' > ~/slts-erp/docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: sltserp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: sltserp_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-Slts2026Pass}
      POSTGRES_DB: sltserp_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - sltserp-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sltserp_user -d sltserp_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    container_name: sltserp-app
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://sltserp_user:${POSTGRES_PASSWORD:-Slts2026Pass}@postgres:5432/sltserp_db
      - DIRECT_URL=postgresql://sltserp_user:${POSTGRES_PASSWORD:-Slts2026Pass}@postgres:5432/sltserp_db
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NODE_ENV=production
      - TZ=Asia/Colombo
    ports:
      - "3000:3000"
    networks:
      - sltserp-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./public/uploads:/app/public/uploads

  redis:
    image: redis:7-alpine
    container_name: sltserp-redis
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data
    networks:
      - sltserp-network

  nginx:
    image: nginx:alpine
    container_name: sltserp-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - app
    networks:
      - sltserp-network

volumes:
  postgres_data:
  redis_data:

networks:
  sltserp-network:
    driver: bridge
EOF

cat << 'EOF' > ~/slts-erp/server.js
const path = require('path')
const fs = require('fs')
const dir = path.join(__dirname)
process.env.NODE_ENV = 'production'
process.chdir(__dirname)
const currentPort = parseInt(process.env.PORT, 10) || 3000
const hostname = process.env.HOSTNAME || '0.0.0.0'
const configPath = path.join(dir, '.next/required-server-files.json')
if (!fs.existsSync(configPath)) {
    console.error('Error: .next/required-server-files.json not found!');
    process.exit(1);
}
const requiredFiles = JSON.parse(fs.readFileSync(configPath, 'utf8'))
requiredFiles.config.turbopack = { root: '/app' }
requiredFiles.appDir = '/app'
const nextConfig = requiredFiles.config
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)
require('next')
const { startServer } = require('next/dist/server/lib/start-server')
let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10)
if (Number.isNaN(keepAliveTimeout) || !Number.isFinite(keepAliveTimeout) || keepAliveTimeout < 0) {
  keepAliveTimeout = undefined
}
console.log('🚀 Starting SLTSERP Standalone Server on', hostname, 'port', currentPort)
startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout,
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
EOF

sudo mkdir -p ~/slts-erp/nginx/conf.d
sudo bash -c "cat << 'EOF' > ~/slts-erp/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
"

chmod +x ~/slts-erp/server.js
echo "Files re-written successfully (including Nginx)."
