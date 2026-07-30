# SLTSERP Project-Scoped Agent Guidelines

This document contains workspace-specific rules and instructions for coding agents operating on the SLTSERP codebase.

> **Changelog note:** Sections marked `🆕 [AUDIT-DERIVED]` were added after a full codebase audit
> (see AUDIT_REPORT.md) surfaced gaps not previously covered here — specifically around
> transactional data integrity, schema-change blast radius, and rate limiting. These sections
> do not override any existing rule below unless explicitly stated (see the caching note under
> Next.js Route Caching Standards).

## 🏆 Mandatory Production-Level Coding Standards
All code additions, edits, or refactors MUST comply with strict production-level standards:
1. **API Endpoints**: Always wrap write and complex read route handlers with `apiHandler` (Zod validation, role checks, audit trail logging, unified error handling). Avoid manual `try/catch` and direct `NextResponse.json` returns.
2. **Decoupled Architecture**: No direct database access or queries (`prisma.[model]`) inside controller API routes (`route.ts`). All business logic must reside in a Service layer (`src/services/`).
3. **Database Integrity**: Never create "soft relations" (e.g. matching strings across tables with mismatched Prisma relations). Ensure all schemas are explicitly typed and linked with foreign keys.
4. **Strategic Indexing & Pagination**: Ensure any newly introduced query lookup field has an explicit `@@index` in the Prisma model. Implement server-side pagination for dynamic tables with more than 100 entries.
5. **No Caching Drift**: Declare `export const dynamic = 'force-dynamic'` in any GET API route returning dynamic database records.
6. **Strict Typing MUST Rule (Zero `any` / `unknown` Object Tolerance)**: Never use `any`, `any[]`, or generic `Record<string, unknown>` types for business logic data or APIs. Except for `catch (error: unknown)` blocks, all variables, API payloads, and return types MUST be strictly typed using explicitly defined **Interfaces**, **Zod validation schemas**, or **Prisma generated Schema types** (`@prisma/client`). Using `unknown` as a lazy fallback for object types is strictly prohibited and violates enterprise code quality standards.
   * **6.1 Missing Prisma Types**: If Prisma generated types are missing, structurally insufficient, or incorrect for a specific complex query (e.g., deeply nested includes), you MUST create a custom TypeScript Interface or Type locally rather than falling back to `any`. Never use `any` due to a "missing Prisma type".
7. **Algorithmic Efficiency (Big-O)**: Avoid $O(N^2)$ loops (e.g., nested `find` or database queries inside a loop). Utilize $O(1)$ Hash Maps, Sets, and Prisma `$transaction` batch operations to optimize time and space complexity.
8. **🆕 [AUDIT-DERIVED] Fixed-Value Fields Must Be Enums**: Never use a plain `String` type in Prisma for a field that represents a known, fixed set of values (status, priority, type, category, etc.). Always define an explicit Prisma `enum`. This prevents invalid states from being written to the database and silently breaking downstream logic (workflow engines, invoice generation, ledger posting).
9. **🆕 [AUDIT-DERIVED] Never Store Individually-Queryable Data as JSON**: If a field's contents need to be filtered, aggregated, or queried individually (e.g. a list of delay reasons, line items, attachments), it must be a proper one-to-many relation table — not a `Json` column. `Json` columns are only acceptable for genuinely opaque, non-queried blobs (e.g. raw external API payloads kept for audit purposes only).


## 💰 Financial & Transactional Data Integrity Standards 🆕 [AUDIT-DERIVED]

SLTSERP handles invoices, payments, contractor payouts, GL postings, and stock/material
deduction — all financial or quasi-financial state. The following rules are **non-negotiable**:

1. **Mandatory `$transaction()` for Multi-Table Writes**: Any operation that writes to 2+ tables
   where partial completion would leave the system in an invalid state — invoice creation/update,
   payment posting, ledger entries, contractor payout splits, stock/material deduction on service
   order completion — MUST be wrapped in `prisma.$transaction()`. Before writing any new business
   logic touching money, stock, or ledger state, the agent must explicitly ask itself: *"if this
   fails halfway, is the data still consistent?"* If not, wrap it in a transaction.
