---
name: observability-reliability
description: Improve SLTSERP operational visibility, health checks, structured logs, retries, and worker reliability without leaking secrets.
metadata:
  short-description: Make failures diagnosable and safe to operate
---

# Observability and reliability

Use for background jobs, queues, sync, health endpoints, metrics, retries,
performance changes, or production incidents.

- Emit structured events with correlation/request IDs, operation, entity, and
  outcome; redact secrets, tokens, passwords, and sensitive payloads.
- Distinguish liveness, dependency readiness, worker health, and business
  acceptance. A healthy HTTP endpoint is not proof that a workflow completed.
- Make retries bounded and idempotent, surface terminal failure, and preserve
  enough audit context to replay or repair safely.
- Measure slow DB calls, queue lag, external 4xx/5xx, and storage failures;
  avoid logging every payload or adding unbounded high-cardinality labels.
- Add a regression test or diagnostic command for each reliability fix and
  verify after the startup/worker settling window.

## Deployment and startup reliability

- Emit a release correlation containing the commit SHA, deployment UUID,
  rollout phase, container identity, readiness transition, and proxy switch.
  Never include tokens, passwords, webhook secrets, connection strings, or
  request payloads in that record.
- Detect and alert on duplicate production rollouts for the same commit. The
  expected topology is one verified GitHub workflow deployment to Coolify;
  direct Git webhooks and second hosting auto-deploys must be disabled for the
  same hostname.
- Track separate timings for image build, migration/seed, process start,
  liveness, readiness, proxy handoff, and old-container removal. This makes a
  temporary no-backend window distinguishable from an application crash.
- A single replica cannot provide handoff availability. Expose active healthy
  replica count and fail a zero-downtime claim when it falls below the rollout
  target or when the proxy has no ready backend.
- Database migrations and idempotent catalog seeds must have one clear owner:
  a release step before rollout or a deliberately serialized startup owner.
  Do not run expensive schema/data reconciliation independently in every web
  replica without measuring the lock and readiness impact.
- Keep `/api/health/live` cheap and dependency-free. Report database, Redis,
  queue, worker, and sync freshness separately in readiness/operational health;
  partial stale feeds should be visible without making liveness pretend the
  process is dead.
