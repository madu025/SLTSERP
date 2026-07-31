# Grill-Me Session Log — Production Build Readiness Audit

**Date**: 2026-07-28  
**Scope**: Final Production Build Readiness & Quality Audit across SLTSERP

## Consolidated 5-Perspective Review Table

| # | Tier | Item Description | Expert Role | Global Benchmark | Implementation Cost / Downside | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 🔴 **Must-Have** | Wrap remaining raw API routes (`sod-auto-complete`, `gis/upload`, `contracts/slt/ai-parse`) with `apiHandler` | 👨💻 Architect | SAP BTP / ServiceNow unified API gateway | Low (~15 mins). No downside. | **Auto-Adopted** |
| **2** | 🔴 **Must-Have** | Enforce Maker-Checker dual approvals on high-value invoice approvals (> LKR 1M) | 🧪 QA & Security | Oracle Financials / Banking Segregation of Duties | Low (~20 mins). Adds 1 extra approval step for >1M invoices. | **Auto-Adopted** |
| **3** | 🔴 **Must-Have** | Enforce explicit MIN/MRN Issue Note numbers & SHA-256 checksum ledger tracking | 👔 OSP Domain SME | Salesforce Field Service Management (FSM) | Low. No downside. | **Auto-Adopted** |
| **4** | 🔴 **Must-Have** | Verify `force-dynamic` dynamic caching guards & clean `tsc` / `prisma validate` | ⚡ DevOps Eng. | Next.js High-Availability Production standard | Low. No downside. | **Auto-Adopted** |
| **5** | 🟡 **Should-Have** | Rate limiting middleware on public/auth endpoints | 🧪 QA & Security | Cloudflare / AWS WAF standard | Medium (~30 mins). Adds Redis/In-memory counter overhead. | **Pending User Approval** |
| **6** | 🟡 **Should-Have** | Selective Prisma `select` blocks on heavy JSON blob tables | ⚡ DevOps Eng. | SAP HANA Egress Optimization | Medium (~45 mins). Requires explicit type mapping. | **Pending User Approval** |
| **7** | 🔵 **Future Roadmap** | Automated multi-tier retention release schedule linked to DLP milestones | 📊 CFO | SAP S/4HANA Contract Liabilities | High (~3-5 days). Out of scope for initial release. | **Logged for Future** |

---

## Grill-Me Session Log — Full-Project Hardcode Audit & Automated CLI Scanner

**Date**: 2026-07-29  
**Scope**: Complete Codebase Hardcode Detection, Fallback Credential Elimination & Automated Hardcode Audit CLI (`npm run audit:hardcode`)

### Consolidated 5-Perspective Review Table

| # | Tier | Item Description | Expert Role | Global Benchmark | Implementation Cost / Downside | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 🔴 **Must-Have** | Build automated CLI Hardcode Audit Script (`scripts/audit-hardcode.ts` + `npm run audit:hardcode`) to scan `src/` for 5 key categories (credentials, localhost URLs, magic enums, hardcoded IDs, financial constants) | 👨💻 Architect & ⚡ DevOps | SonarQube / ESLint Security AST rules | Low (~30 mins). Negligible runtime overhead; runs on-demand or pre-commit. | **Auto-Adopted** |
| **2** | 🔴 **Must-Have** | Remove hardcoded fallback credentials (`'admin'`/`'admin'`) in `qfieldcloud-sync.service.ts` and require strict env variables via Zod env validator | 🧪 QA & Security | OWASP Top 10 Hardcoded Credentials Prevention | Low (~10 mins). Requires `.env` to be populated in dev. | **Auto-Adopted** |
| **3** | 🔴 **Must-Have** | Replace hardcoded `http://localhost:3000` / `8100` fallback strings in workers & services with centralized `getAppUrl()` environment helper | ⚡ DevOps Eng. | 12-Factor App Config Standard | Low (~10 mins). Prevents broken URLs in Vercel/Docker production. | **Auto-Adopted** |
| **4** | 🟡 **Should-Have** | Enforce AST-level ESLint custom rule (`no-hardcoded-strings-in-services`) in CI build pipeline | 👨💻 Architect | Enterprise Monorepo Governance | Medium (~45 mins). Slightly increases CI build lint duration (+2s). | **Pending User Approval** |
| **5** | 🔵 **Future Roadmap** | Real-time Git pre-commit hook enforcing zero-hardcode policy via Husky/lint-staged | ⚡ DevOps Eng. | GitHub Enterprise Security Shield | Medium (~1 hour). Requires local developer workstation Git hook configuration. | **Logged for Future** |

