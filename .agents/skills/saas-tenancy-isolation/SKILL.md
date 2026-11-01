---
name: saas-tenancy-isolation
description: Design and review SLTSERP SaaS tenant, organization, OPMC, project, store, and data-access isolation boundaries.
metadata:
  short-description: Prevent cross-tenant data and capability leakage
---

# SaaS tenancy isolation

Use for tenant/organization models, onboarding, user invitations, shared
resources, reports, exports, caches, jobs, storage keys, or any cross-tenant
read/write path.

- Identify the tenant and data scope from the authenticated server context;
  never accept a client tenant/organization as the sole authority.
- Enforce isolation in API/service queries, background jobs, cache keys,
  storage object keys, search indexes, exports, notifications, and audit logs.
- Make `undefined`/empty/allowlist scope semantics explicit and fail closed;
  test same-tenant allow and cross-tenant deny for every new operation.
- Prevent IDOR through guessed UUIDs, bulk endpoints, nested relations, and
  aggregate/report queries. Re-check scope after loading related records.
- Treat support/admin impersonation as a separately audited, time-bounded,
  least-privilege capability with visible banners and no silent elevation.
