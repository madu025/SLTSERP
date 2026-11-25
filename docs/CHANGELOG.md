# SLTSERP change log by area (26 Oct - 24 Nov 2026)

About 400 commits in five weeks, grouped by what a person would look for. Newest first inside each area. The git history has the detail
(`git log --since="5 weeks ago"`); this file says what changed and why, and where to read more. Keep adding to it: one line per change that a
new developer or an AI assistant would need to know. Refresh `docs/ai-handover.md` when a concept here changes.

## Authorization (RBAC)

- **25 Nov** One session policy (`src/config/session-policy.ts`, after NIST SP 800-63B AAL2, OWASP session management, OAuth security BCP): 30 minutes of inactivity ends the session, enforced by the SERVER (the refresh token lives 30 minutes and is replaced at every refresh, so an idle session cannot be renewed; before, only a browser timer enforced it and the server accepted a 7 day refresh token); at most 12 hours from the sign-in whatever the activity (`authTime` claim, kept as the token is replaced; the refresh route answers 401 and clears the cookies); access token 15 minutes; the browser warns 2 minutes before and checks when a sleeping tab wakes. Password or role change still ends sessions at once (`tokenVersion`). Also fixed: changing your own password now sets the new refresh cookie (the next refresh used to end that session). Effect on deploy: tokens from before are accepted once if signed in within 12 hours; people signed in for longer must sign in again. Not done: refresh-token reuse detection (a stolen old token is not flagged). Test: `tests/unit/session-policy.test.ts`.
- **25 Nov** The Monday operations digest email now shows key figures and charts, not only text: four tiles (completed in 30 days, within the 7-day target in green/amber/red, open now with those over 14 days, critical exceptions), turnaround by week for the last 8 complete weeks, open orders by age, backlog by RTOM (blue within 14 days, red older), received against completed in the last 7 days with the net change, the exceptions grouped as critical and warning, a button, and a footer that says why the person receives it. Drawn with HTML tables and inline styles only (no images), so it shows the same in Outlook, Gmail and on a phone; dark text on light, white on dark. `src/lib/ops-digest-email.ts` (pure builders and the plain-text version), `SodPerformanceService.getDigestData`. The recipient's name is shown, not the email address. A stored template (Administration > Notification templates) is used only if it contains `{{reportHtml}}`; the older stored design is replaced by the built-in one until the template seed is run (it then carries `{{reportHtml}}` and `{{reason}}`).
- **25 Nov** Automated reports go by a rule: the MODULE the report belongs to, the lowest JOB LEVEL that receives it (the menu level of that module: view / operate / approve / admin, or for Reports: own areas / whole company), and the AREA (company-wide, or the people of the area the report is about plus those who see every area). Four reports use it: the Monday digest and management alerts and approval-delay escalation (default: Reports, whole company, company-wide: 13 people instead of 205), and the project reminders (default: Projects, works in it, by area). The administrator changes the rule on the page, with a live count and list of who it reaches and a warning for the people who work in the module but have no area (they receive none of an area report): in production 153 of 176 for the project reminders. The rule is kept in the system settings (`AUTOMATED_NOTICE_RULES`, only a rule that differs from its default is stored). `src/lib/notice-recipient-rules.ts` (pure rules), `src/services/notification/notice-rules.service.ts`. Reports not yet on a rule: daily automation notices (still audiences), low stock per store and appointment reminders (named by the data).
- **25 Nov** Administration > Automated Reports & Alerts (`/admin/settings/automated-notices`): what the system sends by itself (scheduled reports and alerts, when, how, to whom), and for each notification audience how many people it reaches now, by role, the people themselves, and switches to add or remove a role (saved at once, audited). An audience of more than 30 people is flagged. `src/config/automated-notices.ts` describes every audience and scheduled job; a test fails when a new audience or job is missing from it. The RBAC seed now leaves a `notification.audience.*` capability alone once it has grants, so a change made on the page survives a deploy (a new audience still gets its starting grants). The help desk new-ticket audience no longer includes the field Engineers (the notice links to a page they cannot open); for production the change is made on the page, since the seed no longer rewrites an existing audience.
- **25 Nov** The Monday operations digest (email and notification) now has its own audience `OPS_DIGEST` (`notification.audience.ops-digest`: Super Admin, Admin, CEO, Head of OSP, OSP Manager, Head of Section, Manager). It went to the shared `SOD_PROJECT` audience, which 205 people hold (180 of them field Engineers), although the figures are company-wide. `SOD_PROJECT` stays for the ordinary service-order notices. Takes effect when the RBAC seed has run: until then nobody holds the new capability and the digest goes to no one. The administrator can add or remove a person or role on the Permissions page.
- **25 Nov** The Head of Section now holds `scope.inventory.all` like the OSP Manager, so both see every site office store without being assigned one by one (found by the procure-to-pay test: the approval stage of a purchase request refused a Head of Section with no store, `STORE_SCOPE_VIOLATION`). Takes effect when the RBAC seed has run.
- **25 Nov** Procure-to-pay tested end to end with real roles (`scripts/zz-p2p-flow.ts`, 31 checks): purchase request through its approval chain, purchase order, GRN part and rest (over-receipt and unapproved request refused, GR/IR accrued at the order price), supplier invoice with the 3-way match (mismatch needs a reason; the person who entered it cannot approve), approval posting (GR/IR cleared, input VAT, vendor payable), return to the supplier with the debit note. The return approval (MRN) now has a 30 second transaction limit, as the goods receipt has; it timed out at the 5 second default on a slow database. Payment of a vendor invoice is not covered by the script.
- **25 Nov** Polish, module 3 (service orders and invoices): the approval chains were read against the code and need no change (same person cannot take two steps of one chain: `approval-chain-rules.ts`; the OSP step refuses the person who sent the invoice: `invoice-osp-approval-rules.ts`). Two guards added for every module: `scripts/route-guard-scan.ts` + `tests/unit/route-guards-contrast.test.ts` (an API handler without a capability guard fails the test unless it is marked `publicRoute: true` or is on the reviewed list in `tests/unit/fixtures/unguarded-routes.json`: 6 function-style handlers that are public or authenticate themselves, namely auth refresh, health live, metrics, agent download and the public invoice by id; a `permissions` field in a body schema or a comment is no guard, and `export async function` handlers are scanned too), and `scripts/contrast-scan.ts` (no light-on-light or dark-on-dark text inside one className, also in `cn(...)`/`clsx(...)` and over several lines; 0 findings today; classes built at run time are not seen).
- **25 Nov** Polish, module 2 (dashboard): Office Admin, Office Admin Assistant and Site Office Staff hold no dashboard tab; the page fell back to the Operations tab, whose data needs `sod.read`, so they saw an error. They now get "Where you work" (petty cash, support tickets, fleet, notifications; `src/config/dashboard-quick-start.ts`), and the operations figures are fetched only for a person who holds `sod.read`.
- **25 Nov** Polish, module 1 (authorization core): `scripts/page-api-audit.ts` checks every page against the capability of each API it calls (designation roles take their base role's grants, as the seed does); `tests/unit/page-api-capability.test.ts` fails on a NEW page/API mismatch (the 57 known ones, mostly dashboard widgets behind tabs and admin-only helper lists, are in `tests/unit/fixtures/page-api-baseline.json`); the rate matrix is read by finance approvers and SF audit, changed by the administrator only; every non-public page has a page rule (`/gis` now needs `project.read`, `/gis/upload` `project.write`).
- **24 Nov** Menu levels (view / operate / invoice / approve / admin, per module) are now capabilities `menu.<module>.<level>`, held through
  roles in the database. The starting levels are `BOOTSTRAP_MENU_LEVELS` in `src/config/rbac-bootstrap.ts`. `src/config/menu-access.ts` has no
  role names. The first page after sign-in is `landingPath()` (`src/config/landing.ts`) from capabilities (contractor portal, stores, dashboard).
  Tests: `authorization-rules.test.ts` (no role names in the runtime menu/page rules, every capability defined and granted, landing per role),
  `menu-page-reach.test.ts` (no dead link: a menu entry a role sees must open for that role).
- **24 Nov** Menu audit (`scripts/zz-audit-pages.ts`): the OSP Manager reaches OSP Manager Approvals and Contractor Registrations under Approvals;
  the Area Manager's Contractor Approvals page opens; the CEO no longer sees the contractor field portal (CEO lost `contractor.write`); managers get
  the Contractors group (register and import stay with the administrator); PM and QA/QC dashboards need the operate level, Logistics needs
  `inventory.read`; store request approvals are gated by `inventory.approve`.
- **23 Nov** Data scope by domain: CEO, Head of OSP and OSP Manager see every OPMC in every module; finance reads the money of every module.
- **23 Nov** Users: registration on the RBAC model, paged list, one password policy; a person holds only the module designations of their own role;
  contractor logins are left out of the staff list; an OSP Manager needs no OPMC.
- **22 Nov** Module designations (PROJECTS_ENGINEER ...) carry project capabilities; SOD engineers hold no project permissions.
- **3 Nov** Authorization migrated to canonical capabilities (`PermissionDefinition` + `RolePermission`); `User.role` is legacy.
- Read: `docs/authorization-architecture.md` (model, checklist "How to add a page, an approval or a menu entry"), `docs/side-menu-analysis.md`.

## Service orders and invoices

- **22 Nov** Invoice Status page for every designation (8-step tracker, filters); a step actioned twice at once no longer opens the next step twice.
- **22 Nov** The contractor verifies each checked order before the engineer invoices it; engineer and area manager dashboards (pipeline, approvals desk).
- **20-21 Nov** One QC step for the QC Officer or the Area Coordinator (they cover for each other); the check that makes a finished order ready for
  invoicing is on Completed SOD, with PAT approvals shown; no order is completed without a contractor; Offline is a filter, not a page.
- **18 Nov** Finance sends verified invoices to OSP Managers, who approve before Head Office.
- Read: `docs/invoice-flow-redesign-plan.md`, `src/content/guides/sod.guide.ts`.

## Stores and inventory

- **23 Nov** Stores Executive is the Stores Manager's deputy; the Inventory menu is in five groups by what the person does; Pending Approvals page;
  whoever adjusted a request's quantities cannot approve it; contractor material is limited to the contractors of the person's own areas.
- Read: `docs/authorization-architecture.md` ("Stores: who does what").

## Finance, Head Office and the OSP account

- **24 Nov** Petty cash belongs to a SITE OFFICE (an `InventoryStore`), not an OPMC. Box per site office (`PettyCashAccount.siteOfficeId`), custodians
  (`PettyCashCustodian`), Area Manager of the site office (`InventoryStore.areaManagerId`) approves bills and cash releases; no Finance Manager step.
  Imprest identity: cash in hand + cash out on IOUs + bills waiting = imprest limit. Replenishment and float come from Head Office funding requests.
- **24 Nov** The custodian releases cash to a person (IOU) and settles it: bills handed in plus cash returned are SUBMITTED, and nothing is booked until
  the Area Manager verifies (`OspIouSettlementSubmission`, `OspFloatService.submitSettlement/decideSettlement`). Extra spend is a separate bill.
- **24 Nov** OSP account items (IOU, advance, rent, fuel deposit, hiring): maker cannot approve (`assertNotMaker`); floats and IOU settlement with
  ledger postings; GL fallback to built-in default accounts because production has no GL mapping rows.
- **24 Nov** Finance menu regrouped without duplicates; unused old pages removed; a test guards the menu.
- **15 Nov** Head Office payment model: payment packs, funding requests, monthly payments to Head Office, month-end reconciliation.
- Read: `docs/plans/ho-payment-flow.md` (owner decisions), `docs/plans/finance-panel-review.md` (60 questions, gap register, phases A-E).
  Not built yet: payment Hold/Reject chain, salary hold request, HO stages table and installments, float return to HO, approvals queue/deputy.

## Menu and dashboards

- **22 Nov** Option B: Service Orders, Inventory, Projects, Reports, ITMS and Fleet menus decided by module level plus capability.
- **17-20 Nov** Dashboard: My work tab for approval holders, Needs attention redesign, decision brief.

## Nexus (AI assistant and guides)

- **17 Nov** Executive assistant, semantic layer (data dictionary), plan-only privacy mode, DeepSeek provider; **18 Nov** system guides
  (`src/content/guides`, tool `getSystemGuide`, keep them current with `.claude/skills/update-system-guides`).

## Projects, procurement, GIS, contractors

- Projects: supervisor-driven task plans, material supply control, invoice for every project type, hand-off notifications and My Tasks (28 Oct - 11 Nov).
- Procurement: procure-to-pay alignment (PPV, input VAT, GR/IR). Contractors: scorecard from service order outcomes. GIS: operations layer.

## Build, deploy and quality

- Deploy: Coolify application `otw8kykkqdkuzox6ft7v7z44`; the release tunnel goes through a fixed proxy on the VPS. The RBAC seed
  (`pnpm run rbac:seed`) is run by the deploy only when the seed step is part of it: **check `menu.` definitions in the database after a deploy that adds
  a capability** (a deploy on 24 Nov did not run it; it was run by hand).
- pnpm only. Checks: `pnpm exec tsc --noEmit`, `pnpm run test:unit` (explicit file list in `package.json`: add new test files there),
  `pnpm run rbac:check`, `pnpm run check:guides`, `pnpm run check:email-templates`.
