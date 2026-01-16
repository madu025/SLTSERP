# SLTSERP Scalability Roadmap (2M+ Records)

This document outlines the architectural migration to support high-volume data (2M+ records) and concurrent users (1000+) without changing the core business requirements or functionality.

## Principles
- **No Functional Change**: UI behavior and business rules remain strictly as defined.
- **Asynchronous by Default**: Long-running tasks (imports, reports) move to background queues.
- **Read/Write Separation**: Dashboards read from optimized summary tables, not the full transaction log.
- **Database Relief**: Redis handles frequent lookups to prevent DB connection exhaustion.

---

## Phase 1: Infrastructure & Caching
**Goal**: Reduce Database load for repeatable lookups.

1. **Redis Integration**:
   - Install and configure Redis.
   - Implement a shared Redis utility in `src/lib/redis.ts`.
2. **Permission & Metadata Cache**:
   - Cache OPMC lists and RTOM mappings (TTL: 1 hour).
   - Cache User Permissions/RBAC roles (TTL: 10 mins).
3. **Session Store**:
   - (Optional) Move session management to Redis if performance bottlenecks occur during login peaks.

## Phase 2: Background Processing (BullMQ)
**Goal**: Offload heavy computations to worker processes.

1. **Worker Architecture**:
   - Setup `BullMQ` with Redis.
   - Create a dedicated worker entry point `src/workers/main.worker.ts`.
2. **Async Service Order Import**:
   - Refactor `admin/sod-import` to push Excel data to a queue.
   - Implement real-time progress tracking via WebSockets or Polling.
3. **Automated Notification Queue**:
   - Queue all SMS/Email triggers to prevent API request delays.

## Phase 3: CQRS & Dashboard Optimization
**Goal**: Sub-second dashboard loads on 2M+ records.

1. **Summary Metrics Table**:
   - Create `DashboardStats` table in Prisma to store pre-calculated counts per RTOM/OPMC.
2. **Incremental Updates**:
   - Update `sod.service.ts` to trigger a background job that increments/decrements counts in the Summary table whenever an SOD status changes.
3. **Database Index Tuning**:
   - Perform `EXPLAIN ANALYZE` on all primary tables.
   - Implement composite indexes for complex multi-filter screens.

## Phase 4: Observability & Service Refinement
**Goal**: Monitor system health and finalize the service layer.

1. **Slow Query Logging**:
   - Implement Prisma middleware to log queries exceeding 1000ms.
2. **Centralized Service Layer**:
   - Finalize the migration of all business logic to the `src/services/` directory.
   - Ensure "Invariants" (validation rules) are enforced in the service layer, not just the UI.
3. **Automatic Cleanup**:
   - Implement background jobs for log rotation and temporary file cleanup.

---

## Status Tracking
- [x] Phase 1: Infrastructure & Caching (Redis Setup & OPMC Caching Done)
- [x] Phase 2: Background Processing (SOD Import Async Implemented)
- [x] Phase 3: CQRS & Read Optimization (DashboardStats table & Incremental Updates Done)
- [x] Phase 4: Observability & Resilience (Slow Query Logging & Health Checks Implemented)

> **Note**: To run background workers in development, ensure a separate worker process is started or the worker is imported in a long-running instance. Implemented workers can be found in `src/workers/`.
> **Action Required**: Run `POST /api/admin/stats/recalculate` once to initialize the dashboard stats.
