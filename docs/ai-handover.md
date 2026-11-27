# SLTSERP: handover for developers and AI assistants

Read this first, then `AGENTS.md` (rules), `docs/authorization-architecture.md` (access model and the checklist for adding pages) and
`docs/CHANGELOG.md` (what changed lately). Updated 24 Nov 2026. Keep it short and true: change a line here when a concept below changes.

## What it is

SLTSERP (Nexus) is a Next.js ERP for an OSP contractor of SLT: service orders (SOD) and invoices, projects, inventory/stores, procurement,
finance (OSP account, Head Office payments, petty cash), contractor portal, helpdesk/ITMS, fleet, reports, and the Nexus AI assistant.
The owner works in Sinhala/Singlish; user-facing text of the product is English. Production: Coolify (`slts.vynor.lk`), Postgres reached by an SSH tunnel
for local scripts (`.env.local`). pnpm only.

## The five rules that cause most mistakes

1. **Capabilities decide, role names do not.** Menu, page and API use the same capability (`src/config/rbac-permissions.ts`). The database
   (`PermissionDefinition` + `RolePermission`) is authoritative at runtime; `src/config/rbac-bootstrap.ts` is the starting grants that the seed
   (`pnpm run rbac:seed`) writes. Tests enforce it: `tests/unit/authorization-rules.test.ts`, `menu-page-reach.test.ts`.
2. **A capability never grants data.** Every read/write also enforces area scope (OPMC for most modules; site office for petty cash).
3. **Maker cannot approve their own item** (`src/lib/maker-checker.ts`). Approvals are checked before opening a DB transaction (the tunnel is slow;
   a 5 s default transaction timeout was exceeded), with `FOR UPDATE` locks and `{ maxWait: 10000, timeout: 30000 }`.
4. **Production is touched only with the owner's approval** for schema migrations and the RBAC seed (ask each time); push and deploy are approved
   every time (`git push origin HEAD:main`, then deploy). Never print passwords. Test accounts only on localhost with a password you choose, and tear
   them down. Test mail goes only to the owner's own address.
   **Observed 25 Nov 2026:** a migration pushed to main (`20261221000000`) was applied to production by the deploy a few minutes after the push, before any manual
   step. Treat every migration in a push as going live at once, and ask before pushing one.
5. **Guides and templates follow the code**: update the system guide (`pnpm run check:guides`, `guides:stamp <module>`) and the email template
   registry (`pnpm run check:email-templates`) in the same change.

## Concepts you will meet

