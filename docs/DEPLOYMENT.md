# 🚀 SLTS ERP Vercel Deployment Guide

This guide contains the instructions to deploy and manage the SLTS ERP (Nexus) system on Vercel.

---

## 📌 Prerequisites & Serverless Architecture
Vercel is a **serverless hosting platform**. Unlike traditional VPS hosting (like AWS Lightsail):
- **No persistent disk storage:** Uploaded files, signatures, or photos cannot be saved locally. You must use an external cloud storage provider (e.g., Supabase Storage, AWS S3, or Cloudinary).
- **Serverless functions:** APIs and page requests run as serverless functions. Long-running tasks (like background syncs or scrapers) may hit execution timeouts (10 seconds on Hobby, 15–300+ seconds on Pro).
- **Connection Limits:** Database connections can scale up rapidly. You **MUST** use connection pooling (e.g., Supabase Connection Pooler or Prisma Accelerate) to prevent exhausting your PostgreSQL connection limits.

---

## 🔑 1. Database Configuration
Make sure your PostgreSQL database (typically hosted on Supabase) is configured with two connection strings:
1. **Transaction Pooler (Port 6543):** Used for standard application operations to reuse connections.
   - Example: `postgres://[user].[project-id]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
2. **Session / Direct Connection (Port 5432):** Used for running migrations/schemas.
   - Example: `postgres://[user]:[password]@db.[project-id].supabase.co:5432/postgres`

---

## 🛠️ 2. Deployment Setup on Vercel

### Step 1: Link Repository
1. Go to the [Vercel Dashboard](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import the repository: `madu025/SLTSERP`.

### Step 2: Configure Settings
- **Framework Preset:** Select **Next.js**.
- **Root Directory:** `./`
- **Build & Development Settings:**
  - Build Command: `npx prisma generate && next build`
  - Vercel automatically runs the build scripts defined in `package.json`. The `"postinstall": "prisma generate"` script in `package.json` ensures the Prisma Client is generated inside Vercel's container.

### Step 3: Add Environment Variables
Add the following variables in the **Environment Variables** section:

| Variable Name | Description / Example Value |
|---|---|
| `DATABASE_URL` | Supabase Transaction Pooler connection string (with `?pgbouncer=true` if using PgBouncer). |
| `DIRECT_URL` | Supabase Direct connection string (for migrations). |
| `NEXTAUTH_SECRET` | A secure random string for encryption (e.g., `openssl rand -base64 32`). |
| `NEXTAUTH_URL` | The production URL of your app (e.g., `https://slt-nexus.vercel.app`). |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL`. |

---

## 🔄 3. Continuous Integration & Updates
Whenever you push new commits to the `main` branch:
1. GitHub triggers a webhook to Vercel.
2. Vercel automatically initiates a production build.
3. If the build succeeds, the new version is instantly routed to production.

---

## 🗄️ 4. Running Database Migrations
Since Vercel builds the frontend and serverless functions in an isolated environment, database migrations should not be run during the build step. 

Run database schema changes from your local machine pointing to the database:
```bash
# Push schema updates to production PostgreSQL
npx prisma db push
```

---

## 📊 5. Troubleshooting & Limitations
* **Prisma Client Issues:** If you encounter database errors post-deployment, verify that `DATABASE_URL` and `DIRECT_URL` are set correctly in Vercel settings and trigger a redeployment.
* **Serverless Function Timeouts (504 Gateway Timeout):** Ensure scraping/syncing logic is optimized, batch-processed, or run in small chunks to avoid hitting the serverless timeout limit.
