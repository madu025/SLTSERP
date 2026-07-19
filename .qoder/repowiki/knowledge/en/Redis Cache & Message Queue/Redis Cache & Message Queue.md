---
kind: external_dependency
name: Redis Cache & Message Queue
slug: redis
category: external_dependency
category_hints:
    - framework_behavior
    - client_constraint
scope:
    - '**'
---

### Redis Integration
- **Role:** Dual-purpose: caching layer for permissions/OPMC lists and BullMQ job queue for background processing (Excel imports, heavy computations).
- **Framework Behavior:** Connection retry strategy differs by environment — fast failure in dev/serverless (maxRetriesPerRequest: 3) vs infinite retry in production (null).
- **Client Constraint:** Worker processes require maxRetriesPerRequest: null to prevent hanging threads during long-running jobs.
- **Configuration:** REDIS_URL environment variable with fallback to redis://localhost:6379 for development.