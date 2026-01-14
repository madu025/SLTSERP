# 🚀 SLTS ERP AWS Lightsail Deployment Guide (Docker)

This guide contains everything you need to know to deploy and manage the system on your AWS Lightsail instance.

## 📌 Server Details
- **IP Address:** `54.255.90.86`
- **SSH User:** `ubuntu` (Default for AWS Ubuntu instances)
- **SSH Key Location:** `C:\Users\Prasad\Downloads\LightsailDefaultKey-ap-southeast-1.pem`
- **Project URL:** `http://54.255.90.86`

---

## 🔑 1. SSH Login Command
Open PowerShell or Command Prompt on your PC and run:
```bash
ssh -i "C:\Users\Prasad\Downloads\LightsailDefaultKey-ap-southeast-1.pem" ubuntu@54.255.90.86
```

---

## 🛠️ 2. First-Time Server Setup
Run these commands once you log in to the server:

```bash
# Update and install Docker + Git
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# Give yourself permission to run Docker without 'sudo'
sudo usermod -aG docker $USER

# !!! IMPORTANT: Exit and Re-login to apply permissions !!!
exit
```

---

## 🏗️ 3. Deploy the Application
After logging back in:

```bash
# 1. Clone the project (if not already done)
git clone https://github.com/madu025/SLTSERP.git slts-erp
cd slts-erp

# 2. Create the environment file
nano .env
```

**Paste the following into the `.env` file (Right-click to paste in most terminals):**
```env
DATABASE_URL="postgresql://user:password@hostname:5432/dbname?sslmode=require"
DIRECT_URL="your_direct_database_url_here"
NEXTAUTH_SECRET="f658fb5b415a2a3b2e43be904348807a"
NEXTAUTH_URL="http://54.255.90.86"
CRON_SECRET="your_strong_secret_for_sync"
PORT=3000
```
*(Press `Ctrl + O`, `Enter`, then `Ctrl + X` to save and exit)*

```bash
# 3. Start the system (App + Background Worker)
docker-compose up -d --build
```

---

## 🔄 4. How to Update After Git Push
Whenever you push new code to GitHub from your PC, run this on the server:

```bash
# Go to project folder
cd ~/slts-erp

# Get latest code
git pull origin main

# Rebuild and restart containers
docker-compose up -d --build

# Optional: Cleanup old images to save space
docker image prune -f
```

---

## 🗄️ 5. Database Migrations
If you make changes to the database schema (Prisma), you need to push those changes to the live database:

```bash
# Run migration inside the running app container
docker exec -it slts-erp-app-1 npx prisma db push
```

---

## 📊 6. Monitoring & Maintenance
- **Check if everything is running:** `docker ps`
- **View App Logs:** `docker-compose logs -f app`
- **View Background Sync Logs:** `docker-compose logs -f worker`
- **Stop System:** `docker-compose down`

## ⚠️ Required AWS Networking Rules
Go to **AWS Lightsail Console -> Networking** and ensure these ports are open:
1. **HTTP (Port 80):** For web access
2. **HTTPS (Port 443):** For secure web access
3. **SSH (Port 22):** For terminal access (Required to run commands)
