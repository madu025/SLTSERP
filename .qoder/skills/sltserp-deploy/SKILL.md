---
name: sltserp-deploy
description: Deploy the SLTSERP application to Vercel with Supabase connection pooling, environment variables, and Prisma migration steps. Use when the user asks to deploy, publish, or release SLTSERP to Vercel, or when configuring Vercel environment variables.
---

# Deploy SLTSERP to Vercel

## 1. Database Configuration (Prerequisites)

Vercel is serverless, so a connection-pooled PostgreSQL URL is required.

Supabase Connection Pooling:
- Transaction Mode (Port 6543): set as `DATABASE_URL` for normal operations.
- Session Mode (Port 5432): set as `DIRECT_URL` for running Prisma migrations.

## 2. Vercel Project Setup

1. Log into the Vercel Dashboard and click Add New -> Project.
2. Import the GitHub repository `madu025/SLTSERP`.
3. Set the Framework Preset to Next.js.

## 3. Environment Variables

In Vercel Project Settings, configure:

- `DATABASE_URL`: Transaction-pooled database connection string.
- `DIRECT_URL`: Direct database connection string (for migrations).
- `NEXTAUTH_SECRET`: Secure random string (e.g. `openssl rand -base64 32`).
- `NEXT_PUBLIC_APP_URL`: The Vercel deployment URL (e.g. `https://slt-nexus.vercel.app`).
- `NEXTAUTH_URL`: Same as `NEXT_PUBLIC_APP_URL`.

## 4. Build and Development Command

- The build command is pre-configured in `package.json` to generate the Prisma client before building Next.js: `npx prisma generate && next build`
- Vercel automatically executes `npm run build` during deployment.

## 5. Running Database Migrations

Prisma migrations/db-push cannot run inside the serverless build step (database may not be reachable at build time). Run from a local machine pointing to the production database:

```bash
npx prisma db push
```

## Serverless Constraints on Vercel

- Execution Timeouts: long-running scraping/sync tasks must be broken down or run in a background worker (10s timeout on Hobby, up to 900s on Pro).
- Static Assets: cached files and uploads cannot be saved to local disk. Use external storage (AWS S3 or Supabase Storage) for documents, NIC uploads, and photos.