---

## Grill-Me Session Log — Contractor Portal Tri-Lingual (EN/SI/TA) & Contractor Switcher Module

**Date**: 2026-07-30  
**Scope**: Contractor Portal Tri-Lingual Internationalization (English, Sinhala, Tamil) & Multi-Tenant Contractor Switcher Architecture

### Consolidated 5-Perspective Review Table

| # | Tier | Item Description | Expert Role | Global Benchmark | Implementation Cost / Downside | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 🔴 **Must-Have** | Built-in Tri-Lingual Dictionary & i18n Context (`src/i18n/contractor-translations.ts`, `src/context/ContractorI18nContext.tsx`) with instant language toggle selector (English / සිංහල / தமிழ்) in header | 👨💻 Architect | ServiceNow Mobile Multi-Language FSM | Low (~30 mins). $O(1)$ memory lookup; 0ms latency, zero bundle bloat. | **Auto-Adopted** |
| **2** | 🔴 **Must-Have** | Dynamic Contractor Switcher Dropdown (`src/components/contractor/ContractorSwitcher.tsx`) in header for Admin/Manager roles with instant React Query cache invalidation (`['contractor-my-dashboard']`) | 👨💻 Architect & ⚡ DevOps | SAP Field Service Multi-Account Selector | Low (~25 mins). Allows admins/managers to switch contractors on the fly. | **Auto-Adopted** |
| **3** | 🔴 **Must-Have** | Tenant Isolation & RBAC Guard: Hide Contractor Switcher for regular contractor roles (`CONTRACTOR_SUPERVISOR`, `CONTRACTOR_TECHNICIAN`), enforcing strict single-tenant view | 🧪 QA & Security | OWASP Multi-Tenant Data Isolation | Low (~10 mins). Zero security downside. | **Auto-Adopted** |
| **4** | 🔴 **Must-Have** | Technical Term Preservation: Retain industry-standard telecom acronyms (SOD, ONT, FAC, MIN, MRN, RTOM, OPMC) with natural transliteration in Sinhala/Tamil | 👔 OSP Domain SME | Salesforce Field Service Localization | Low (~10 mins). Prevents field technician confusion. | **Auto-Adopted** |
| **5** | 🟡 **Should-Have** | Localized Currency & Date Formatting: Auto-format LKR currency values ("LKR 150,000" / "රු. 150,000" / "ரூ. 150,000") and dates based on active language | 📊 CFO | SAP Financials Global Locale Standard | Medium (~20 mins). Minor UI formatting logic update. | **Pending User Approval** |
| **6** | 🔵 **Future Roadmap** | Voice-Assisted SOD Status Logging in Sinhala/Tamil using Web Speech API | 👔 OSP Domain SME | ServiceNow Voice Assistant for Field Engineers | High (~2-3 days). Logged for future roadmap. | **Logged for Future** |

---

## Grill-Me Session Log — Advanced Telemetry & Observability Upgrade

**Date**: 2026-07-30  
**Scope**: Advanced System Health Monitoring, Automated Webhook Alerting, SHA-256 Tamper Audit, and Rate-Limit Telemetry

### Consolidated 5-Perspective Review Table

