---
name: scalability-performance
description: Review SLTSERP SaaS latency, database/query load, caching, concurrency, and scale-out behavior without weakening correctness.
metadata:
  short-description: Scale safely while preserving scope and invariants
---

# Scalability and performance

Use for slow endpoints, high CPU, connection exhaustion, large reports,
background throughput, caching, pagination, or horizontal scale-out.

- Measure before changing: capture endpoint latency, DB timings, queue lag,
  cache hit rate, connection usage, and representative tenant sizes.
- Fix query shape, indexes, batching, pagination, and N+1 behavior before
  adding broad caches or concurrency. Use the Postgres best-practices skill for
  database changes.
- Scope cache keys by tenant/user/permission and invalidate on authoritative
  writes; never cache a privileged response for another scope.
- Keep transactions short, use row/advisory locks deliberately, and make jobs
  idempotent under retries and multiple workers.
- Load-test realistic limits and preserve authorization, audit, and financial
  precision under concurrency.
