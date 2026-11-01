---
name: api-platform-governance
description: Govern SLTSERP public and internal APIs, webhooks, integrations, rate limits, versioning, and contract compatibility.
metadata:
  short-description: Keep API contracts safe and evolvable
---

# API platform governance

Use for new routes, public integrations, webhooks, mobile clients, API
contracts, pagination, bulk operations, or breaking changes.

- Define authentication, authorization, tenant scope, input/output schema,
  idempotency, rate limits, timeout, and audit behavior before implementation.
- Version incompatible changes; preserve existing clients or provide an
  explicit migration path. Never silently change money/status semantics.
- Verify webhook signatures, timestamps/nonces, replay protection, delivery
  retries, and idempotent event handling.
- Bound pagination, filters, payload size, concurrency, and expensive report
  queries. Return safe errors without stack traces or sensitive data.
- Add route contract tests for success, validation, unauthorized, cross-scope,
  duplicate, timeout, and backwards-compatibility cases.
