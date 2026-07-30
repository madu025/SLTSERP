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

