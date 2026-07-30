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

