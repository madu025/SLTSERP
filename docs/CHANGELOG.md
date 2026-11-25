# SLTSERP change log by area (26 Oct - 24 Nov 2026)

About 400 commits in five weeks, grouped by what a person would look for. Newest first inside each area. The git history has the detail
(`git log --since="5 weeks ago"`); this file says what changed and why, and where to read more. Keep adding to it: one line per change that a
new developer or an AI assistant would need to know. Refresh `docs/ai-handover.md` when a concept here changes.

## Authorization (RBAC)

- **25 Nov** Procure-to-pay tested end to end with real roles (`scripts/zz-p2p-flow.ts`, 31 checks): purchase request through its approval chain, purchase order, GRN part and rest (over-receipt and unapproved request refused, GR/IR accrued at the order price), supplier invoice with the 3-way match (mismatch needs a reason; the person who entered it cannot approve), approval posting (GR/IR cleared, input VAT, vendor payable), return to the supplier with the debit note. The return approval (MRN) now has a 30 second transaction limit, as the goods receipt has; it timed out at the 5 second default on a slow database. Payment of a vendor invoice is not covered by the script.
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
