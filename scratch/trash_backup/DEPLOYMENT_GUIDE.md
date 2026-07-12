# 🚀 SLTSERP Deployment & Infrastructure Guide

This guide is the single source of truth for deploying, configuring, and managing the SLTSERP system, including the Next.js application, PostgreSQL (with PostGIS), Redis, Nginx, and GeoServer.

---

## 📌 Architectural Overview

```
                        [ Internet (Port 80 / 443) ]
                                    │
                                    ▼
                          Nginx Reverse Proxy
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
          Next.js App Portal                  GeoServer (GIS Tile)
             (Port 3000)                          (Port 8080)
                  │                                   │
                  └─────────┬───────────────┬─────────┘
                            ▼               ▼
                       PostgreSQL         Redis
                       (Port 5432)     (Port 6379)
```

The system is deployed using **Docker Compose** on a Linux VPS. Database records are persisted in a Docker volume, and uploaded contractor files are stored in a dedicated named volume. 

---

## 💻 1. Local Development Setup (Docker)

To run the database and auxiliary services locally for development:

### Prerequisites
* Docker Desktop & Docker Compose installed.
* At least 4GB RAM and 20GB disk space available.

### Quick Start
1. **Start Services:**
   ```bash
   # Run in background
   docker compose up -d
   ```
2. **Configure Environment (`.env`):**
   Update your local `.env` with the Docker database credentials:
   ```env
   DATABASE_URL="postgresql://sltserp_user:YourSecurePassword123!@localhost:5432/sltserp_db?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://sltserp_user:YourSecurePassword123!@localhost:5432/sltserp_db"
   ```
3. **Initialize Database:**
   ```bash
   # Push schema to local Postgres
   npx prisma db push
   # Generate client
   npx prisma generate
   ```

### Local pgAdmin (Database UI)
* **URL:** http://localhost:5050
* **Default Username:** `admin@sltserp.local` (or configuration in `.env`)
* **Default Password:** `admin123`
* **Adding Server in pgAdmin:**
  * **Host:** `postgres` (internal container name) or `localhost` (if connecting from outside docker network)
  * **Port:** `5432`
  * **Username:** `sltserp_user`
  * **Password:** `YourSecurePassword123!`

---

## 🌐 2. Remote VPS Production Setup (Ubuntu/Debian)

This section describes setting up the target server before deploying the application code.

### Step 1: Connect to Server via SSH
```bash
ssh -i /path/to/sltserpkey.pem ubuntu@your-server-ip
# or using password
ssh root@your-server-ip
```

### Step 2: Install Docker
Run the following commands on the VPS:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common unzip

# Add Docker GPG Key & Repo
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine & Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and Enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to Docker group (optional, log out and log back in to apply)
sudo usermod -aG docker $USER
```

### Step 3: Configure Firewall (UFW)
Secure your server by allowing only necessary ports:
```bash
# Allow standard SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# OPTIONAL: Expose pgAdmin web interface (protect this port in production)
sudo ufw allow 5050/tcp

# Enable Firewall
sudo ufw enable
sudo ufw status
```

---

## 🚀 3. CI/CD Deployment via GitHub Actions

The system is configured for automated deployments on every commit pushed to the `main` branch.

### Prerequisites (GitHub Repository Secrets)
Add the following secrets to your GitHub repository (**Settings -> Secrets and variables -> Actions**):
* `SERVER_IP`: The public IP of your remote VPS.
* `SERVER_USER`: The SSH username (e.g., `ubuntu` or `root`).
* `SSH_PRIVATE_KEY`: The contents of your private key file (`.pem`).
* `DATABASE_URL`: Production database URL (`postgresql://sltserp_user:YOUR_PASSWORD@postgres:5432/sltserp_db`).
* `DIRECT_URL`: Direct DB URL for migrations.
* `NEXTAUTH_SECRET`: A secure random string for user authentication tokens.
* `NEXT_PUBLIC_APP_URL`: The domain or public URL of your ERP (e.g., `http://your-server-ip` or `https://erp.yourdomain.lk`).

### What the Deployment Workflow Does
1. Checks out the code and sets up Node.js 22.
2. Installs dependencies and builds the Next.js application in **standalone mode**.
3. Packages the built app, Dockerfiles, public folder, and configuration files into `deploy.zip`.
4. Copies the zip file to the server's `/tmp` directory via SCP.
5. Logs into the server via SSH, moves files to `~/slts-erp`, unzips them, and runs:
   ```bash
   sudo docker compose -f docker-compose.prod.yml up -d --build
   ```

---

## 🗄️ 4. Production Database Administration

### Initial Database Seeding
After deploying for the first time, run the seed script once to create the initial administrative user:
```bash
cd ~/slts-erp
sudo docker exec sltserp-app node prisma/seed.js
```
* **Default Admin Username:** `admin`
* **Default Admin Password:** `Admin@123`
* **IMPORTANT:** Log in immediately and change this default password!

### Setting Up Automated Backups (Cron)
On your remote server, set up a cron job to automatically backup your database daily:

1. **Create the Backup Script:**
   ```bash
   mkdir -p ~/slts-erp/backups
   nano ~/slts-erp/backup.sh
   ```
2. **Paste the following code into `backup.sh`:**
   ```bash
   #!/bin/bash
   BACKUP_DIR=~/slts-erp/backups
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_FILE="$BACKUP_DIR/sltserp_backup_$DATE.sql"

   # Export Postgres DB to file
   docker exec sltserp-postgres pg_dump -U sltserp_user sltserp_db > "$BACKUP_FILE"

   # Compress the backup
   gzip "$BACKUP_FILE"

   # Delete backups older than 7 days
   find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

   echo "Backup completed successfully: $BACKUP_FILE.gz"
   ```