2. **Idempotency on Write Endpoints**: Payment, invoice, and payout-related mutation endpoints
   should support idempotency keys where the client may retry a request (e.g. network timeout on
   a payment POST). Do not assume retries are safe by default.
3. **STOP Rule**: If a fix or feature touches a financial/ledger/invoice write path, the agent
   MUST stop and confirm the approach with the user before applying — even if the change appears
   obviously correct. This applies regardless of which task or phase the agent is currently
   executing.
4. **No Silent Financial Failures**: `catch {}` blocks are never acceptable anywhere in the
   codebase (see Error Handling Standards below), but around financial write paths this is
   elevated from a code-quality issue to a data-integrity issue — a swallowed exception here can
   mean money or stock moved without a corresponding record.


## 🧬 Schema Change & Migration Safety Standards 🆕 [AUDIT-DERIVED]

1. **Blast-Radius Check Before Schema Changes**: Before modifying, renaming, retyping, or removing
   any Prisma field — especially converting a `String` to an `enum`, or restructuring a `Json`
   column into a relation table — the agent must first list every file in the codebase that
   reads or writes that field, and present that list to the user before making any change.
2. **Investigate Before Assuming Redundancy Is a Bug**: If a field appears redundant with data
   available via a relation (e.g. a child table storing a copy of a value that also exists on its
   parent), do NOT assume this is a mistake. Search the codebase for evidence it's an intentional
   historical snapshot (a value captured at a point in time that is meant to remain fixed even if
   the parent's value later changes). Report findings to the user before changing or removing the
   field.
3. **Explicit `onDelete` on Every Relation**: Every foreign key relation must have an explicit
   `onDelete` behavior defined — never leave it to the Prisma default. When choosing between
   `Restrict`, `SetNull`, and `Cascade` on entities with audit/traceability requirements
   (invoices, service orders, ledger entries), default to `Restrict` unless the user confirms
   otherwise — silently orphaning or cascading financial records is higher-risk than blocking a
   delete.
4. **Data Migrations Before Column Drops**: When restructuring a `Json` column into a relation
   table, write and show the user the data-migration script that moves existing JSON data into
   the new table. Do not drop the old column until the user has confirmed the migration ran
   correctly in a dev environment.
5. **Local Dev Only, Never Auto-Apply**: Any schema change is generated via
   `npx prisma migrate dev --name <descriptive_name>` against the local dev database only. Never
   run a migration automatically against a shared or production database.


## 🛡️ Auth, Rate Limiting & Dependency Standards 🆕 [AUDIT-DERIVED]

1. **Rate Limiting on Public & Auth Endpoints**: Every authentication endpoint (login, password
   reset, OTP/verification) and any other public-facing endpoint must have rate limiting applied.
   Check for existing rate-limit middleware in the project before introducing a new library.
2. **No Blind Bulk Dependency Upgrades**: When updating `package.json` dependencies, never bulk-
   upgrade multiple major versions at once. List current vs. latest version and any breaking
   changes from the changelog first, then upgrade one package at a time, running the full test
   suite (`npx tsc --noEmit` + `npm test` / `npx playwright test`) between each.
3. **Secrets Handling**: Never hardcode secrets, API keys, or credentials in source. Confirm
   `.env*` files are covered by `.gitignore` before committing.


## 🧯 Error Handling Standards 🆕 [AUDIT-DERIVED]

1. **No Empty Catch Blocks**: `catch (error) {}` is never acceptable anywhere in the codebase —
   client components, services, or route handlers. At minimum: log the error (or route it through
   the project's audit/logging layer via `apiHandler` where applicable) and either re-throw,
   return a safe fallback, or surface user-facing feedback (toast/UI state).
2. **Safe JSON Parsing**: Never call `JSON.parse()` directly on data sourced from the database or
   external input without a try/catch and a safe fallback default. Prefer a shared utility (e.g.
   `utils/safeJsonParse.ts`) over inline parsing.
3. **Typed Catches**: Per the Zero `any` Type Tolerance rule above, all catch blocks must use
   `catch (error: unknown)` with `error instanceof Error` narrowing — never `catch (error: any)`.
4. **No Redundant Try/Catch (MUST RULE)**: Never place `try/catch` blocks inside API Route handlers wrapped with `apiHandler`. The `apiHandler` wrapper automatically catches, logs, and formats all unhandled errors (including Zod validation and Prisma errors) into a standardized `{ success: false, error: ... }` response. Redundant `try/catch` blocks create messy code and silent failures. Only use `try/catch` for third-party network calls, rolling back manual transactions, or recovering from expected non-fatal errors.


## 🗺️ GIS Map Integration & OpenLayers Sizing Standards

To prevent the OpenLayers GIS map container from collapsing or rendering as a blank white space, all GIS/QGIS map enhancements must strictly follow these rules:

### 1. Explicit Sizing & Layout Constraints
* **Explicit Heights**: OpenLayers requires target divs to have defined heights. Never rely on dynamic Tailwind classes like `h-full` without an explicit parent pixel-height.
* **Style Spec**: The map target `div` must be initialized with inline styles specifying:
  ```tsx
  style={{ width: '100%', height, minHeight: '300px', display: 'block', position: 'relative' }}
  ```

### 2. Auto-Resizing with ResizeObserver
* Since the SLTSERP dashboard uses a collapsible sidebar and flexible layouts, the map dimensions can change dynamically.
* **Mandatory Observer Hook**: Always register a `ResizeObserver` inside a `useEffect` that listens to target div mutations and calls `map.updateSize()` immediately to refresh canvas tiles:
  ```typescript
  useEffect(() => {
    if (!mapRef.current || !mapContainerRef.current) return;
    const map = mapRef.current;
    const observer = new ResizeObserver(() => {
      map.updateSize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [mapReady]);
  ```

### 3. Deferred Geometry Fitting (`fitExtent`)
* When rendering new imported GeoJSON coordinates and zooming to extents using `map.getView().fit(...)`, the call **must be deferred** by at least 100ms using a `setTimeout` to allow the browser DOM styles to settle:
  ```typescript
  setTimeout(() => {
    map.getView().fit(overallExtent, { padding: [60, 60, 60, 60], maxZoom: 17, duration: 800 });
    map.updateSize();
  }, 100);
  ```

### 4. Type Safety & MapBrowserEvent Constraints
* OpenLayers events must use `PointerEvent | KeyboardEvent | WheelEvent` (or standard `PointerEvent`) as generic constraints on the `MapBrowserEvent` declaration. **Do not use `UIEvent`**, as it violates OpenLayers type constraints.
  ```typescript
  const handleClick = (evt: import('ol/MapBrowserEvent').default<PointerEvent | KeyboardEvent | WheelEvent>) => { ... }
  ```
* Always typecast features returned from pixel queries to standard `Feature` objects before invoking methods like `.setStyle()` to prevent typescript compilation errors on `FeatureLike`:
  ```typescript
  const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f) as Feature | undefined;
  ```

### 5. Render Loop State Rule
* **No Refs in JSX**: Never read `.current` properties of React `useRef` directly during JSX rendering (e.g. `lastSegmentDistanceRef.current`). Synchronize all computed values to React state hooks inside event handlers, and render from states instead.


## ⚡ Next.js Route Caching & State Refresh Standards

To ensure that UI data tables and dashboards refresh instantly after a resource is deleted, updated, or created, follow these rules:

### 1. Force Dynamic GET Routes
* All Next.js API GET routes that list entities (e.g., `/api/projects`, `/api/gis`) must disable Route Handler static caching by exporting `dynamic = 'force-dynamic'`:
  ```typescript
  export const dynamic = 'force-dynamic';
  ```
> **🆕 Note:** This rule is intentional project policy and takes precedence over generic
> performance advice (e.g. "use ISR/`revalidate` for static-ish GET routes"). Any future audit
> or agent suggesting `revalidate` instead of `force-dynamic` should be rejected unless the user
> explicitly changes this policy.

### 2. Client-Side Cache Busting & Headers
* When performing fetch calls to retrieve lists of items (especially when reloading after mutations like delete), always append a timestamp parameter (e.g., `_t=${Date.now()}`) to the URL and configure headers/cache options:
  ```typescript
  const res = await fetch(`/api/projects?status=COMPLETED&_t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    }
  });
  ```

### 3. Optimistic Client State Management
* For better UX, always perform optimistic UI state updates (e.g., filter out a deleted item from the local array state immediately inside the `onDelete` success callback) before invoking the background reload fetch:
  ```typescript
  setExistingProjects((prev) => prev.filter((p) => p.id !== deletedId));
  ```


## 📉 Database Egress & Bandwidth Optimization Standards

To prevent high outbound data transfer costs and performance lag between Next.js APIs and the PostgreSQL database:

### 1. Targeted Database Selects (Prevent Egress Regress)
* **Never use broad `include` blocks** on models containing heavy JSON, metadata, history log, or blob columns (e.g. `ServiceOrder`, `ExtensionRawData`, `AuditLog`, `SODForensicAudit`).
* Always define explicit `select` fields picking only the columns consumed by the consumer:
  ```typescript
  // ✅ DO: Selective fetching
  const orders = await prisma.serviceOrder.findMany({
      select: {
          id: true,
          rtom: true,
          sltsStatus: true
      }
  });
  ```

### 2. DTO (Data Transfer Object) Pattern
* Cleanse database response objects in the Service layer before sending them down route handler controller responses. Only serialize and return the specific fields requested by client components to reduce browser network payload sizes.

### 3. Early and Active Pagination
* Server-side pagination is mandatory for all listing data services returning records potentially exceeding 100 entries. Implement cursor-based pagination (for infinite scrolls) or offset pagination (for indexed tables) early in development.


## 🗺️ Codebase Map & Token Optimization Standards

To keep context windows clean and save tokens, agents must use the codebase structural map file:

### 1. Consult the Map First
* Before performing broad workspace search queries or reading entire target directories, search the map file `.agent/CODEMAP.md` to locate classes, service methods, API routes, or database models.
* **CRITICAL TOKEN WARNING**: Never use `view_file` to read the entire `.agent/CODEMAP.md` file, as it is very large and will exhaust the context limit.
* Instead, always use `grep_search` to find the line numbers of the desired class/method/model in `.agent/CODEMAP.md`, then load only a small range of lines around it (e.g. using `StartLine` and `EndLine` in `view_file`).

### 2. Keep the Map Synced
* Whenever you modify files that alter method signatures, class exports, API routes, or Prisma schemas, you **MUST** run the updater command:
  ```bash
  npm run codemap:update
  ```
* Ensure this command runs successfully and commits any updates to `.agent/CODEMAP.md` along with your code changes.


## ⚛️ React Hydration Mismatch & Suspense Safety Standards

To prevent Next.js hydration errors (`Text content does not match server-rendered HTML` / `- Client vs + Server mismatch`):

### 1. Client-Side Auth & Storage Guards (`RoleGuard`)
* Components that check `localStorage` or `typeof window !== 'undefined'` MUST render `<>{children}</>` during SSR and initial client hydration (`!mounted`).
* Never render completely different top-level layout wrappers (e.g. `<div className="bg-slate-50">` vs `<div className="flex h-screen">`) before `mounted` becomes `true`.

### 2. Isolated `useSearchParams` Suspense Boundaries
* Never invoke `useSearchParams()` directly inside top-level layout components (like `Sidebar` or `Header`).
* Always isolate `useSearchParams()` calls inside dedicated child watcher components wrapped in `<Suspense fallback={null}>`, ensuring the parent layout component never suspends or unmounts during SSR or route transitions.


## 🖼️ Standard Page Layout & Sidebar Navigation Standards

To ensure every newly created dashboard page includes the global navigation Sidebar, top Header bar, and Role Security Guard:

1. **Mandatory Page Layout Wrapping**:
   * Every page (`page.tsx`) under `src/app/` (except public endpoints like `/login` or `/public/invoices/...`) MUST wrap its main content inside `<RoleGuard>`, `<Sidebar />`, and `<Header />`:
   ```tsx
   <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']}>
       <div className="flex h-screen bg-slate-50 overflow-hidden">
           <Sidebar />
           <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
               <Header />
               <main className="flex-1 overflow-y-auto">
                   {/* Page Content */}
               </main>
           </div>
       </div>
   </RoleGuard>
   ```

2. **Mandatory Sidebar Menu Registration**:
   * Whenever a new route page is created (e.g., `/sf-audit/payment-split-config`), its path, title, icon, and `allowedRoles` MUST be explicitly added to the `SIDEBAR_MENU` array in `src/config/sidebar-menu.ts` so users can navigate to it directly.


## 🤖 Upgraded Enterprise Multi-Role Grill-Me Standard (`/grill-me`)

To ensure maximum production quality, deep technical depth, and global industry competitiveness, whenever `/grill-me` or major design planning is executed, the agent MUST evaluate the architecture using the following **Upgraded 5-Perspective Expert Panel**.

**CRITICAL RULES FOR /GRILL-ME:**
- **Go Beyond the Prompt (Proactive Innovation):** Do not just answer what the user asked. Proactively suggest missing enterprise-grade features (e.g., Maker-Checker approval flows, Idempotency keys, audit webhooks, scalable architectures) that the user may not have thought of.
- **Global Industry Benchmarking:** Actively compare the proposed design with top-tier global platforms (e.g., SAP, Oracle ERP, Salesforce, ServiceNow). Identify what features those platforms have for this specific module and recommend adopting them in SLTSERP.
- **Zero Hallucination & Concrete Tech:** Never suggest fluffy buzzwords. Every suggestion must be technically feasible within the existing Next.js + Prisma + PostgreSQL stack. Provide concrete DB schema changes or algorithmic patterns.

### The 5-Perspective Expert Panel:

1. **👨💻 Lead Architect & Senior Full-Stack Developer**:
   - Algorithmic efficiency ($O(1)$ HashMaps, $O(N)$ batch transactions) and Zero `any` types.
   - Idempotency, decoupling API routes (`src/services/`), and dynamic caching guards.
   - **Global Benchmark**: How do modern microservice architectures handle this? (e.g. Event-driven vs REST).

2. **🧪 QA Lead & Security Auditor**:
   - Edge cases, failure recovery, race conditions, and input validation (Zod).
   - RBAC (`RoleGuard`), role permissions, and immutable audit logging (SHA-256 checksums).
   - **Global Benchmark**: How do banking/ERP systems secure this data? (e.g. Maker-Checker dual approvals).

3. **👔 OSP & Enterprise Domain SME**:
   - Field operations accuracy (MIN/MRN Store Issue Notes, OSP calculations, PAT acceptance).
   - Contractor payment splits, retention, and GL posting consistency.
   - **Global Benchmark**: How do top-tier Field Service Management (FSM) tools like ServiceNow or Salesforce Field Service handle this workflow?

4. **📊 Chief Financial Officer (CFO)**:
   - Revenue recognition (GAAP/IFRS unbilled WIP receivables vs deferred revenue).
   - Full job costing (Revenue - Payout - COGS - Logistics - Payroll).
   - **Global Benchmark**: How does SAP or Oracle Financials structure these ledger entries?

5. **⚡ Performance & DevOps Engineer**:
   - Zero database egress regress (selective Prisma `select` blocks).
   - Next.js client-side cache busting and connection pooling limits.
   - **Global Benchmark**: How to handle high-concurrency spikes without bringing down the PostgreSQL DB?

* **Automated Recommended Defaults**: Adopt AI-recommended options validated by the Panel without redundant single-question prompts, unless the user explicitly requests an interactive Q&A.
* **Consolidated Multi-Role Review Table**: Present all adopted decisions categorized across all 5 Expert viewpoints in a single structured table for instant 1-click user review.

6. **Tiered Recommendation Output (Must / Should / Future)**:
   - Every suggestion from the panel must be tagged:
     - 🔴 **Must-Have** — blocks correctness, security, or data integrity (safe to auto-adopt).
     - 🟡 **Should-Have** — meaningfully improves the module but is not blocking; requires 
       explicit user approval before being added to any execution plan.
     - 🔵 **Future Roadmap** — global-benchmark-inspired ideas (SAP/Oracle/ServiceNow-style 
       features) that are valuable but out of scope for now; logged for later, never 
       auto-adopted.
   - "Automated Recommended Defaults" (above) applies ONLY to 🔴 Must-Have items.

7. **Cost/Complexity Counterpoint Required**:
   - For every suggestion, the panel must also state the implementation cost/complexity and 
     any downside (e.g. added latency, more tables to maintain, more edge cases) — not just the 
     benefit. A one-sided "adopt this" recommendation without a stated trade-off is incomplete.

8. **Cross-Check Against Existing Safety Rules**:
   - Any suggestion touching the database schema must be flagged against the Schema Change & 
     Migration Safety Standards (blast-radius check required before implementation).
   - Any suggestion touching money, ledger, payments, or stock must be flagged against the 
     Financial & Transactional Data Integrity Standards (STOP rule — needs user confirmation, 
     `$transaction()` required).
   - The grill-me output itself does not bypass these rules — it only plans; execution still 
     goes through them.

9. **Grill-Me Session Log**:
   - Each `/grill-me` session's Consolidated Review Table must be appended to 
     `.agent/grill-me-log.md` (module name, date, decisions adopted/deferred/rejected) so past 
     sessions aren't silently re-litigated and institutional decisions are traceable.

10. **Handoff to `/goal`**:
    - When a grill-me output is later executed via `/goal`, only 🔴 Must-Have and explicitly 
      user-approved 🟡 Should-Have items become part of that goal's Definition of Done checklist. 
      🔵 Future Roadmap items must never be silently pulled into an unrelated goal's execution.


## 🚀 Upgraded Autonomous Goal & Long-Running Task Standard (`/goal`)

To ensure maximum agent autonomy, flawless execution, and enterprise-grade output during long-running background tasks, the agent MUST follow these strict rules:

1. **Unstoppable Autonomous Execution (Zero Hand-Holding)**:
   - The agent MUST execute continuously, resolving all obstacles, writing code, fixing lints, and running tests until the user's objective is **100% achieved**.
   - NEVER stop midway, NEVER output placeholders (e.g. `// add logic here`), and NEVER pause for trivial user confirmation when an obvious technical path exists. If you hit an error, read the logs, fix the code, and try again autonomously.
   - **🆕 Exception**: This "unstoppable" rule does NOT override the STOP Rule under Financial &
     Transactional Data Integrity Standards, or the Blast-Radius Check under Schema Change Safety
     Standards. Autonomy applies to fixing bugs, lints, and tests — not to unilaterally deciding
     schema changes or financial-write-path changes without user sign-off.

