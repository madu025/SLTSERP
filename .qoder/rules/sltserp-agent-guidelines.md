---
trigger: model_decision
description: SLTSERP project-scoped agent guidelines. MUST be read before any non-trivial code change, refactor, schema change, or new feature work in this repository.
---

# SLTSERP Agent Guidelines (Pointer Rule)

The full project-scoped agent guidelines live at `.agent/AGENTS.md` (427 lines). Read that file BEFORE making non-trivial changes. Key invariants:

## Mandatory Production-Level Coding Standards

1. API routes (`src/app/api/.../route.ts`) must wrap write/complex-read handlers with `apiHandler` (Zod validation, RBAC, audit trail). No direct `prisma.[model]` access in controllers — business logic lives in `src/services/`.
2. No soft relations — all Prisma relations must be explicit foreign keys.
3. `@@index` on every lookup/sort field; server-side pagination for tables > 100 rows.
4. `export const dynamic = 'force-dynamic'` on dynamic GET API routes.
5. Zero `any` / lazy `unknown` tolerance — strict interfaces, Zod schemas, or Prisma types only.
6. Avoid O(N^2) loops; use HashMaps/Sets and `prisma.$transaction()` batches.

## Audit-Derived Schema Rules

- Fixed-value fields MUST be Prisma enums, never plain Strings.
- Individually-queryable data must be relation tables, never `Json` columns.
- Primary keys: native `@db.Uuid` via `uuid_generate_v7()` or `BigInt autoincrement()`; business document codes (`MIN-YYYY-MM-XXXX`, `INV-...`) decoupled as `@unique` sequence fields.
- Money/quantities: `@db.Decimal(14,2)` or `(15,4)` — never `Float`.

## Financial Data Integrity (Non-Negotiable)

1. Multi-table writes touching money/stock/ledger MUST be in `prisma.$transaction()`.
2. Payment/invoice/payout mutation endpoints support idempotency keys.
3. STOP RULE: if a change touches a financial/ledger/invoice write path, stop and confirm the approach with the user first, even if it looks obviously correct.
4. No silent `catch {}` blocks anywhere; on financial paths this is a data-integrity issue.

## Store Material Issue Note Ledger Rules

1. Every material issue/dispatch/transfer/return MUST display an explicit Issue Note Number (`issueNumber` / MIN / MRN Ref, e.g. `MIN-2026-07-0012`) on both Main Store UI and Contractor Mobile App screens.
2. All custody transfers write an immutable `InventoryLedger` entry with SHA-256 checksum (`id + storeId + itemId + quantityAfter + createdAt`).
3. Preflight: before building any feature, identify whether it needs auditable signatures, issue note references, or role isolation — enforce at schema and API layer.

Full details: `.agent/AGENTS.md`. Session audit history: `.agent/grill-me-log.md`.
