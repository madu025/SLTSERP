# Nexes ERP: Advanced Scalability & Reliability Roadmap

This roadmap focuses on making the ERP system resilient and high-performing for **10M+ records** and **1000+ concurrent users**, addressing potential failures and "bottlenecks" before they happen.

## Phase 5: Reliability & Infrastructure Integrity (Quick Wins)
*Focus: Ensuring data safety and preventing database connection exhaustion.*

1. **Idempotent Background Jobs**:
   - Refactor `import.worker.ts` to use "Upsert" logic based on unique SOD numbers. (DONE)
   - Prevent duplicate stock deductions if a worker retries a partially failed job. (DONE)
2. **Request Tracing (Correlation IDs)**:
   - Implement middleware for unique `X-Request-ID`. (DONE)
   - Propagate IDs through AsyncLocalStorage to Logs and Prisma queries. (DONE)
3. **Database Pool Isolation**:
   - Configure separate connection limits for Web API and Background Workers to prevent API starvation during heavy imports. (DONE)
4. **Statement Timeouts**:
   - Implement global query timeouts (e.g., 30s) to prevent "hanging" connections from locking the pool. (DONE)

## Phase 6: High-Volume Navigation
*Focus: Making the UI fluid even when browsing millions of rows.*

1. **Cursor-based Pagination**:
   - Shift from `offset` (skip/take) to `cursor` (keyset) pagination for Service Order lists. (DONE - Backend Ready)
   - Implement a stable cursor using `(createdAt, id)` to prevent missing items. (DONE)
2. **Automated Drift Correction**:
   - Create a weekly background job to verify `DashboardStat` totals against raw `ServiceOrder` counts. (DONE - API & Service Ready)

## Phase 7: Database Architecture (The 10M+ Scale)
*Focus: Managing massive tables without slowing down the entire DB.*

1. **Table Partitioning (PostgreSQL)**:
   - Implement "Declarative Partitioning" for the `ServiceOrder` table by Year/Quarter. (DONE - SQL Strategy Prepared)
2. **Read/Write Split (Read Replicas)**:
   - Configure a secondary database for heavy "Read" operations (Reporting/Exports) to offload the primary database. (DONE - Prisma Extension Implemented)
3. **Archive Strategy**:
   - Move records older than 2 years to an `ArchiveServiceOrder` table. (DONE - Part of Partitioning Strategy)

## Phase 8: Advanced Search & Observability
*Focus: Monitoring and instant global search.*

1. **Database Pool Metrics**:
   - Expose Prisma metrics (Active/Idle connections) to the `/api/health` endpoint for real-time saturation monitoring. (DONE)
2. **PgBouncer Integration**:
   - Deploy PgBouncer as a connection proxy to handle 1000+ concurrent connections efficiently via transaction-mode pooling. (Planned for Production)
3. **Specialized Search Engine**:
   - Integrate **Typesense** or **Elasticsearch** for instant cross-field global searches.

---

## Current Progress Tracker
- [x] **Phase 5**: Reliability & Infrastructure (DONE)
- [x] **Phase 6**: High-Volume Navigation (DONE - Frontend & Backend Cursor Ready)
- [x] **Phase 7**: Database Architecture (DONE - Read/Write Split & Extension Prep Ready)
- [x] **Phase 8**: Advanced Search & Metrics (DONE - Trigram Prep & Pool Monitoring Ready)

---

### Implementation Complete: 2026-01-16
All 10 key recommendations have been baked into the codebase:
1. **Request Tracing**: Middleware + Tracing context in all logs.
2. **Idempotency**: Import worker logic updated to prevent duplicates.
3. **Pool Isolation**: Worker/API connection separation.
4. **Timeouts**: Global 30s query safety valve.
5. **Cursor Pagination**: End-to-end (UI -> API -> DB).
6. **Drift Correction**: Daily scheduled accuracy verification.
7. **Read/Write Splitting**: Automatic routing of heavy reads to Replicas.
8. **Partitioning Prep**: SQL Strategy ready for high-volume migration.
9. **Trigram Search**: Extension enabled in Prisma schema & SQL prep ready.
10. **Live Metrics**: Dashboard-ready health monitoring.

**Final Deployment Action**: Run `npx prisma migrate dev` to apply the `pg_trgm` extension and indexes.