| # | Tier | Item Description | Expert Role | Global Benchmark | Implementation Cost / Downside | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 🔴 **Must-Have** | **Automated Webhook & Email Alert Dispatcher for Critical Errors**: Trigger instant notifications (via Webhook / Slack / Email) when critical errors (`EMAXCONNSESSION` or 500 spike >3 in 5m) occur. | 👨‍💻 Lead Architect | Datadog / PagerDuty / Sentry Alerting Rules | Low (~20 mins). Async background dispatch. | **Auto-Adopted** |
| **2** | 🔴 **Must-Have** | **Financial & Inventory Ledger SHA-256 Checksum Tamper Audit**: Add a 1-click Security Audit button on the telemetry dashboard that validates `InventoryLedger` and `SystemErrorLog` SHA-256 hashes to detect manual SQL tampering. | 🧪 QA & Security | Banking & SAP Audit Integrity Ledger | Low (~15 mins). $O(N)$ query over ledger hashes. | **Auto-Adopted** |
| **3** | 🟡 **Should-Have** | **Rate-Limiting & Brute-Force Traffic Inspector Panel**: Real-time counter of top offending IP addresses hitting 401/429 endpoints with 1-click IP temporary blocklist. | 🧪 QA & Security | Cloudflare / WAF Threat Monitoring | Medium (~30 mins). Requires IP tracking in memory/DB. | **Pending User Approval** |
| **4** | 🟡 **Should-Have** | **Contractor Portal Sync & PAT Upload Telemetry Counter**: Real-time health gauge showing contractor offline queue size and pending PAT acceptance orders across RTOMs. | 👔 OSP Domain SME | ServiceNow Field Service Health Dashboard | Medium (~20 mins). Adds background query for pending SOD sync states. | **Pending User Approval** |
| **5** | 🔵 **Future Roadmap** | **PostgreSQL Connection & Slow Query Profiler (`pg_stat_activity`)**: Real-time view of active DB client queries, locks, and query execution times >200ms. | ⚡ DevOps Eng. | SAP HANA / AWS RDS Performance Insights | High (~1-2 days). Requires Postgres superuser privileges in Supabase. | **Logged for Future** |

---

## Grill-Me Session Log — Dynamic Multi-Level Approval Workflow & Office 365 Actionable Email Engine

**Date**: 2026-07-30  
**Scope**: Dynamic Admin-Configurable Multi-Level Approval Policy Engine, Office 365 Actionable Email & Signed 1-Click Action Links, Financial Authority Matrix & Immutable Audit Trail

### Consolidated 5-Perspective Review Table

| # | Tier | Item Description | Expert Role | Global Benchmark | Implementation Cost / Downside | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | 🔴 **Must-Have** | **Office 365 Actionable Email Engine for Existing Dynamic Policy Schema (`ProcessGatePolicy`, `ProcessApprovalLevel`, `UniversalApprovalInstance`)**: Hook Office 365 email dispatch into existing dynamic approval gate policies with 0 hardcoded rules. | 👨‍💻 Lead Architect | SAP BTP Flexible Workflow / ServiceNow Flow Designer | Low (~25 mins). Hooks directly into existing `prisma/schema/dynamic-policy.prisma` models. | **Auto-Adopted** |
| **2** | 🔴 **Must-Have** | **Cryptographically Signed Single-Use Action Tokens (JWT)**: Generate 1-click Approve/Decline URLs linked to `UniversalApprovalInstance` containing signed JWT tokens with 48h expiration and atomic single-use invalidation inside `prisma.$transaction()`. | 🧪 QA & Security | OWASP Single-Use Action Token Standard | Low (~20 mins). Prevents replay attacks & duplicate approvals. | **Auto-Adopted** |
| **3** | 🔴 **Must-Have** | **Office 365 Interactive Email Engine**: Send rich HTML emails via Nodemailer/O365 SMTP featuring styled Approve/Decline buttons + Microsoft Adaptive Card support for native Outlook inline actionability. | 👔 OSP & 👨‍💻 Architect | Microsoft Outlook Actionable Messages / Workday Approval Emails | Low (~30 mins). Requires O365 SMTP credentials in `.env`. | **Auto-Adopted** |
| **4** | 🔴 **Must-Have** | **Financial Authority Matrix & Budget Commitment Hold**: Tie material/invoice approval steps to financial thresholds (e.g. <100k: Level 1, >500k: Level 3) with real-time budget hold. | 📊 CFO | SAP S/4HANA Purchase Requisition Commitments | Low (~25 mins). Ensures strict financial governance. | **Auto-Adopted** |
| **5** | 🟡 **Should-Have** | **Out-of-Office Escalation & Timeout Handler**: If an approver does not respond within 24 hours, automatically escalate to alternate delegate or send reminder. | 👔 OSP Domain SME | ServiceNow Auto-Escalation Engine | Medium (~30 mins). Runs via background cron check. | **Pending User Approval** |
| **6** | 🔵 **Future Roadmap** | **Biometric / 2FA Re-Authentication for High-Value Approvals (> LKR 1M)**: Require OTP verification or WebAuthn biometric prompt when approving high-value requisitions via Web UI. | 🧪 QA & Security | Banking Dual-Control & PCI-DSS Compliance | High (~2-3 days). Logged for future enterprise roadmap. | **Logged for Future** |



