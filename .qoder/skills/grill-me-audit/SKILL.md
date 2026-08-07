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

### Step 2.5: Runtime Verification (MANDATORY before reporting findings)

Before presenting findings as real issues, verify each finding against the running dev server:

1. Start dev server (`npm run dev`) if not already running
2. For each finding from Step 2, construct a test case:
   - Security findings: attempt the attack (unauthenticated request, role bypass, etc.)
   - Edge case findings: trigger the edge case (empty array, null value, etc.)
   - Race condition findings: assess if the window is practically exploitable
3. Classify each finding:
   - **CONFIRMED**: Reproduced the issue via HTTP request or code path
   - **FALSE POSITIVE**: Safeguard exists elsewhere (middleware, JWT contract, etc.) that prevents the issue
   - **THEORETICAL**: Cannot occur in practice due to system design
4. Only CONFIRMED findings proceed to Step 3 (Fix Matrix)
5. FALSE POSITIVE and THEORETICAL findings are logged but NOT presented as actionable issues

This step prevents reporting "issues" that are actually prevented by other layers of the system (middleware auth, JWT structure, apiHandler validation, etc.).

### Step 3: Consolidated QA Fix Matrix

Present a unified review table with categorized fixes (ONLY for CONFIRMED findings from Step 2.5):

- Must-Have: blocks correctness, security, or data integrity — auto-adopted.
- Should-Have: improves architecture — requires user sign-off.
- Future Roadmap: global benchmark features — logged for later.

### Step 3.5: Holistic Fix Planning (MANDATORY before ANY edit)

Repeated audit rounds happen when fixes are applied per-finding without
thinking through the whole picture. Before touching code, complete ALL of
the following for every Must-Have / approved Should-Have fix:

**A. Blast-Radius Trace**
- Shared/infra code (`api-handler`, `middleware`, `session-validator`,
  `server-utils`, `prisma` singleton, role configs): grep for ALL callers
  and list every affected route/service BEFORE editing.
- Schema changes: list every service, route, and script touching the model.
- Rule: no edit until the complete call-site list exists in the working notes.

**B. Adversarial Edge-Case Checklist (apply to each fix)**
Ask for every value involved:
- Can it be `null` / `undefined`? (deleted users, missing IDs, system actors)
- Can a collection be EMPTY? (`roles: []`, empty arrays/maps must not bypass logic)
- Can input be LEGACY? (old tokens without new claims, pre-migration rows)
- Boundary values, type coercion, malformed URLs/payloads?
- Concurrent execution / race conditions?

**C. Fix-Impact Review**
For each proposed change answer explicitly:
1. What NEW attack surface does this fix itself create?
2. What existing behavior relied on the OLD behavior? (breaking a
   legitimate flow is a bug, not a fix)
3. Which tests, seeds, workers, or cron jobs could break?

**D. One-Shot Change Plan**
- Produce the full list of files + edits covering the ENTIRE finding family
  (e.g. all routes with the same bug pattern, not just the one found) BEFORE
  the first edit.
- Fixes applied in multiple rounds for the same issue class are a protocol
  failure — plan once, apply once, verify once.

### Step 4: Code Refactoring & Verification

1. Apply code and schema edits exactly per the Step 3.5 plan.
2. Static check: run `npx tsc --noEmit` (and `npx prisma db push` for schema changes).
3. Runtime verification is MANDATORY for behavior changes (guards, status
   codes, validation, auth flows) — tsc cannot catch wrong HTTP status codes
   or bypassed guards. Hit the affected endpoints against the dev server
   (positive + negative + edge cases from Step 3.5B).
4. Re-run any relevant scanner/lint (e.g. `node scripts/audit-rbac-routes.js`).
5. Append session decisions to `.agent/grill-me-log.md` including the
   Step 3.5 blast-radius and edge-case notes.