2. **Strict Empirical Verification Mandate**:
   - Never declare a goal complete without running concrete verification commands (`npx tsc --noEmit`, dev server builds, or browser subagent checks).
   - If a type error or runtime failure occurs, you MUST fix the root cause and re-run verification until exactly 0 errors are achieved.

3. **Enterprise Aesthetics & UX Enforcement**:
   - For any UI changes, you MUST enforce "Rich Aesthetics" (modern typography, micro-animations, correct Shadcn UI usage, Tailwind layouts).
   - Never deliver a "basic" or "MVP" looking UI. The final output must look premium and match global SaaS standards.

4. **Multi-Role Quality Enforcement**:
   - Apply the **Upgraded 5-Perspective Expert Panel** checks to every feature created or modified during the goal execution. Do not compromise on architecture for speed.

5. **Codemap & Audit Trail Synchronization**:
   - Run `npm run codemap:update` whenever method signatures or APIs change, ensuring `.agent/CODEMAP.md` is always up to date.

6. **Consolidated Executive Completion Summary**:
   - Upon completing the goal, provide a single, comprehensive markdown summary detailing:
     - 🎯 Goal Accomplishments (with technical depth)
     - 📁 Files Modified / Created
     - 🧪 Verification Command Outputs (`npx tsc --noEmit` exit code 0)
     - 📊 Updated Business & Technical State