---

## Grill-Me Session Log � Dynamic State Transition (Zero-Hardcoding Workflow Engine)

**Date**: 2026-07-30  
**Scope**: Removing hardcoded state transitions from domain logic and implementing a 100% database-driven Finite State Machine (FSM) for ERP standard compliance.

### Consolidated 5-Perspective Review Table

| # | Tier | Item Description | Expert Role | Global Benchmark | Implementation Cost / Downside | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | ?? **Must-Have** | **Dynamic State Delegation (FSM Engine)**: Remove the hardcoded switch block in handleGatePassed. The ProcessGateEngine directly computes the next state from ProcessGatePolicy.toStatus and updates the parent entity via generic repository mapping. | ????? Lead Architect | SAP Business Workflow FSM | Low (~15 mins). Eliminates domain logic coupling. | **Auto-Adopted** |
| **2** | ?? **Must-Have** | **Event-Driven Side Effects**: When the engine updates the state, it publishes stock_request.status_changed. The domain service listens to this event to execute logic (e.g. deduct stock) rather than synchronous HTTP blocking. | ?? QA & Security | Event-Driven Microservices | Low (~20 mins). Improves transaction safety. | **Auto-Adopted** |
| **3** | ?? **Should-Have** | **Condition-Based Routing (JSONB)**: Add a conditions JSON column to ProcessGatePolicy to bypass approvals based on criteria (e.g. Auto-Approve if sourceType == SLT). | ?? OSP Domain SME | Salesforce Flow Decision Nodes | Medium (~30 mins). Requires DB schema change. | **Pending User Approval** |
| **4** | ?? **Should-Have** | **Immutable Cryptographic State Audit**: Log every state transition with a SHA-256 hash connecting to the General Ledger. | ?? CFO | SAP S/4HANA Ledger Audit | Medium (~20 mins). | **Pending User Approval** |
| **5** | ?? **Future Roadmap** | **Visual Workflow Builder (No-Code UI)**: Drag-and-drop React Flow interface for admins to create and link workflow nodes visually. | ? DevOps Eng. | ServiceNow Flow Designer | High (~1 week). | **Logged for Future** |

---

## Grill-Me Session Log - 100% Zero-Hardcoding Domain Side Effects (Event-Driven Pattern)

**Date**: 2026-07-30  
**Scope**: Decoupling domain logic and notification logic from the generic FSM workflow engine.

### Consolidated 5-Perspective Review Table

| # | Tier | Item Description | Expert Role | Global Benchmark | Implementation Cost / Downside | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | ?? **Must-Have** | **Policy JSON + Event Bus Decoupling**: Add olesToNotify (Json) and domainAction (String) to ProcessGatePolicy schema. The engine emits a dynamic event based on this rather than hardcoding if/else in StockRequestService. | ???? Lead Architect | SAP Event Mesh | Low (~15 mins). Need to migrate DB schema and update the generic dispatcher. | **Adopted** |
| **2** | ?? **Must-Have** | **Generic Role Notification Dispatcher**: The safeNotifyStageChange reads olesToNotify directly from the DB policy row instead of using hardcoded switch blocks to determine who to email. | ?? QA & Security | IAM Role Binding | Low (~10 mins). | **Adopted** |
| **3** | ?? **Should-Have** | **Dynamic Webhook Execution (Serverless)**: Instead of local Service Layer functions, domainAction stores an internal endpoint (e.g. /api/internal/reserve-stock) and the Engine makes an HTTP POST to it. | ?? OSP SME | ServiceNow Flow Designer Actions | Medium (~40 mins). Overkill unless deploying microservices. | **Pending User Approval** |
| **4** | ?? **Should-Have** | **Approval Policy GUI Configuration**: A React Admin dashboard to manage ProcessGatePolicy rows, allowing non-technical managers to create new workflows. | ?? CFO | Oracle Business Rules | High (~3-4 hours). Requires full CRUD screens. | **Pending User Approval** |
| **5** | ?? **Future Roadmap** | **Temporal.io / Camunda External Engine Integration**: Offload state management entirely to a specialized BPMN workflow engine. | ? DevOps Eng. | Global Enterprise Scale | Massive (Months). Logged for future. | **Logged for Future** |
---

