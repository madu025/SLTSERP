---
name: service-order-sync
description: Protect SLTSERP service-order lifecycle synchronization, Redis queues, workers, retries, and idempotent status updates.
metadata:
  short-description: Keep SOD sync reliable and auditable
---

# Service-order sync

Use for SOD state changes, SLT/OSP bridges, Redis-backed processing,
`src/services/service-order/sync`, workers, SSE status, or retry logic.

- Treat the canonical service-order state machine as authoritative; reject
  invalid, out-of-order, duplicate, or terminal-state transitions.
- Make status writers idempotent and preserve an audit record for every
  external request, response, retry, and failure. Never acknowledge a message
  before durable persistence.
- Bound retries with backoff and a visible failed/dead-letter state. Do not
  hide queue or worker failures behind a successful HTTP response.
- Keep external IDs, payload hashes, and correlation IDs separate from user
  input; do not log tokens, credentials, or full sensitive payloads.
- Verify worker/Redis health and read back the persisted SOD status after a
  sync test.

Run `pnpm run check:sync`, relevant integration/unit tests, and a real browser
SOD lifecycle when the change affects user-visible workflow.
