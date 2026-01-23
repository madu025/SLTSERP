---
description: How to deploy the application to AWS Lightsail
---

To deploy updates to the SLTSERP application on AWS Lightsail, follow these steps:

### 1. SSH into the Server
Connect to your Lightsail instance via SSH.

### 2. Pull Latest Changes (If using Git on Server)
```bash
cd /opt/slts-erp # or your project directory
git pull origin main
```

### 3. Build & Restart (Automatic Batch)
You can run this single command to perform a full update:
```bash
npm install && npx prisma generate && npm run build && pm2 restart all
```

*Note: If you don't use PM2, replace `pm2 restart all` with your specific restart command (e.g., `systemctl restart sltserp`).*

### 4. Database Mutations
If there are schema changes, run:
```bash
npx prisma db push
```

### Troubleshooting
- **Build Fails:** try `rm -rf .next` and then build again.
- **Lock File Issues:** try `rm -rf .next/lock`.
- **DB Connection Issues:** Ensure the firewall port 5432 is open for your local IP or allowed globally.
