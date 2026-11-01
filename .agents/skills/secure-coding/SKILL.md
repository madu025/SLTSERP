---
name: secure-coding
description: Harden SLTSERP application code against common web, API, session, secret, and input-validation vulnerabilities.
metadata:
  short-description: Apply secure coding and OWASP checks
---

# Secure coding

Use for auth/session changes, new API routes, file uploads, external URLs,
search/filter inputs, background jobs, secrets, or any user-controlled data.

- Validate and normalize input at the server boundary; reject unexpected
  fields, non-finite numbers, unsafe paths, and oversized payloads.
- Enforce authorization after authentication on every read and write. Never
  trust client role, actor, tenant, project, store, or approval identifiers.
- Keep secrets, tokens, passwords, database URLs, and raw personal data out of
  source, logs, screenshots, fixtures, and test output.
- Use parameterized Prisma/SQL queries, safe URL allowlists for callbacks and
  uploads, and explicit content/type/size checks for files.
- Preserve CSRF/session protections and do not use editable user metadata as an
  authorization claim.

Before handoff, run targeted tests plus `pnpm run test:types`; for security
changes also run the relevant RBAC and integration tests. Record failures
instead of weakening a guard to make a test pass.