7. **Scope Boundary Lock**:
   - Before starting autonomous execution, the agent MUST restate the goal in its own words 
     and list the explicit boundaries — which files/modules are in scope and which are NOT.
   - If mid-execution the agent discovers work that falls outside this stated scope (e.g. an 
     unrelated bug, a missing feature in another module), it must log it under a 
     "Discovered But Out Of Scope" list in the final summary — NOT silently fix it, and NOT 
     silently skip it without mentioning it.

8. **Checkpoint & Resumability**:
   - For any goal expected to span multiple files or a long execution, the agent must maintain 
     a running checkpoint file (e.g. `.agent/goal-progress.md`) listing: tasks completed, tasks 
     remaining, last verified state (tsc/test pass/fail), and any blockers.
   - If execution is interrupted, the next session MUST read this checkpoint file first before 
     resuming, rather than re-scanning the whole codebase from scratch.

9. **Git Commit Discipline**:
   - Commit in small, logical, revertable units — one concern per commit (e.g. "add rate 
     limiting to auth routes" not "goal execution part 3").
   - Never commit with a failing `npx tsc --noEmit` or failing test suite.
   - Never force-push or rewrite shared branch history autonomously.

10. **Explicit Definition of Done**:
    - Before execution starts, the agent must write a numbered checklist of concrete, testable 
      completion criteria derived from the goal (not just "looks done"). 
    - The Consolidated Executive Completion Summary must check off each item against this 
      original checklist — if something can't be checked off, it must be explicitly listed as 
      incomplete, not silently omitted.

11. **Safe Rollback on Critical Failure**:
    - If autonomous execution causes a state where `npx tsc --noEmit` cannot be brought back to 
      0 errors after 3 genuine fix attempts, OR a financial/schema change (per existing 
      Financial Integrity / Schema Safety rules) produces unexpected data inconsistency, the 
      agent MUST stop, revert the specific change via git, and report the failure with root 
      cause analysis — rather than continuing to autonomously patch around it.

12. **Token/Time Budget Awareness**:
    - For very large goals, the agent should periodically estimate remaining scope vs. context 
      budget. If it's clear the goal cannot be completed in the current session, it must save 
      progress to the checkpoint file (Rule 8) and clearly tell the user how much is left, 
      rather than rushing the remainder with lower quality.

## ?? Strict Type Generation Standard
1. **Zero ny Workaround Tolerance**: The use of ny or unknown as a lazy fallback is strictly prohibited. If a specific Prisma generated type (e.g. Prisma.UserGetPayload<{...}>) or a custom interface (e.g. DTO) is missing, the agent MUST explicitly create it or import it from @prisma/client.
2. **Proactive Type Creation**: Never suppress type errors with @typescript-eslint/no-explicit-any. Instead, stop and define the exact interface required for the payload. If you encounter a complex Prisma relation, use Prisma's Prisma.PromiseReturnType<typeof function> or Prisma.ModelGetPayload utility types to dynamically infer the shape.
