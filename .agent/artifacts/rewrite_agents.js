const fs = require('fs');
const path = require('path');

const agentsPath = path.join(__dirname, '..', 'AGENTS.md');
let content = fs.readFileSync(agentsPath, 'utf8');

const cleanHeader = `# SLTSERP Project-Scoped Agent Guidelines

This document contains workspace-specific rules and instructions for coding agents operating on the SLTSERP codebase.

> **Changelog note:** Sections marked \`🆕 [AUDIT-DERIVED]\` were added after a full codebase audit
> (see AUDIT_REPORT.md) surfaced gaps not previously covered here — specifically around
> transactional data integrity, schema-change blast radius, and rate limiting. These sections
> do not override any existing rule below unless explicitly stated (see the caching note under
> Next.js Route Caching Standards).

## 🏆 Mandatory Production-Level Coding Standards
All code additions, edits, or refactors MUST comply with strict production-level standards:
1. **API Endpoints**: Always wrap write and complex read route handlers with \`apiHandler\` (Zod validation, role checks, audit trail logging, unified error handling). Avoid manual \`try/catch\` and direct \`NextResponse.json\` returns.
2. **Decoupled Architecture**: No direct database access or queries (\`prisma.[model]\`) inside controller API routes (\`route.ts\`). All business logic must reside in a Service layer (\`src/services/\`).
3. **Database Integrity**: Never create "soft relations" (e.g. matching strings across tables with mismatched Prisma relations). Ensure all schemas are explicitly typed and linked with foreign keys.
4. **Strategic Indexing & Pagination**: Ensure any newly introduced query lookup field has an explicit \`@@index\` in the Prisma model. Implement server-side pagination for dynamic tables with more than 100 entries.
5. **No Caching Drift**: Declare \`export const dynamic = 'force-dynamic'\` in any GET API route returning dynamic database records.
6. **Strict Typing MUST Rule (Zero \`any\` / \`unknown\` Object Tolerance)**: Never use \`any\`, \`any[]\`, or generic \`Record<string, unknown>\` types for business logic data or APIs. Except for \`catch (error: unknown)\` blocks, all variables, API payloads, and return types MUST be strictly typed using explicitly defined **Interfaces**, **Zod validation schemas**, or **Prisma generated Schema types** (\`@prisma/client\`). Using \`unknown\` as a lazy fallback for object types is strictly prohibited and violates enterprise code quality standards.
   * **6.1 Missing Prisma Types**: If Prisma generated types are missing, structurally insufficient, or incorrect for a specific complex query (e.g., deeply nested includes), you MUST create a custom TypeScript Interface or Type locally rather than falling back to \`any\`. Never use \`any\` due to a "missing Prisma type".
7. **Algorithmic Efficiency (Big-O)**: Avoid $O(N^2)$ loops (e.g., nested \`find\` or database queries inside a loop). Utilize $O(1)$ Hash Maps, Sets, and Prisma \`$transaction\` batch operations to optimize time and space complexity.
8. **🆕 [AUDIT-DERIVED] Fixed-Value Fields Must Be Enums**: Never use a plain \`String\` type in Prisma for a field that represents a known, fixed set of values (status, priority, type, category, etc.). Always define an explicit Prisma \`enum\`. This prevents invalid states from being written to the database and silently breaking downstream logic (workflow engines, invoice generation, ledger posting).
9. **🆕 [AUDIT-DERIVED] Never Store Individually-Queryable Data as JSON**: If a field's contents need to be filtered, aggregated, or queried individually (e.g. a list of delay reasons, line items, attachments), it must be a proper one-to-many relation table — not a \`Json\` column. \`Json\` columns are only acceptable for genuinely opaque, non-queried blobs (e.g. raw external API payloads kept for audit purposes only).
10. **🆕 [AUDIT-DERIVED] Strict Database ID & Primary Key Strategy**: Never use a plain \`String @id @default(cuid())\` blindly for new database models. For high-volume transaction or lookup tables, prefer native PostgreSQL \`UUID v7\` (\`@db.Uuid\`) or \`BigInt @id @default(autoincrement())\` for minimal storage size (4-16 bytes vs 25-byte text) and maximum B-Tree index cache performance. For auditable business documents (Invoices, MIN, GRN, MRN, Service Orders), decouple internal surrogate primary keys (\`id\`) from human-readable business sequence codes (\`MIN-YYYY-MM-XXXX\`, \`INV-YYYY-XXXX\`) backed by \`@unique\` indexes.
11. **🆕 [AUDIT-DERIVED] Explicit Currency & Numeric Precision**: Never use \`Float\` or plain \`String\` types in Prisma for monetary amounts, financial ledgers, unit costs, revenue, or material quantities. Always use PostgreSQL \`Decimal(14, 2)\` or \`Decimal(15, 4)\` (\`@db.Decimal(14,2)\`) to eliminate IEEE 754 floating-point rounding errors.


## 💰 Financial & Transactional Data Integrity Standards 🆕 [AUDIT-DERIVED]

SLTSERP handles invoices, payments, contractor payouts, GL postings, and stock/material
deduction — all financial or quasi-financial state. The following rules are **non-negotiable**:

1. **Mandatory \`$transaction()\` for Multi-Table Writes**: Any operation that writes to 2+ tables
   where partial completion would leave the system in an invalid state — invoice creation/update,
   payment posting, ledger entries, contractor payout splits, stock/material deduction on service
   order completion — MUST be wrapped in \`prisma.$transaction()\`. Before writing any new business
   logic touching money, stock, or ledger state, the agent must explicitly ask itself: *"if this
   fails halfway, is the data still consistent?"* If not, wrap it in a transaction.
2. **Idempotency on Write Endpoints**: Payment, invoice, and payout-related mutation endpoints
   should support idempotency keys where the client may retry a request (e.g. network timeout on
   a payment POST). Do not assume retries are safe by default.
3. **STOP Rule**: If a fix or feature touches a financial/ledger/invoice write path, the agent
   MUST stop and confirm the approach with the user before applying — even if the change appears
   obviously correct. This applies regardless of which task or phase the agent is currently
   executing.
4. **No Silent Financial Failures**: \`catch {}\` blocks are never acceptable anywhere in the
   codebase (see Error Handling Standards below), but around financial write paths this is
   elevated from a code-quality issue to a data-integrity issue — a swallowed exception here can
   mean money or stock moved without a corresponding record.

`;

const splitMarker = '## 🧬 Schema Change & Migration Safety Standards';
const parts = content.split(splitMarker);
if (parts.length >= 2) {
  const newContent = cleanHeader + splitMarker + parts[1];
  fs.writeFileSync(agentsPath, newContent, 'utf8');
  console.log('Successfully re-wrote AGENTS.md cleanly.');
} else {
  console.error('Could not find split marker');
}
