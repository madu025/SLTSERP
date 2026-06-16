# SLTSERP - Service Order Management System

A comprehensive ERP system for managing service orders, inventory, contractors, and invoicing.

## Server Details
- **Production Server:** 13.215.62.184
- **Port:** 3000
- **Database:** PostgreSQL (Docker)

## Quick Start

### Local Development
```bash
npm install
npm run dev
```

### Production Deployment
The application is deployed to **Vercel** with automatic deployments triggered on git push to the `main` branch.

## Tech Stack
- Next.js 15
- PostgreSQL (Supabase with Connection Pooling)
- Prisma ORM
- Vercel (Production Hosting)
- Docker & Docker Compose (Local Development & Testing)
