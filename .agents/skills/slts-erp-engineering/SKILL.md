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

Do not claim a production PASS from unit tests, a local build, or an API-only
check. Keep local/API, browser/lifecycle, and deployed evidence separate.