## Grill-Me Session Log - Global Enterprise ERP Gaps (True FSM Event-Driven Architecture)

**Date**: 2026-07-30  
**Scope**: Identifying and closing missing gaps between current "Zero-Hardcoding" FSM and true Tier-1 Enterprise ERP (SAP/Oracle/ServiceNow) patterns.

### Consolidated 5-Perspective Review Table

| # | Tier | Item Description | Expert Role | Global Benchmark | Implementation Cost / Downside | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | ?? **Must-Have** | **True Pub/Sub & Saga Pattern (EventBus)**: Remove the last \if (domainAction === ...)\ from Service Layer. Emit \sm.domain_action_requested\. Services subscribe to this. If a subscriber fails (e.g. insufficient stock), the FSM state must mathematically rollback (Saga Pattern). | ???? Lead Architect / ?? QA | SAP Event Mesh & Microservice 2PC Saga | Medium (~1.5 hours). Requires creating an internal Event Bus and wrapping side-effects in try/catch rollback loops. | **Adopted** |
| **2** | ?? **Must-Have** | **BPMN-style JSON Condition Engine**: Add a \conditions\ JSON column to \ProcessGatePolicy\. E.g. \{"field": "totalValue", "operator": ">=", "value": 500000}\. Evaluated dynamically using a Rule Engine before determining the next route. | ?? OSP Domain SME | Camunda / ServiceNow Flow Designer | Medium (~1 hour). Needs DB schema update and JSON schema validation logic. | **Adopted** |
| **3** | ?? **Must-Have** | **Idempotency & Event Deduplication**: Store processed \UniversalApprovalInstance\ IDs or Domain Action hashes in an \IdempotencyLog\ table. Prevents double-stock deduction if an API retries. | ?? CFO | Stripe / Oracle Financials API Standards | Low (~30 mins). Simple DB table and check wrapper. | **Adopted** |
| **4** | ?? **Should-Have** | **Asynchronous Background Queue (BullMQ / SQS)**: Offload heavy domain side-effects (like PDF generation or bulk emails) to a background worker process so the UI doesn't block. | ? DevOps Eng. | AWS SQS / Kafka | High (~1-2 days). Requires setting up Redis and Worker instances. | **Pending User Approval** |



## Session: FSM Workflow Engine Gap Analysis (Module-by-Module)
**Date:** 2026-07-30

### 5-Perspective Expert Panel Decisions:
1. **Lead Architect:** Add strong-typed ActionPayloads and expand DomainActionDispatcher to include SOD, INVOICE, and PAYMENT cases. (Adopted: ?? Must-Have)
2. **QA & Security:** Implement strict Maker != Checker rule in ProcessGateEngine to prevent self-approval. (Adopted: ?? Must-Have)
3. **Domain SME:** Migrate Service Order (SOD) state transitions to FSM with SLA tracking. (Deferred: ?? Should-Have)
4. **CFO:** Integrate General Ledger (GL) posting as a Domain Action (POST_TO_LEDGER) wrapped in . (Adopted: ?? Must-Have)
5. **DevOps:** Offload heavy FSM side-effects (PDF generation) to Async Queues to prevent Vercel timeouts. (Deferred: ?? Future Roadmap)



## Session: Service Order (SOD) Lifecycle Gap Analysis
**Date:** 2026-07-30

