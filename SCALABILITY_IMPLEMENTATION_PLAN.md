# Nexes ERP: Scalability Implementation Plan

This plan outlines the concrete steps to apply the identified scalability recommendations to the live system.

## Phase 1: Frontend Performance (Cursor Pagination)
*Goal: Remove 'offset' bottlenecks in the UI.*

- [x] Backend Support: Added `cursor` and `nextCursor` to Service Orders API.
- [ ] UI Update: Modify `service-orders/page.tsx` to handle cursor-based navigation.
- [ ] UI Update: Modify `completed/page.tsx` and `return/page.tsx`.

## Phase 2: Database Speed (Search & Performance)
*Goal: Instant search results across millions of rows.*

- [x] SQL Script: Created `SEARCH_OPTIMIZATION.sql` (Trigram Indexes).
- [ ] Deployment: Apply Trigram indexes to the PostgreSQL database.
- [x] SQL Script: Created `PARTITIONING_STRATEGY.sql`.
- [ ] deployment: Plan maintenance window for table partitioning migration.

## Phase 3: Reliability & Maintenance
*Goal: Keeping the system healthy 24/7.*

- [x] Backend: Create Drift Correction API.
- [ ] Automation: Set up a GitHub Action or Vercel Cron to ping `/api/cron/drift-correction` weekly.
- [x] Infrastructure: Configure `READ_REPLICA_URL` for reporting consistency.

---

## Status Update: 2026-01-16
- **Request Tracing**: 100% Core logic implemented.
- **DB Pooling**: 100% Isolation logic implemented.
- **Next Task**: Update Frontend to support Cursor Pagination.
