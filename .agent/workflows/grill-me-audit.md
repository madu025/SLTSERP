---
description: Upgraded 5-QA Auditor Line-by-Line Code Review Protocol for automated & manual QA test perfection.
---

# 🕵️‍♂️ `/grill-me audit` - 5-QA Auditor Line-by-Line Code Review Protocol

Use this workflow whenever the user runs `/grill-me audit` or requests a multi-role QA code audit.

## 🎯 Purpose
To rigorously cross-examine, challenge, debate, and upgrade target code or database schemas using **5 Specialized QA Expert Auditors** line-by-line, ensuring zero bugs, zero type errors, maximum security, optimal performance, and 100% QA test clearance.

---

## 👥 The 5 Specialized QA Auditor Personas

1. **🛡️ QA Auditor 1: Data Integrity & Schema Enforcement Auditor**
   - **Enforces**: Native PostgreSQL `UUID v7` (`@db.Uuid`), `Decimal(14,2)` monetary precision, 3NF foreign key integrity, Prisma `Enum` state machines, and zero invalid database states.

2. **🔒 QA Auditor 2: Security & RBAC Penetration Auditor**
   - **Enforces**: `apiHandler` Zod input validation, `RoleGuard` RBAC enforcement, SQL injection immunity, zero hardcoded secrets, and RLS / JWT security.

3. **⚡ QA Auditor 3: Big-O Performance & Egress Auditor**
   - **Enforces**: $O(1)$ HashMaps, $O(N)$ batch transactions, zero database egress regress (selective `select` blocks), and force-dynamic caching standards.

4. **🧪 QA Auditor 4: Failover, Edge Case & Idempotency Auditor**
   - **Enforces**: Zero silent `try/catch` blocks, idempotency key checks on mutations, race condition prevention, and strict TypeScript types (zero `any`).

5. **💼 QA Auditor 5: Enterprise Domain & Audit Ledger Auditor**
   - **Enforces**: MIN/MRN store issue notes, immutable `InventoryLedger` SHA-256 checksums, full job costing, and GAAP/IFRS revenue recognition rules.

---

## 💬 Mandatory Execution Workflow

### Step 1: Identify Target Code / Module
Search the codebase map (`grep_search` on `.agent/CODEMAP.md` or targeted files) and view the code line-by-line.

### Step 2: 5-QA Auditor Line-by-Line Debate
Run a structured debate where all 5 QA Auditors cross-examine the target code line-by-line and state their critiques:
- **Auditor 1**: Identifies DB data type / 3NF FK flaws.
- **Auditor 2**: Identifies security / Zod / Role permission vulnerabilities.
- **Auditor 3**: Identifies performance / over-fetching / N+1 bottlenecks.
- **Auditor 4**: Identifies edge cases / missing error handling / `any` types.
- **Auditor 5**: Identifies domain ledger / MIN audit compliance gaps.

### Step 3: Consolidated QA Fix Matrix
Present a unified review table with categorized fixes:
- 🔴 **Must-Have** (Blocks correctness, security, or data integrity - auto-adopted)
- 🟡 **Should-Have** (Improves architecture - requires user sign-off)
- 🔵 **Future Roadmap** (Global benchmark features - logged for later)

### Step 4: Code Refactoring & Verification
1. Apply code and schema edits.
2. Run `npx tsc --noEmit` and `npx prisma db push`.
3. Append session decisions to `.agent/grill-me-log.md`.