| Concept | Where | Notes |
|---|---|---|
| Session policy | `src/config/session-policy.ts` | 30 min idle + 12 h absolute, enforced by the server (refresh token rotation, `authTime`); never copy these numbers elsewhere |
| Capabilities and module designations | `rbac-permissions.ts`, `rbac-bootstrap.ts` | A person has a base role (post) and per-module designations (section assignments, e.g. PROJECTS_ENGINEER). `User.permissions` non-null is an audited override that replaces inherited grants. |
| Menu levels | `menu-access.ts`, capabilities `menu.<module>.<level>` | view < operate < invoice < approve < admin per module (orders differ per module). A role with no level capability in a module: the page capability alone decides. |
| Automated notices | `src/config/automated-notices.ts`, `/admin/settings/automated-notices`, `src/lib/notice-recipient-rules.ts` | A scheduled report goes by a rule (module, job level = menu level, area); use `NoticeRulesService.notify(job, ...)` and give the area (`opmcId`) when it is about one. Every audience and scheduled job is described in the catalogue (test-enforced). Who receives a notice = the roles holding `notification.audience.*` in the database; the administrator changes it on the page. The RBAC seed does not rewrite an audience that already has grants. A notice to an audience must pass `opmcId` when it is about one area, or it reaches the whole audience. |
| Report emails | `src/lib/ops-digest-email.ts` | A report email is built from pure functions that draw tiles and bars with HTML tables and inline styles (no images, no scripts); the stored template may wrap it with `{{reportHtml}}`. Keep text dark on light, and give the plain-text version the same figures. |
| Menu and pages | `sidebar-menu.ts`, `page-capabilities.ts` | A leaf with no `permissionId` inherits its group's; set it on the leaf. Audit with `scripts/zz-audit-pages.ts`. |
| First page after sign-in | `src/config/landing.ts` | From capabilities. |
| Site office | `InventoryStore` (type MAIN/SUB) | Owns petty cash, floats and IOUs. `areaManagerId` is its ARM (set when the Area Manager is registered with the site offices they cover). |
| Petty cash box | `src/services/finance/petty-cash.service.ts`, `src/lib/petty-cash-rules.ts` | Imprest: cash in hand + cash out on IOUs + bills waiting = imprest limit. Bills and cash releases are approved only by the site office ARM. |
| IOU and settlement | `osp-float.service.ts`, `osp-float-rules.ts` | Custodian submits bills + cash returned; the ARM verifies; only then it is booked (one transaction). Extra spend is a separate bill. |
| Invoice approval chain | `docs/invoice-flow-redesign-plan.md`, `src/services/invoice` | Contractor, coordinator/QC, engineer, area manager, finance, OSP manager, Head Office. Each step has its own capability. |
| Head Office payments | `docs/plans/ho-payment-flow.md` | Owner decisions and the unbuilt phases (hold/reject chain, salary hold request, HO stages, installments). |
| GL posting | `LedgerService`, `OSPLedgerService` | Production has no `GLMappingConfig` rows: code-defined defaults are the fallback. Journal entries are immutable. |
| Purchase order record and log | `src/lib/po-approval-chain.ts`, `purchase-order.service.ts`, `/procurement/orders/:id` | Purchase orders are approved in the HO ERP (owner, 26 Nov 2026): there is no PO approval chain and no CEO approval in Nexus. The Procurement Officer records the order with its payment terms; it is APPROVED at once (log entry RECORDED) and its vendor or value cannot be changed here (change it in HO, cancel, record the new one). Every event is a row in the append-only hash-chained `PurchaseOrderApproval` (use `firstBrokenEntry`); logs of orders approved by the former chain keep their step names (`PO_HISTORY_STAGE_LABEL`). A supplier invoice has one finance approval (or the voucher chain). |
| Procurement through HO | `stock-request.service.ts`, `purchase-order.service.ts`, `pv-chain.service.ts`, `/inventory/grn`, `/procurement/payment-approvals`, `/finance/ho-payments` | Company flow (26 Nov 2026): request Stores Officer -> Stores Manager -> OSP Manager -> Stores Manager "Documents submitted to Procurement" -> Procurement records the HO-approved PO(s) with payment terms (ready for GRN by itself once all is ordered) -> GRN with Oracle GRN number and vendor invoice -> Account Officer raises the voucher and records "Signed by all three" with the scan (paper signatures) -> documents sent -> HO Account Executive receives them -> HO payments in full or in parts. Debit and credit entries are posted automatically; users see received, paid and balance. |
| Company procure-to-pay | `docs/plans/procurement-ho-mode.md` section E | Request -> Stores Manager -> OSP Manager -> Head of Section; one PO per vendor; PO -> several GRNs; one vendor invoice per GRN (created with the GRN, needs the Oracle GRN number); PV per invoice by the OSP Account Officer, accepted by the OSP Account Manager (approves the invoice too); HO pays in parts recorded by the Account Executive designation on the voucher (`/api/finance/payment-vouchers/:id/payments`); OSP sees it only from those records: Vendor Payment Status (`/procurement/vendor-payments`) and one running notice per day (OSP_VENDOR_PAYMENTS, `lib/ho-payment-digest.ts`). Opening stock at go-live: Inventory / Stores -> Setup -> Opening Stock (`OpeningStockService`, Excel upload, second-person approval, FIFO batch + `OPENING_BALANCE` ledger). Staff guide: Help (`/help`) -> Purchase flow (`src/content/guides/purchase.guide.ts`, screenshots in `public/guides/purchase/`). |
| Store issue notes | `AGENTS.md` | Every issue/dispatch/return needs an issue note number and an `InventoryLedger` entry with a checksum. |