### 5-Perspective Expert Panel Decisions:
1. **Lead Architect:** SOD state transitions (ASSIGNED -> COMPLETED) are hardcoded in controllers. (Adopted: ?? Must-Have - Migrate to FSM ProcessGateEngine).
2. **QA & Security:** Enforce dynamic verification gates (Photo Proof, PAT) inside the FSM before allowing transition. (Adopted: ?? Must-Have).
3. **Domain SME:** Track reverse logistics (Defective Material Returns) inside FSM Domain Actions. (Deferred: ?? Should-Have).
4. **CFO:** Accrue Unbilled WIP Revenue to Ledger upon SOD Completion. (Deferred: ?? Future Roadmap).
5. **DevOps:** Offload Bulk SOD Excel Imports to Async Queues. (Deferred: ?? Should-Have).

# `/grill-me` Session: Contractor Payouts & Invoicing (Finance Module)
Date: 2026-07-30

## The 5-Perspective Expert Panel Evaluation

### 1. 👨💻 Lead Architect & Senior Full-Stack Developer
* **Focus:** Decoupling API routes, caching guards, Idempotency.
* **Recommendations:**
  * 🔴 **Must-Have:** Implement **Idempotency Keys** on all invoice generation and payment posting API endpoints (`/api/finance/invoices`). If a network request times out and the user clicks "Pay" twice, the DB must not deduct money twice. Use Prisma `$transaction()` for every payout batch.
  * 🟡 **Should-Have:** Move ledger postings to an Event-Driven architecture (e.g. `DomainActionDispatcher` emitting `INVOICE_GENERATED` events) rather than tight-coupling in the same controller.
  * 🔵 **Future Roadmap:** Event Sourcing for the Financial Ledger. Every change is an immutable event that is replayed to get the current state.
* **Cost/Complexity:** High. Requires adding `idempotency_keys` table/columns and ensuring front-end clients generate UUIDs for retries.

### 2. 🧪 QA Lead & Security Auditor
* **Focus:** RBAC, Immutable audit logging (SHA-256).
* **Recommendations:**
  * 🔴 **Must-Have:** **Maker-Checker Dual Approvals** for all Contractor Payouts over LKR 100,000. Finance Officer generates the payout (Maker), CFO approves (Checker). Enforce in `ProcessGateEngine`.
  * 🔴 **Must-Have:** Store immutable SHA-256 checksums of the payout record (`amount + contractorId + date`) to detect database tampering.
* **Cost/Complexity:** Medium. We already built the `ProcessGateEngine`, so reusing it for Finance is straightforward, but defining the exact thresholds adds logic overhead.

### 3. 👔 OSP & Enterprise Domain SME
* **Focus:** Retention, Field operations accuracy, PAT acceptance.
* **Recommendations:**
  * 🔴 **Must-Have:** **Retention Deductions**. Automatically withhold X% (e.g., 5-10%) of the payout for Contractor Quality Retention, payable only after 6 months if no defects arise.
  * 🟡 **Should-Have:** Automatic Penalties for SLA breaches (e.g., Late SOD completion) deducted from the final payout.
  * 🔵 **Future Roadmap:** Salesforce-style automatic tiering (Gold/Silver contractors get paid faster or have lower retention).
* **Cost/Complexity:** Medium. Requires adding `RetentionLedger` tables to track withheld amounts and release dates.

### 4. 📊 Chief Financial Officer (CFO)
* **Focus:** Revenue recognition (GAAP/IFRS), Full job costing.
* **Recommendations:**
  * 🔴 **Must-Have:** **Unbilled WIP Receivables vs Deferred Revenue**. When a Service Order completes, accrue the cost immediately (ACCRUE_WIP) to recognize the liability, even before the contractor invoice is generated.
  * 🟡 **Should-Have:** Profit & Loss (P&L) per Service Order = (SLT Revenue - Contractor Payout - Material Cost).
  * 🔵 **Future Roadmap:** Oracle Financials style multi-currency / forex gain-loss tracking.
* **Cost/Complexity:** Very High. Requires deep modifications to how `InventoryLedger` and `FinanceLedger` talk to each other upon SOD completion.

### 5. ⚡ Performance & DevOps Engineer
* **Focus:** Zero database egress regress, high concurrency.
* **Recommendations:**
  * 🔴 **Must-Have:** **Batch Processing for Monthly Payouts**. Running a script to generate 5,000 invoices on the 1st of the month will kill the Next.js API timeout. Must use an Async Background Queue (e.g., Redis/BullMQ) to process large payout generations.
  * 🟡 **Should-Have:** Selective Prisma `select` blocks on Invoice PDF generation to avoid pulling the entire SOD history into memory.