3. **Make the script executable:**
   ```bash
   chmod +x ~/slts-erp/backup.sh
   ```
4. **Schedule the script in Cron:**
   ```bash
   crontab -e
   ```
   Add the following line to run the backup every day at 2:00 AM:
   ```cron
   0 2 * * * ~/slts-erp/backup.sh >> ~/slts-erp/backup.log 2>&1
   ```

### PostgreSQL Performance Tuning (For 4GB+ RAM servers)
If deploying on a production server with at least 4GB of RAM, connect to your database container:
```bash
docker exec -it sltserp-postgres psql -U sltserp_user -d sltserp_db
```
Apply the following tuning configurations:
```sql
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
SELECT pg_reload_conf();
```

### 🔄 Migrating Data from Supabase (Optional)
If migrating from an existing Supabase instance to self-hosted Docker PostgreSQL:
1. **Export data from Supabase:**
   ```bash
   pg_dump "postgresql://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres" > supabase_backup.sql
   ```
2. **Copy the backup file to your remote VPS:**
   ```bash
   scp supabase_backup.sql username@server-ip:~/slts-erp/backups/
   ```
3. **Import the schema/data to your Docker PostgreSQL:**
   ```bash
   docker exec -i sltserp-postgres psql -U sltserp_user -d sltserp_db < ~/slts-erp/backups/supabase_backup.sql
   ```

### 📁 Uploads Storage Volume Backups
To backup contractor uploaded documents stored in the Docker named volume `uploads_data` on the server:
```bash
# Run a temporary alpine container to compress the volume directory to a tar file
docker run --rm -v sltserp_uploads_data:/data -v $(pwd):/backup alpine tar czf /backup/uploads_backup_$(date +%Y%m%d).tar.gz -C /data .
```

### 🔒 Securing & Exposing Remote PostgreSQL (For QGIS Desktop / pgAdmin)
By default, `docker-compose.prod.yml` does **not** expose PostgreSQL port `5432` to the public internet for security. If you need external access (e.g., from QGIS Desktop):

1. **Expose PostgreSQL Port in `docker-compose.prod.yml`:**
   ```yaml
   services:
     postgres:
       # ...
       ports:
         - "5432:5432"
   ```
2. **Restrict Access in UFW Firewall:**
   Only allow your specific IP address (e.g., office IP) to connect to port `5432`:
   ```bash
   # Remove public exposure if any
   sudo ufw delete allow 5432
   # Restrict to designated IP address
   sudo ufw allow from YOUR_OFFICE_OR_QGIS_IP to any port 5432
   ```
3. **Enable SSL inside PostgreSQL Container:**
   Generate certificates on the server and load them into the container:
   ```bash
   # Generate private key and certificate
   openssl req -new -x509 -days 365 -nodes -text -out server.crt -keyout server.key -subj "/CN=sltserp-postgres"

   # Copy key and certificate to the postgres volume mount folder
   docker cp server.crt sltserp-postgres:/var/lib/postgresql/
   docker cp server.key sltserp-postgres:/var/lib/postgresql/

   # Set ownership and permissions
   docker exec -u root sltserp-postgres chown postgres:postgres /var/lib/postgresql/server.crt /var/lib/postgresql/server.key
   docker exec -u root sltserp-postgres chmod 600 /var/lib/postgresql/server.key

   # Enable SSL in postgresql.conf
   docker exec -it sltserp-postgres bash -c 'echo "ssl = on" >> /var/lib/postgresql/data/postgresql.conf'
   docker exec -it sltserp-postgres bash -c 'echo "ssl_cert_file = '\''/var/lib/postgresql/server.crt'\''" >> /var/lib/postgresql/data/postgresql.conf'
   docker exec -it sltserp-postgres bash -c 'echo "ssl_key_file = '\''/var/lib/postgresql/server.key'\''" >> /var/lib/postgresql/data/postgresql.conf'

   # Restart the container to apply SSL
   docker compose -f docker-compose.prod.yml restart postgres
   ```

---

## 🛠️ 5. Troubleshooting & FAQ

### 1. View logs for a running container
```bash
cd ~/slts-erp
docker compose -f docker-compose.prod.yml logs -f [container-name]
# Example (Prisma database or Next.js app logs):
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f postgres
```

### 2. EACCES Permission Denied during file uploads
Contractor documents are saved in a persistent Docker Volume named `uploads_data`. In production, this mounts to `/app/uploads` (or public directory based on config). If permissions get messed up:
```bash
# Correct folder permissions inside the container
docker exec -it -u root sltserp-app chown -R nextjs:nodejs /app/uploads
```

### 3. Serverless Platforms (Vercel) Deprecation Notice
> [!WARNING]
> **Vercel is NO LONGER supported or recommended** for this project due to:
> 1. **No persistent disk storage:** Contractor uploads, photos, and signatures will be lost if hosted in a serverless environment.
> 2. **Companion Services:** The auto-planning background queue runs on **BullMQ/Redis**, and GIS map tiles are served by **GeoServer**. These require persistent background processes not available on Vercel.
> 3. **Timeout Limits:** Server order Excel ingestion takes longer than Vercel's serverless function timeout limits.

---

## 📂 Useful Commands Reference

| Operation | Command |
| :--- | :--- |
| Start stack (Dev) | `docker compose up -d` |
| Stop stack (Dev) | `docker compose down` |
| Update DB schema | `npm run db:sync` or `npx prisma db push` |
| View active stats | `docker stats` |
| Backup database | `docker exec sltserp-postgres pg_dump -U sltserp_user sltserp_db > backup.sql` |
| Restore database | `docker exec -i sltserp-postgres psql -U sltserp_user -d sltserp_db < backup.sql` |