## Where things are

- Services `src/services/<domain>`, API routes `src/app/api/...` (wrap with `apiHandler({ permissions: [...] })`), pages `src/app/...`, rules as pure
  functions in `src/lib/*-rules.ts` with unit tests in `tests/unit`.
- Prisma schema is split in `prisma/schema/*.prisma`; migrations in `prisma/migrations` (additive; apply to production only after approval:
  `prisma migrate deploy` with `.env.local` loaded).
- `src/content/guides` step-by-step guides for the Nexus tool `getSystemGuide`; `.claude/skills` project skills (`browser-qa`,
  `project-workflow-notification-qa`, `update-system-guides`, `sltserp-handover`).

## How to test (what worked)

1. Pure rules first (unit tests), then a service-level script with real roles on `ZZTEST` data (see `scripts/zz-petty-cash.ts`, 61 checks;
   `scripts/zz-osp-float.ts`; the whole procure-to-pay flow: `scripts/zz-p2p-flow.ts`, 31 checks), which cleans up after itself (journal entries stay: the ledger is immutable).
2. Browser test on localhost: dev server `sltserp-dev` (port 3100, from `.claude/launch.json`), log in through the form, one account per role
   (`scripts/zz-osp-gui.ts setup <password>` / `teardown`). The dev server is slow over the tunnel: wait for each refresh (the Petty Cash page refreshes every 15 s).
   Receipt upload cannot be tested locally (storage returns 503).
3. After a deploy that adds a capability, **check the database**: the deploy did not run the seed on 24 Nov; it was run by hand.
   Query `permissionDefinition` for the new codes and derive a role's menu/landing with `deriveEffectivePermissions` (see the checks in the session notes).
- API handlers without a capability guard: `pnpm exec tsx scripts/route-guard-scan.ts`; a new one fails `route-guards-contrast.test.ts` unless it is reviewed into `tests/unit/fixtures/unguarded-routes.json`. Contrast: `pnpm exec tsx scripts/contrast-scan.ts`.
4. Run: `pnpm exec tsc --noEmit`, `pnpm run test:unit` (explicit list in `package.json`; add new files there), `pnpm run rbac:check`,
4. Page against API: `pnpm exec tsx scripts/page-api-audit.ts` lists, per page, the roles that open it but lack the capability of an API it calls; a new mismatch fails `page-api-capability.test.ts` (fix the capability, or add the pair to the reviewed baseline).
5. Run: `pnpm exec tsc --noEmit`, `pnpm run test:unit` (explicit list in `package.json`; add new files there), `pnpm run rbac:check`,
   `pnpm run check:guides`, and for UI work the contrast rule in `AGENTS.md`.

## Known gaps (24 Nov 2026)

- 26 site offices have no Area Manager registered, so cash releases are refused there until one is set in registration.
- Not built: payment Hold/Reject chain with the OSP Manager and Head of Section steps, salary hold request, HO stages and installments, float return
  to Head Office, reimbursement claim by GL account, approvals queue with deputy, registers (rent, fuel, hiring), audit controls (plan phases A-E).
- Head of Section has no payment approval step yet; Procurement Officer holds `inventory.approve` (review); Finance Invoice Approvals page opens for
  every finance reader (the approve action is the Finance Manager's).
- Orphan admin pages not in the menu: `/admin/reports/dynamic`, `/admin/settings/access-policies` (owner not yet asked).
- Receipt upload on production is untested.
- Production had a FRESH START on 27 Nov 2026 (see CHANGELOG): no journals, stock, procurement, logs or test masters before that date; SOD
  data and masters kept. Opening stock is not loaded yet. Backup of the old data: `/root/backups/sltserp-before-fresh-start-20261127.dump`.
  A reconciliation of AP-VEND must include supplier debit notes and contractor invoices, not only supplier invoices.
