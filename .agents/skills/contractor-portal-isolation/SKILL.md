---
name: contractor-portal-isolation
description: Enforce SLTSERP contractor portal isolation, service-order scope, contractor stock custody, and invoice boundaries.
metadata:
  short-description: Keep contractor actions scoped and separate
---

# Contractor portal isolation

Use for contractor portal pages/APIs, SOD work packages, contractor inventory,
material returns, contractor invoices, or internal-versus-external routes.

- Contractor users must use contractor-scoped endpoints; do not reuse internal
  Project, Store, or Finance mutation routes as a shortcut.
- Enforce authenticated contractor, assignment, project, OPMC, and store scope
  server-side on every read and write.
- Bind stock issue/return, work submission, invoice, and approval actors to the
  session and reject client-supplied contractor IDs or simulated identities.
- Keep contractor invoice submission distinct from approval, settlement, and
  completion. Preserve audit and custody records for all stock movements.
- Test a permitted contractor, another contractor, another OPMC/project, and
  an internal user attempting the portal route.

Pair this skill with `rbac-scope`, `inventory-audit`, and `finance-controls` for
cross-domain mutations.
