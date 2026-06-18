# QFieldCloud Self-Hosted Deployment Guide

## Architecture
```
SLTSERP (Next.js) ←→ QFieldCloud API ←→ QField Mobile App
     :3000               :8100              (iOS/Android)
```

## 1. Local Development

### Start QFieldCloud Services
```bash
cd docker/qfieldcloud
docker compose -f docker-compose.qfield.yml up -d
```

### Verify Services
- QFieldCloud API: `http://localhost:8100/api/v1/status/`
- MinIO Console: `http://localhost:9001`
- PostgreSQL: `localhost:8102`

### Environment (.env)
```env
NEXT_PUBLIC_QFIELD_API_URL="http://localhost:8100"
QFIELD_HOST="http://localhost:8100"
QFIELD_ALLOWED_HOSTS="localhost,127.0.0.1"
```

---

## 2. Remote Deployment (Server)

### Method A: Same Server (Docker)
Both SLTSERP and QFieldCloud on one VPS:

**1. Update .env for remote:**
```env
# Replace YOUR_SERVER_IP with actual IP or domain
NEXTAUTH_URL="http://YOUR_SERVER_IP:3000"
NEXT_PUBLIC_APP_URL="http://YOUR_SERVER_IP:3000"

# QFieldCloud (internal Docker network)
NEXT_PUBLIC_QFIELD_API_URL="http://YOUR_SERVER_IP:8100"
QFIELD_HOST="http://YOUR_SERVER_IP:8100"
QFIELD_ALLOWED_HOSTS="YOUR_SERVER_IP,YOUR_DOMAIN,localhost"
```

**2. Firewall Rules:**
```bash
# Open required ports
sudo ufw allow 3000/tcp   # SLTSERP
sudo ufw allow 8100/tcp   # QFieldCloud API
sudo ufw allow 8101/tcp   # MinIO (optional, restrict for security)
```

**3. Start all services:**
```bash
# SLTSERP
docker compose -f docker-compose.prod.yml up -d

# QFieldCloud
cd docker/qfieldcloud
docker compose -f docker-compose.qfield.yml up -d
```

### Method B: Separate Servers
QFieldCloud on a dedicated server:

```env
# On SLTSERP server
NEXT_PUBLIC_QFIELD_API_URL="http://QFIELD_SERVER_IP:8100"

# On QFieldCloud server (in docker-compose.qfield.yml environment)
QFIELD_HOST="http://QFIELD_SERVER_IP:8100"
QFIELD_ALLOWED_HOSTS="QFIELD_SERVER_IP,YOUR_DOMAIN"
```

### Method C: With Nginx Reverse Proxy (Production)
```nginx
# /etc/nginx/sites-available/slt-erp
server {
    listen 80;
    server_name erp.yourdomain.com;
    
    # SLTSERP Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name qfield.yourdomain.com;
    
    # QFieldCloud API
    location / {
        proxy_pass http://localhost:8100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 500M;  # For large survey files
    }
}
```

**Then update .env:**
```env
NEXT_PUBLIC_QFIELD_API_URL="https://qfield.yourdomain.com"
QFIELD_HOST="https://qfield.yourdomain.com"
QFIELD_ALLOWED_HOSTS="qfield.yourdomain.com,erp.yourdomain.com"
```

---

## 3. Mobile App Configuration

### QField Mobile App (iOS/Android)
When opening QField mobile app:
1. Tap "Cloud Projects"
2. Enter server URL: `http://YOUR_SERVER_IP:8100` (or `https://qfield.yourdomain.com`)
3. Login with QFieldCloud credentials

### Supervisor Workflow
1. SLTSERP creates project → assigns supervisor
2. SLTSERP calls QFieldCloud API → creates QFieldCloud project with QGIS layers
3. Supervisor opens QField app → sees project → starts survey
4. Survey points sync via QFieldCloud Delta API
5. SLTSERP pulls synced points for approval/BOQ

---

## 4. Security Checklist (Production)

- [ ] Change ALL default passwords (`.env` and docker-compose)
- [ ] Generate strong `QFIELD_SECRET_KEY` (64+ random chars)
- [ ] Use HTTPS with Let's Encrypt
- [ ] Restrict MinIO port (8101) to internal network only
- [ ] Set up PostgreSQL backups
- [ ] Configure firewall (UFW/iptables)
- [ ] Enable QFieldCloud authentication

---

## 5. Troubleshooting

| Issue | Check |
|-------|-------|
| QField app can't connect | `QFIELD_ALLOWED_HOSTS` includes the server IP |
| Survey points not syncing | QFieldCloud worker is running (`qfield-worker` container) |
| File uploads fail | MinIO storage is healthy, bucket `qfieldcloud` exists |
| Database connection | PostgreSQL is accessible at `8102` internally |