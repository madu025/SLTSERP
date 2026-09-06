# SLTSERP - Service Order & Resource Management System

A comprehensive, high-throughput ERP system designed to manage Service Orders (SOD), field surveying, material inventory, and contractor allocations for Outside Plant (OSP) operations.

## System Performance & Workload Baselines
This system is architected to handle heavy synchronization and concurrent workloads:
- **User Load:** 500 total users, 200 concurrent active users.
- **Data Throughput:** 200,000 JSON record synchronization per hour (PAT passes).
- **Background Processes:** One external 10-minute Master Tick (cron-job.org) drives the per-RTOM sweep, 20/30-minute syncs, wall-clock dailies, and the terminal-status self-heal. Serverless execution runs inside the Vercel function budget with a stored cursor so the next ping resumes cleanly.

## Tech Stack & Architecture
The runtime is a two-node topology: Vercel hosts every request, Supabase hosts every byte of persistent state.

- **Web, API and Cron (Vercel):** Next.js 16 deployed to https://sltserp.vercel.app (region sin1). Every route handler, page, and the `/api/cron/sync-all` Master Tick run as Vercel serverless functions (15s standard, 60s cron). Workers are dormant by design: `src/instrumentation.ts` skips `initializeBackgroundWorkers` whenever `process.env.VERCEL === '1'`, so BullMQ never boots in production.
- **Database:** Supabase Pro PostgreSQL reached through the session-mode pooler (`aws-1-ap-southeast-1.pooler.supabase.com:5432`). The project ceiling is 15 shared server sessions; `src/lib/prisma.ts` clamps every client to a downward-only share so Vercel lambdas, `prisma db push` and this local dev box never oversubscribe the pool.
- **Object Storage and Auth Config:** Supabase Storage (gate photos, attachments) and Supabase Auth helpers via `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **ORM & Types:** Prisma with the multi-file schema under `prisma/schema/`. Supabase is converged declaratively via `prisma db push`, so migration history is not applied and hand-managed objects live in `prisma/post-push-indexes.sql`.
- **Scheduler:** exactly one external clock (cron-job.org "SLTSERP - Master Tick", minutes 0/10/20/30/40/50 Asia/Colombo) hits `https://sltserp.vercel.app/api/cron/sync-all`. No other scheduler or self-hosted runner exists. `vercel.json` intentionally has no `crons` block.
- **Browser Extension Delivery:** the SLT-ERP Chrome/Firefox bridge distributes via `public/slt-bridge*` and `public/extension-builds/`; the CRX/XMLID update path is served statically by Vercel.

## Quick Start

### Local Development
1. Copy `.env.example` to `.env`, fill Supabase `DATABASE_URL` / `DIRECT_URL` and `NEXT_PUBLIC_SUPABASE_*`, and set `CRON_SECRET` / `NEXTAUTH_SECRET`.
2. Install dependencies and run:
```bash
npm install
npm run dev
```

### Production Deployment
Push to `main`; Vercel builds the Next.js standalone output and cuts a new production deployment automatically. After any Prisma model change, run `npm run db:sync` from a workstation against the production `DATABASE_URL` to converge Supabase and re-apply `prisma/post-push-indexes.sql`. The Master Tick URL is set once via `node scripts/setup-cron.js https://sltserp.vercel.app` (idempotent) and never needs editing during normal releases.
