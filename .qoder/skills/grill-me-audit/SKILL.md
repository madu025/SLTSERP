---
name: grill-me-audit
description: 5-QA Auditor line-by-line code review protocol for SLTSERP. Use when the user runs "/grill-me audit" or requests a multi-role QA code audit, schema review, or rigorous cross-examination of code before QA test clearance.
---

# /grill-me audit — 5-QA Auditor Line-by-Line Code Review Protocol

Use this workflow whenever the user runs `/grill-me audit` or requests a multi-role QA code audit.

## Purpose

Rigorously cross-examine, challenge, debate, and upgrade target code or database schemas using 5 specialized QA expert auditors line-by-line, ensuring zero bugs, zero type errors, maximum security, optimal performance, and 100% QA test clearance.

## The 5 Specialized QA Auditor Personas

1. QA Auditor 1 — Data Integrity & Schema Enforcement
   Enforces: native PostgreSQL UUID v7 (`@db.Uuid`), `Decimal(14,2)` monetary precision, 3NF foreign key integrity, Prisma enum state machines, and zero invalid database states.

2. QA Auditor 2 — Security & RBAC Penetration
   Enforces: `apiHandler` Zod input validation, `RoleGuard` RBAC enforcement, SQL injection immunity, zero hardcoded secrets, and RLS / JWT security.

3. QA Auditor 3 — Big-O Performance & Egress
   Enforces: O(1) HashMaps, O(N) batch transactions, zero database egress regress (selective `select` blocks), and force-dynamic caching standards.

4. QA Auditor 4 — Failover, Edge Case & Idempotency
   Enforces: zero silent `try/catch` blocks, idempotency key checks on mutations, race condition prevention, and strict TypeScript types (zero `any`).

5. QA Auditor 5 — Enterprise Domain & Audit Ledger
   Enforces: MIN/MRN store issue notes, immutable `InventoryLedger` SHA-256 checksums, full job costing, and GAAP/IFRS revenue recognition rules.

## Mandatory Execution Workflow

### Step 1: Identify Target Code / Module

Search the codebase map (grep on `.agent/CODEMAP.md` or targeted files) and view the code line-by-line.

### Step 2: 5-QA Auditor Line-by-Line Debate

Run a structured debate where all 5 QA auditors cross-examine the target code line-by-line and state their critiques:

- Auditor 1: DB data type / 3NF FK flaws.
- Auditor 2: Security / Zod / role permission vulnerabilities.
- Auditor 3: Performance / over-fetching / N+1 bottlenecks.
- Auditor 4: Edge cases / missing error handling / `any` types.
- Auditor 5: Domain ledger / MIN audit compliance gaps.

### Step 3: Consolidated QA Fix Matrix

Present a unified review table with categorized fixes:

- Must-Have: blocks correctness, security, or data integrity — auto-adopted.
- Should-Have: improves architecture — requires user sign-off.
- Future Roadmap: global benchmark features — logged for later.

### Step 4: Code Refactoring & Verification

1. Apply code and schema edits.
2. Run `npx tsc --noEmit` and `npx prisma db push`.
3. Append session decisions to `.agent/grill-me-log.md`.
