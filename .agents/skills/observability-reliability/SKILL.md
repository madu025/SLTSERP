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
