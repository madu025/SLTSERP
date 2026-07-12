# 🚀 Remote Server PostgreSQL Docker Deployment Guide

## Prerequisites
- Ubuntu/Debian server with SSH access
- Root or sudo privileges
- Server IP address
- SSH key or password

---

## Step 1: Connect to Server via SSH

### Windows (PowerShell):
```powershell
# Using password
ssh username@your-server-ip

# Using SSH key
ssh -i path/to/key.pem username@your-server-ip

# Example:
ssh root@192.168.1.100
# or
ssh ubuntu@your-vps-domain.com
```

---

## Step 2: Install Docker on Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
docker compose version

# Add current user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
newgrp docker
```

---

## Step 3: Create Project Directory

```bash
# Create directory for SLTSERP
mkdir -p ~/sltserp-db
cd ~/sltserp-db

# Create subdirectories
mkdir -p postgres-init
mkdir -p backups
```

---

## Step 4: Upload Configuration Files

### Option A: Using SCP (from your local machine)
```powershell
# From your Windows machine
scp docker-compose.yml username@server-ip:~/sltserp-db/
scp .env.docker username@server-ip:~/sltserp-db/.env
scp postgres-init/01-init.sh username@server-ip:~/sltserp-db/postgres-init/

# Example:
scp docker-compose.yml root@192.168.1.100:~/sltserp-db/
```

### Option B: Create files directly on server
```bash
# On the server, create docker-compose.yml
nano docker-compose.yml
```
Paste the content from your local `docker-compose.yml` file.

```bash
# Create .env file
nano .env
```
Paste:
```env
POSTGRES_PASSWORD=YourSecurePassword123!
POSTGRES_USER=sltserp_user
POSTGRES_DB=sltserp_db
PGADMIN_EMAIL=admin@sltserp.local
PGADMIN_PASSWORD=admin123
```

```bash
# Create init script
nano postgres-init/01-init.sh
```
Paste the initialization script content.

```bash
# Make init script executable
chmod +x postgres-init/01-init.sh
```

---

## Step 5: Configure Firewall

```bash
# Allow PostgreSQL port (only from your application server)
sudo ufw allow from YOUR_APP_SERVER_IP to any port 5432

# Allow PgAdmin (optional, for management)
sudo ufw allow 5050

# Enable firewall
sudo ufw enable
sudo ufw status
```

---

## Step 6: Start PostgreSQL Container

```bash
# Navigate to project directory
cd ~/sltserp-db

# Start containers
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f postgres

# Wait for database to be ready
docker compose logs postgres | grep "database system is ready"
```

---

## Step 7: Verify Database Connection

```bash
# Test connection from server
docker exec -it sltserp-postgres psql -U sltserp_user -d sltserp_db

# Inside PostgreSQL prompt:
\l              # List databases
\dt             # List tables (will be empty initially)
\q              # Quit

# Test from outside
psql "postgresql://sltserp_user:YourSecurePassword123!@localhost:5432/sltserp_db" -c "SELECT version();"
```

---

## Step 8: Get Server Public IP

```bash
# Get public IP
curl ifconfig.me

# Or
curl ipinfo.io/ip

# Note this IP - you'll need it for DATABASE_URL
```

---

## Step 9: Update Local .env File

On your **local development machine**, update `.env`:

```env
# Remote Docker PostgreSQL (Primary)
DATABASE_URL="postgresql://sltserp_user:YourSecurePassword123!@YOUR_SERVER_IP:5432/sltserp_db?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://sltserp_user:YourSecurePassword123!@YOUR_SERVER_IP:5432/sltserp_db"

# Supabase (Read Replica - Optional)
READ_REPLICA_URL="postgresql://postgres.xhhbwywbnktwkbjijzxi:%40Maduranga89@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

Replace `YOUR_SERVER_IP` with the actual IP from Step 8.

---

## Step 10: Push Database Schema

From your **local machine**:

```bash
# Push Prisma schema to remote Docker PostgreSQL
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Verify
npx prisma studio
```

---

## Step 11: Migrate Data from Supabase (Optional)

### Export from Supabase:
```bash
# On local machine
pg_dump "postgresql://postgres.prbyiuyzcsfyduajmajx:%40Maduranga89@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" > supabase_backup.sql
```

### Import to Docker PostgreSQL:
```bash
# Upload backup to server
scp supabase_backup.sql username@server-ip:~/sltserp-db/backups/

# On server, import
docker exec -i sltserp-postgres psql -U sltserp_user -d sltserp_db < ~/sltserp-db/backups/supabase_backup.sql
```

