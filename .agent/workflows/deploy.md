---
description: How to deploy the application to Vercel
---

To deploy updates to the SLTSERP application on Vercel, follow these steps:

### 1. Database Configuration (Prerequisites)
Since Vercel is a serverless environment, you must use a connection-pooled PostgreSQL URL.
- **Supabase Connection Pooling:**
  - **Transaction Mode (Port 6543):** Set this as `DATABASE_URL` for normal operations.
  - **Session Mode (Port 5432):** Set this as `DIRECT_URL` for running Prisma migrations.

### 2. Vercel Project Setup
1. Log into your Vercel Dashboard and click **Add New** -> **Project**.
2. Import the GitHub repository `madu025/SLTSERP`.
3. Set the Framework Preset to **Next.js**.

### 3. Environment Variables
In Vercel Project Settings, configure the following Environment Variables:
- `DATABASE_URL`: Transaction-pooled database connection string.
- `DIRECT_URL`: Direct database connection string (for migrations).
- `NEXTAUTH_SECRET`: Generate a secure random string (e.g., `openssl rand -base64 32`).
- `NEXT_PUBLIC_APP_URL`: Your Vercel deployment URL (e.g., `https://slt-nexus.vercel.app`).
- `NEXTAUTH_URL`: Same as `NEXT_PUBLIC_APP_URL`.

### 4. Build and Development Command
- The build command is pre-configured in `package.json` to generate the Prisma client before building Next.js:
  `npx prisma generate && next build`
- Vercel will automatically execute `npm run build` during deployment.

### 5. Running Database Migrations
Since Prisma migrations/db-push cannot be executed within the build step of serverless deployment (as database connections might not be accessible during build time), run it from your local machine pointing to the production database:
```bash
npx prisma db push
```

### Serverless Constraints on Vercel
- **Execution Timeouts:** Long-running scraping/sync tasks must be broken down or run in a background worker since Vercel Serverless Functions have a maximum timeout (10 seconds on Hobby, up to 900 seconds on Pro).
- **Static Assets:** Cached files and uploads cannot be saved to the local disk. Use external storage (like AWS S3 or Supabase Storage) for documents, NIC uploads, and photos.

