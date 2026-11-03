---
name: slts-erp-engineering
description: Apply SLTSERP engineering guardrails when changing Project, Finance, Inventory, RBAC, UI, email, database, or deployment code.
metadata:
  short-description: Route SLTSERP changes through the correct safety and verification skills
---

# SLTSERP engineering router

Use this skill for any non-trivial SLTSERP code change. Read the repository
`AGENTS.md` first; it is authoritative for package manager, authorization,
audit, UI contrast, and safety rules.

Route the task to the smallest applicable local skills:

- Authorization, tenant/OPMC/store scope, or approval: `rbac-scope`
- SQL, Prisma, migrations, RLS, or query performance: `supabase-postgres-best-practices`
- Security-sensitive input, secrets, sessions, or file/network handling: `secure-coding`
- Project/Finance lifecycle or accounting invariants: `finance-controls`
- Material custody, stores, issue/return, or stock ledger: `inventory-audit`
- Browser lifecycle, real DB read-back, or role QA: `browser-qa`
- New or changed UI: `ui-accessibility`
- Email sending: `email-templates`
- Build, release, Coolify, or production verification: `release-verification`
- Service-order status sync, Redis, queues, or workers: `service-order-sync`
- GIS, QField, uploads, MinIO/S3, or geospatial processing: `storage-gis-qfield`
- Contractor portal, SOD, contractor stock, or contractor invoice boundaries: `contractor-portal-isolation`
- QA accounts, fixtures, seed data, or browser setup: `qa-fixture-management`
- Reports, exports, reconciliations, or read models: `reporting-reconciliation`
- Health, metrics, retries, logs, or worker reliability: `observability-reliability`
- AI/agent, prompts, model data, or generated decisions: `ai-data-governance`
- Vehicles, fleet, assets, maintenance, or EAM: `fleet-eam-controls`
- Any tenant/organization boundary or cross-tenant data path: `saas-tenancy-isolation`
- Plans, billing, quotas, subscriptions, or feature entitlements: `saas-billing-entitlements`
- Personal data, retention, export, deletion, or compliance: `privacy-compliance`
- Public API, webhooks, integrations, rate limits, or versioning: `api-platform-governance`
- Backups, restore, disaster recovery, or data-loss prevention: `backup-disaster-recovery`
- Caching, latency, load, concurrency, or scale-out: `scalability-performance`
- Dependencies, containers, CI artifacts, or supply-chain risk: `supply-chain-hardening`
- Environment config, secrets, feature flags, or runtime settings: `configuration-secrets`
- Security incidents, breach response, or operational escalation: `incident-response`

For production delivery, use the immutable image path: GitHub Actions builds
and publishes the verified commit, `pnpm run db:release` owns the one-time
Prisma/index/catalog/RBAC release step, and Coolify pulls that image through a
Docker Image application. Do not add migrations or seeds back to web startup,
and do not mix a Git/Dockerfile Coolify build with the image deployment.

Do not claim a production PASS from unit tests, a local build, or an API-only
check. Keep local/API, browser/lifecycle, and deployed evidence separate.