* **Cost/Complexity:** High. Requires setting up BullMQ/Redis infrastructure outside of standard Vercel serverless.

---

## Consolidated Multi-Role Review Table

| Viewpoint | Recommendation | Tier | Trade-off / Complexity |
| :--- | :--- | :--- | :--- |
| **Architect** | Idempotency keys on Payouts | 🔴 Must | Adds DB column, requires frontend UUID gen |
| **QA/Sec** | Maker-Checker Dual Approvals | 🔴 Must | Adds approval delay to workflow |
| **QA/Sec** | SHA-256 Tamper Evident Log | 🔴 Must | Slight compute overhead on write |
| **OSP SME** | Retention % Withholding Logic | 🔴 Must | Requires new ledger tables for retention |
| **CFO** | WIP Accrual on SOD Complete | 🔴 Must | Complex DB transaction locking |
| **DevOps** | Async Queue for Bulk Invoicing | 🔴 Must | Needs Redis/BullMQ infra setup |
| **Architect** | Event-Driven Ledger | 🟡 Should | Over-engineering for current scale |
| **OSP SME** | SLA Breach Auto-Penalties | 🟡 Should | High risk of contractor disputes |
| **CFO** | P&L per Service Order | 🟡 Should | Material cost data must be 100% accurate |

## 📅 2026-07-31: Process Gate Pipeline Conflicts & Gaps

**Module:** Process Gate Engine (Admin Settings)
**Context:** User invoked /grill-me stating that independent process gates in the wizard could lead to gaps or conflicts (overlapping origin statuses or disconnected pipelines).

### Consolidated Multi-Role Review Table

| Feature | Expert View | Severity | Decision |
| :--- | :--- | :--- | :--- |
| **Strict Linear Pipeline Validation** | Architect | 🔴 Must-Have | **ADOPTED** |
| **Prevent Multiple Gates from Same Status** | QA / Security | 🔴 Must-Have | **ADOPTED** |
| **Visual Gap Warning Indicator** | OSP SME | 🟡 Should-Have | DEFERRED |
| **Block module if Pipeline Broken** | CFO | 🔵 Future Roadmap | REJECTED (Out of scope) |

**Implementation Notes:** 
- Updated StepByStepGateWizard.tsx to automatically suggest the correct romStatus based on the leaf node of existing gates for the selected entityType (Strict Linear Pipeline).
- Added Conflict Validation logic to block saving if a gate already originates from the chosen romStatus, preventing race conditions and ensuring a Directed Acyclic Graph (DAG) state machine.


## ?? 2026-07-31: Two-Sided Inventory Requests Architecture (Internal Transfers vs Procurement Requisitions)

**Module:** Inventory Requests (/inventory/requests)
**Context:** User requested /grill-me on separating Stores Manager Requests into 2 Sides:
1. Internal Store Transfers (Inter-Store / Sub-Store ? Main Store)
2. Procurement Requisitions (Stores Manager ? Vendor Procurement / Replenishment)

**Key Decisions Adopted (5-Perspective Expert Panel):**
- ?? **Must-Have**: Structured /inventory/requests into 2 Primary Navigation Tabs (Internal Store Transfers vs Procurement Requisitions).
- ?? **Must-Have**: Supported sourceType filtering in /api/inventory/requests API route.
- ?? **Must-Have**: Separated process gate workflows (MIN issue notes for internal vs FINANCE_APPROVED for procurement).
- ?? **Must-Have**: Enforced (1)$ DB query indexing on [sourceType, status].



## Session: SOD Table Dates & Gap Identification (2026-07-31)
- **Module**: SOD Tables & Date Parsing System
- **Decisions Adopted**:
  - SO Number sub-text parses true SO Issue Date embedded in SO Prefix (e.g. EPA20260715... -> 15/07/2026).
  - Pending SODs display SLA Aging badges against Received Date.
  - Completed SODs display Turnaround Duration (e.g. 16d) instead of misleading Overdue badges.
  - Verified zero-any types and project-wide TypeScript compilation.
