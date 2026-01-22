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
The application auto-deploys to AWS Lightsail via GitHub Actions on push to `main` branch.

## Tech Stack
- Next.js 15
- PostgreSQL
- Prisma ORM
- Docker & Docker Compose
