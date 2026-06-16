# 🛠️ SLTSERP - One-Click Deployment Guide

This project is optimized for automated deployment to any Linux server running Docker.

## 1. Server Environment Setup
Ensure Docker and Docker Compose are installed on your target server:
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose unzip
sudo usermod -aG docker $USER
# Log out and log back in for group changes to take effect
```

## 2. GitHub Actions Configuration
Update the following Secrets in your GitHub repository:
- `SERVER_IP`: Target server IP address.
- `SERVER_USER`: SSH username (e.g., `ubuntu`).
- `SSH_PRIVATE_KEY`: Your private key (.pem) content.
- `DATABASE_URL`: Standard format `postgresql://sltserp_user:Slts2026Pass@postgres:5432/sltserp_db`
- `NEXTAUTH_SECRET`: A secure random string for authentication.

## 3. Automation Details
The `.github/workflows/deploy.yml` now handles:
- **Binary Compatibility:** Automatically builds Prisma for Linux-Alpine.
- **Dynamic Path Fixing:** Resolves absolute path issues between local/github and server.
- **Nginx Provisioning:** Automatically sets up the reverse proxy.
- **Auto-Wipe:** Ensures a clean installation on every push.

## 4. Initial Database Seeding
After the first successful deployment, run this once to create the Admin user:
```bash
cd ~/slts-erp
sudo docker exec sltserp-app node prisma/seed.js
```
- **Username:** admin
- **Password:** Admin@123

---
🚀 **Your ERP is now production-ready and automated.**