---

## Step 12: Set Up Automated Backups

```bash
# Create backup script on server
nano ~/sltserp-db/backup.sh
```

Paste:
```bash
#!/bin/bash
BACKUP_DIR=~/sltserp-db/backups
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sltserp_backup_$DATE.sql"

# Create backup
docker exec sltserp-postgres pg_dump -U sltserp_user sltserp_db > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

```bash
# Make executable
chmod +x ~/sltserp-db/backup.sh

# Test backup
~/sltserp-db/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

Add this line:
```
0 2 * * * ~/sltserp-db/backup.sh >> ~/sltserp-db/backup.log 2>&1
```

---

## Step 13: Monitor and Maintain

### View Container Status:
```bash
docker compose ps
docker stats sltserp-postgres
```

### View Logs:
```bash
docker compose logs -f postgres
docker compose logs --tail=100 postgres
```

### Restart Container:
```bash
docker compose restart postgres
```

### Update PostgreSQL:
```bash
docker compose pull
docker compose up -d
```

---

## Security Hardening

### 1. Change Default Passwords
```bash
# Connect to database
docker exec -it sltserp-postgres psql -U sltserp_user -d sltserp_db

# Change password
ALTER USER sltserp_user WITH PASSWORD 'NewStrongPassword!@#';
```

### 2. Enable SSL (Production)
```bash
# Generate SSL certificates
openssl req -new -x509 -days 365 -nodes -text -out server.crt -keyout server.key -subj "/CN=sltserp-db"

# Copy to container
docker cp server.crt sltserp-postgres:/var/lib/postgresql/
docker cp server.key sltserp-postgres:/var/lib/postgresql/

# Update postgresql.conf
docker exec -it sltserp-postgres bash
echo "ssl = on" >> /var/lib/postgresql/data/postgresql.conf
echo "ssl_cert_file = '/var/lib/postgresql/server.crt'" >> /var/lib/postgresql/data/postgresql.conf
echo "ssl_key_file = '/var/lib/postgresql/server.key'" >> /var/lib/postgresql/data/postgresql.conf
exit

# Restart
docker compose restart postgres
```

### 3. Restrict Network Access
```bash
# Only allow from specific IPs
sudo ufw delete allow 5432
sudo ufw allow from YOUR_APP_IP to any port 5432
sudo ufw allow from YOUR_OFFICE_IP to any port 5432
```

---

## Troubleshooting

### Container won't start:
```bash
docker compose logs postgres
docker compose down -v
docker compose up -d
```

### Can't connect from local machine:
```bash
# Check firewall
sudo ufw status

# Check if port is listening
sudo netstat -tulpn | grep 5432

# Test from server
telnet localhost 5432
```

### Slow performance:
```bash
# Check resources
docker stats sltserp-postgres

# Increase shared_buffers
docker exec -it sltserp-postgres psql -U sltserp_user -d sltserp_db
ALTER SYSTEM SET shared_buffers = '512MB';
SELECT pg_reload_conf();
```

---

## Quick Reference Commands

```bash
# Start
docker compose up -d

# Stop
docker compose stop

# Restart
docker compose restart

# Logs
docker compose logs -f postgres

# Backup
docker exec sltserp-postgres pg_dump -U sltserp_user sltserp_db > backup.sql

# Restore
docker exec -i sltserp-postgres psql -U sltserp_user -d sltserp_db < backup.sql

# Connect
docker exec -it sltserp-postgres psql -U sltserp_user -d sltserp_db

# Remove (⚠️ DELETES DATA)
docker compose down -v
```

---

## Cost Estimation

### VPS Options:
- **DigitalOcean**: $12/month (2GB RAM, 50GB SSD)
- **Linode**: $10/month (2GB RAM, 50GB SSD)
- **Vultr**: $10/month (2GB RAM, 55GB SSD)
- **Hetzner**: €4.5/month (2GB RAM, 40GB SSD) - Best value!

### Recommended Specs:
- **Development**: 2GB RAM, 20GB SSD
- **Production**: 4GB RAM, 80GB SSD
- **High Traffic**: 8GB RAM, 160GB SSD

---

## Next Steps

1. ✅ SSH into server
2. ✅ Install Docker
3. ✅ Upload configuration files
4. ✅ Start PostgreSQL container
5. ✅ Update local .env
6. ✅ Push Prisma schema
7. ✅ Migrate data (optional)
8. ✅ Set up backups
9. ✅ Test application
10. ✅ Monitor performance

**සියල්ල සූදානම්!** 🎉
