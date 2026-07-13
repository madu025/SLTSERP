# SLTSERP - Service Order & Resource Management System

A comprehensive, high-throughput ERP system designed to manage Service Orders (SOD), field surveying, material inventory, and contractor allocations for Outside Plant (OSP) operations.

## System Performance & Workload Baselines
This system is architected to handle heavy synchronization and concurrent workloads:
- **User Load:** 500 total users, 200 concurrent active users.
- **Data Throughput:** 200,000 JSON record synchronization per hour (PAT passes).
- **Background Processes:** 15-minute interval RTOM SOD synchronization and continuous Internal Reporting Services.

## Tech Stack & Architecture
To sustain the required performance without CPU throttling (which affects traditional burst-credit instances like AWS Lightsail), the system is deployed using a hybrid cloud structure:

- **Frontend & API Host (VPS 1):** DigitalOcean Droplet (Min. 4GB RAM, 2vCPUs) running Next.js 15, Redis, and Nginx.
- **Database Write Node:** Managed Supabase Pro PostgreSQL (handles the heavy 200k JSON writes and transactional inserts).
- **Database Read Replica:** Supabase Managed Read Replica (handles analytical queries and dashboard reads to prevent write-locks).
- **Object Storage:** Supabase Storage.
- **ORM & Types:** Prisma ORM.

## Quick Start

### Local Development
1. Configure your `.env` connecting to a local PostgreSQL instance.
2. Install dependencies and run:
```bash
npm install
npm run dev
```

### Production Deployment
The application relies on CI/CD pipelines (GitHub Actions) to deploy directly to the DigitalOcean Droplet via SSH. Refer to the `docs/SYSTEM_DOCUMENTATION.md` for exact tunnel and network configurations.
