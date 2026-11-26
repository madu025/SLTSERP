# SLTSERP Authorization Architecture

## Authoritative model

Authorization is capability-based and database-driven.

```text
User
 ├─ role (legacy identity/category; validated by Prisma Role enum)
 ├─ roleId -> SystemRole
 ├─ sectionAssignments -> SystemRole[]
 └─ accessibleOpmcs -> OPMC[]

SystemRole -> RolePermission -> PermissionDefinition
```

`User.role` is not the final authorization decision. It is a legacy role
classification and compatibility field. New code must authorize with a
canonical permission code such as `sod.read` or `project.approve`.

## Permission format

Permission definitions are registered in
`src/config/rbac-permissions.ts` and stored in the `PermissionDefinition` table.
Each definition has:

- `module`: SOD, PROJECT, FINANCE, INVENTORY, PROCUREMENT, etc.
- `action`: READ, WRITE, APPROVE, INVOICE, or an equivalent capability action.
- `scope`: GLOBAL, ORGANIZATION, OPMC, AREA, or SELF.
- `code`: stable key used by API and frontend guards.

Role grants live in `RolePermission`. The seed command
`pnpm run rbac:seed` creates/links the catalog and performs the initial legacy
role-to-capability translation. It does not delete legacy page permissions.

## Scope model

Functional permission and data scope are separate checks:

1. Permission answers: “May this user perform this module/action?”
2. OPMC scope answers: “Which rows may this user see or change?”

`src/lib/opmc-scope.ts` is the server-side scope authority. `undefined` means
global administrative scope, an empty array means deny all operational rows,
and a non-empty array is the user's assigned OPMC allowlist. Client-supplied
OPMC/RTOM filters must always be intersected with this server scope.

There is currently no separate tenant/Organization table in the schema. For
this deployment, OPMC is the authoritative operational data boundary and
Section/SystemRole is the functional organizational boundary. A future
multi-tenant deployment must add `Organization` and make it an explicit parent
of User, OPMC, SystemRole, and all tenant-owned records; do not infer tenant
identity from a display role name.

## Request enforcement

- API routes: use `apiHandler({ permissions: [RBAC_PERMISSIONS.X] })`.
- API routes that are public, token-authenticated, or cron-authenticated must
  declare that boundary explicitly with `publicRoute: true`; an undeclared
  internal route fails closed.
- Dynamic pages: use `RoleGuard permissionId={...}`. No role-array prop is
  accepted by the guard.
- Sidebar and middleware resolve a canonical `permissionId` and check the
  session's database-backed effective permissions. Legacy role arrays are not
  an authorization fallback.
- Resource endpoints must additionally call `assertProjectAccess` or the
  appropriate OPMC scope helper.
- Frontend visibility is convenience only; API/service authorization is
  mandatory.

## Migration rule

The old role-group catalog is no longer imported by runtime or RBAC seed code.
Initial grants are preserved exactly in the explicit
`src/config/rbac-bootstrap.ts` catalog, then persisted to `RolePermission`.
`User.role` remains only a validated display/navigation compatibility value;
it must never grant access.

Workflow and notification records are migrated in phases so old rows are not
deleted or invalidated:

1. New policy rows write canonical `requiredPermission`, `eligibleRoles`,
   `policyVariant`, and `notificationAudience` fields.
2. The migration backfills those fields without overwriting existing policy
   choices. `requiredRole` remains an immutable audit/display snapshot for
   approval history; it is not an authorization input.
3. The cleanup migration backfills historical ChangeApproval canonical
   snapshots, normalizes the known `HOS` notification alias, verifies that no
   unresolved notification snapshot remains, and only then drops the obsolete
   `rolesToNotify` column. It never deletes workflow or notification rows.
4. Runtime reads canonical fields only. Unknown or incomplete workflow
   snapshots fail closed and stop deployment until an administrator repairs
   the data.

Every route, page, service, and approval decision must resolve a canonical
permission from the database. Add a permission definition, seed the DB grant,
and guard with the permission code instead.

Direct `User.permissions` is an explicit administrator override. When it is
non-null it intentionally replaces inherited role permissions, so it must be
changed only through the admin permission workflow and audited.

## Verification checklist

### Project UI and approval routing

Project readers may see project budget/actual-cost summary (business rule
confirmed 2026-10-30). This does not grant detailed Finance modules or write/
approval capability. Navigation filters restricted modules and mutation controls
by canonical capabilities; backend authorization remains mandatory.

Project approval decisions require `project.approve` plus project OPMC access.
An explicit assignee remains exclusive. Unassigned steps resolve required job
identity from active canonical SystemRole/section role codes, not `User.role`.
The `admin.rbac` capability permits the existing administrative routing override;
it does not substitute for `project.approve`.
Workflow stage transitions require `project.approve` and Project OPMC access;
workflow approval levels additionally require an active canonical SystemRole or
section role matching the configured approval role. `admin.rbac` may override
approval-level routing but cannot approve two levels of the same stage as one
user. The legacy `User.role` field must not decide workflow actions.
Submitting a workflow review requires `project.write`; deciding it requires
`project.approve`, Project OPMC access, and the configured active DB reviewer
role. The reviewer role is taken from the persisted stage, never the request.
The submitter cannot decide the same review, including with `admin.rbac`.

Project BOQ and change-request approval routing is persisted in
`ProcessGatePolicy` and `ProcessApprovalLevel`. BOQ levels store the canonical
`project.approve` capability plus their eligible active `SystemRole.code`
values; change-request levels use DB policy variants for the amount bands.
The migration seeds the former default role lists as data, while services fail
closed when the policy is missing or incomplete. Existing approval records keep
their role/policy snapshot, so changing a policy does not silently rewrite an
in-flight maker-checker chain.

### Project finance controls

`project.finance.read/write/approve/assign` separate financial visibility,
preparation, approval/posting, and team accountability management. Each still
requires the project OPMC boundary. Finance assignments never grant capabilities
or expand OPMC scope. Once a project has an active finance team, its invoice
preparation requires PREPARER or LEAD_CONTROLLER assignment, and invoice
transitions/collection require APPROVER or LEAD_CONTROLLER assignment. Invoice
creators cannot approve or collect their own invoice; `admin.rbac` is the
explicit administrative override. Projects without active assignments retain
the canonical capability and OPMC checks during rollout.

Client invoice collections use CustomerReceipt, never outgoing payment vouchers.
Submission and settlement are distinct dimensions. Completion requires a
submitted client invoice with PAID settlement, zero balance, and sufficient
received funds. Collection and transition writes lock the invoice row within
their transaction; a unique invoice/reference constraint prevents duplicate
settlement retries even when another write path bypasses the application check.

Before merging an authorization change:

1. Confirm the permission code exists in the catalog and DB seed.
2. Confirm the route/page uses the same permission code.
3. Confirm OPMC/area scope is enforced in the service query and mutation.
4. Test allow/deny for a shared manager, an OSP-only role, and an unassigned
   user.
5. Run `pnpm run rbac:check`, `pnpm run rbac:seed` when grants change,
   `pnpm run test:unit`, `pnpm run test:types`, and `pnpm run build`.

## Head Office payment capabilities

OSP has no bank of its own: the OSP Finance Section prepares and approves payment requests (payment vouchers) and Head Office pays them and provides funding.

| Capability | Who | Allows |
| --- | --- | --- |
| `finance.ho.submit` | OSP Finance Section (default: holders of `finance.write`) | Submit approved vouchers to Head Office as a numbered pack, raise and submit funding requests. |
| `finance.ho.confirm` | Head Office finance office (default: holders of `finance.approve`; administrators should narrow this to Head Office staff) | Confirm a Head Office payment with its reference and date, return a submitted voucher, approve and fund funding requests. |

Collections use the same two capabilities: `finance.ho.submit` sends client invoices already submitted to SLT to Head Office as a numbered billing pack (`HBP-`), and `finance.ho.confirm` confirms Head Office's collection from SLT (reference, date, amount; posts Dr `HO-2020` / Cr `AR-1110`) or returns the invoice. The sender of an invoice cannot confirm its collection. Direct bank receipts for client invoices are refused (`CLIENT_RECEIPTS_ARE_COLLECTED_BY_HEAD_OFFICE`); data scope follows project/OPMC access.

Separation of duties: the maker cannot approve or confirm their own voucher, the approver cannot submit the voucher they approved, and the submitter cannot confirm payment. A confirmation recorded by a user who also holds `finance.ho.submit` is flagged `recordedOnBehalf` (an OSP user recording what Head Office confirmed). Vouchers without a project (vendor payments) and funding data need company-wide finance access; project vouchers follow project/OPMC scope.

### Invoice area approval gate

A contractor can have 50-100 service orders in one invoice, so the area approval is on the **invoice**, not on each service order. It is a normal process gate: `ProcessGatePolicy` INVOICE `CREATED -> AREA_APPROVED` (seeded by migration `20261209000000_invoice_approval_gate`, which also retired the per-order gate of `20261208000000`), `queueMode = true`, domain action `MARK_INVOICE_AREA_APPROVED`. Its ordered `ProcessApprovalLevel` steps are, by default: Area Coordinator (`invoice.confirm.coordinator`), QC Officer (`invoice.confirm.qc`), Contractor (`contractor.write`, `assignee = ORDER_CONTRACTOR`), Engineer (`invoice.confirm.engineer`, `skipIfNoApprover`), Area Manager (`invoice.confirm.manager`). An administrator reorders, adds or removes steps on the gate screen (drag and drop, Admin > Settings > Process Gates); no code change is needed. Service orders have no approval of their own: they are verified for invoicing in one click (`verifyInvoicable`, e.g. every completed order of an RTOM), then one invoice is generated per contractor.

Gate engine features (opt-in, so existing gates behave as before): **queue mode** (no single assigned approver and no per-entity email; approvers work from a queue page and may act only on entities of their own OPMC, `mayActOnLevel` in `src/lib/gate-eligibility.ts`), **`assignee = ORDER_CONTRACTOR`** (the step belongs to a user of the invoice's contractor; an administrator does not stand in for it), and **`skipIfNoApprover`** (the step is skipped when nobody holding its role exists in the invoice's area, never because only an administrator exists).

`InvoiceGateService` (page `/invoices/confirmations`, API `/api/invoices/confirmations`; contractor portal API `/api/contractor-portal/invoice-approvals` with `contractor.write`) drives the engine. A new invoice is created with `Invoice.confirmStage = IN_GATE` and the gate is started after it is saved (a missed start is healed the next time anyone opens the queue); approve and return call `advanceGate` per invoice, batch up to 200; a return needs a reason and restarts the gate; one person cannot approve two steps of the same invoice. The last step runs `MARK_INVOICE_AREA_APPROVED`: `confirmStage = CONFIRMED` and `contractorConfirmStatus = CONFIRMED`, which is what puts the invoice in the OSP Quality queue. `Invoice.confirmStage` is only a marker (a role code = waiting at that step; invoices that existed before the gate are CONFIRMED).

**Taking service orders out of an invoice** (`POST /api/invoices/confirmations`, action `REMOVE_SODS`; a holder of any non-contractor step of the gate, inside the invoice's area, while the invoice is still in approval; a reason is required): in one transaction with the invoice row locked, the orders become `invoiced = false`, `invoiceId = null`, `isInvoicable = false` (back on the verification list), their penalties on the invoice are rejected, the original `INVOICE_GENERATION` journal entry is reversed (`LedgerService.reverseTransaction`) and re-posted for the orders that stay (new idempotency key), the total, retention, WHT, Part A and Part B are recalculated (`figuresAfterRemoval`), `InvoiceSodRemoval` keeps who, when and why (the contractor sees it), and an invoice left with no orders is cancelled. The invoice generation idempotency key is the contractor, the month and the selection of orders, so a removed order can be invoiced again on a later invoice.

### The OSP Quality queue

The contractor's confirmation is a step of the invoice area approval gate (above), done by the signed-in contractor (identified by `User.contractorId`, never by a client-supplied id; capability `contractor.write`) at `POST /api/contractor-portal/invoice-approvals`. When the gate finishes the invoice is in the OSP Quality queue (`GET /api/finance/sf-audit/queue`, `finance.audit`, OPMC scope of the contractor). SF Audit clearance (`approveBySfAudit`) refuses an invoice whose approval gate is not finished.

### Area scope of the Invoices pages

A monthly contractor invoice belongs to its contractor's OPMC. `src/lib/invoice-access.ts` (`invoiceScopeWhere`, `assertInvoiceAccess`, `assertContractorInScope`) is the one rule: the invoice list is filtered to contractors inside the caller's OPMC scope, and viewing details, editing, deleting, penalties, SF Audit clearance, amendment requests and creating an invoice for a contractor all refuse an invoice or contractor outside it. Company-wide access sees all; no identity sees none. The contractor portal sign-in also sets the same `token` / `refresh_token` cookies the middleware reads (it only set `contractor_token`, so every portal page bounced back to the login).

### Finance, OSP manager approval and Head Office

After OSP Quality verifies an invoice (`statusA = SF_AUDIT_APPROVED`), Finance (`finance.write`, OPMC scope of the contractor) sends it to the OSP managers with `POST /api/finance/invoice-dispatch` (`approvalStatus` DRAFT to `PENDING_OSP_APPROVAL`; batch, max 200). A holder of `invoice.osp.approve` (new capability, default to `OSP_MANAGER`, `HEAD_OF_OSP`, administrators; OPMC scope) approves it or returns it to Finance with a reason at `POST /api/invoices/osp-approvals`; the sender cannot approve their own send. Approval sets `approvalStatus = APPROVED`, which is the existing precondition of the Head Office run (payment request, approval, Head Office pack, Head Office confirmation with its reference); the Finance page shows each approved invoice's payment requests and Head Office reference. A monthly contractor invoice is not tied to a project: its payment request is created with no project (`PaymentVoucher.projectId` null, linked by `BOM_INVOICING_REF:<invoiceId>`), requires the invoice to be OSP-approved, the payee to be its contractor and the live requests not to exceed the invoice amount, and, like a vendor payment, needs company-wide finance access (`assertVoucherAccess(null, ...)`). Every decision is a conditional update with an audit-log entry. `Invoice.approvalFlow` separates new invoices (`OSP_CHAIN`) from older ones (`LEGACY`, which keep the single `finance.approve` action); the single approval refuses an `OSP_CHAIN` invoice so the chain cannot be skipped.

### Contractor invoice area confirmation chain (legacy path)

Invoices created before the area approval gate waited at `AREA_COORDINATOR` (`Invoice.confirmStage`; invoices that existed before the chain default to `CONFIRMED`; new invoices are created `CONFIRMED` because the chain now runs on the service orders). It needed, in order: `invoice.confirm.coordinator` (Area Coordinator), `invoice.confirm.qc` (QC Officer), `invoice.confirm.engineer` (Area Engineer / Officer; skipped when no active user in the contractor's OPMC holds that capability through a system role) and `invoice.confirm.manager` (Area Manager). Only then can SF Audit / the Invoice and Quality section clear it. Each action is kept in `InvoiceConfirmation` (who, when, note); a return needs a reason and restarts the chain; one person cannot confirm two stages of the same invoice. Data scope: the contractor's OPMC must be within the actor's OPMC scope. The capabilities are not granted to any role by default; assign them in the admin permission UI.

## Creating and editing users (Administration > Users)

One service, `UserAdminService` (`src/services/hr/user-admin.service.ts`), is used by the user form (server actions), `/api/users` and the scripts.

- **Base role**: `User.roleId` is the SystemRole of the chosen role (`ENGINEER`, else `ENGINEER_GLOBAL`). A role with no active SystemRole is refused (`NO_SYSTEM_ROLE`); it is never skipped silently, because the user would have no grants.
- **Module designations** (`UserSectionAssignment`, e.g. `PROJECTS_ENGINEER`) are picked in the form. When none are sent on create, the usual ones for the role (`SECTION_MAPPING`) are added, only if those SystemRoles already exist. A base role cannot be used as a designation.
- **Data scope**: roles in `OPMC_REQUIRED_ROLES` (`src/config/user-admin.ts`) must have at least one OPMC, because an empty allow-list denies every operational row. Store roles need a store or an OPMC.
- **Manual grants** (`User.permissions`) are never written by this form; they have their own audited endpoint. A role change clears them. The old page-name override (which replaced every role grant) was removed.
- **Password**: one policy for create, edit, reset and change (`passwordProblem`: 8+ characters, a letter and a number). An administrator-set password sets `mustChangePassword` and ends open sessions. The welcome email never contains the password.
- **Status**: `active | inactive | resigned` (`deleted` only by the delete action). Compare statuses with `normalizeUserStatus`/`isActiveStatus`, never `===`.
- **Contractor users** are created from the contractor registration (they need `contractorId`), not from this form.

## Data scope by domain (company-wide roles)

`resolveOpmcScope(userId, domain?)` decides which OPMCs a user's rows may come from. `undefined` = every OPMC.

- A user with `admin.rbac` is global everywhere (administrator powers are separate and unchanged).
- A **scope capability** opens one domain: `scope.sod.all`, `scope.finance.all`, `scope.project.all`, `scope.inventory.all`, `scope.reports.all`; `scope.company.all` opens every domain, including procurement, contractors and the dashboard. They are granted to roles in `rbac-bootstrap.ts` (DB `RolePermission`), so a new OPMC is covered at once and nobody needs all OPMCs assigned by hand.
- A scope capability is **never a function**: `scope.finance.all` does not let anyone open service orders (that needs `sod.read` and `scope.sod.all`). Finance roles therefore see the invoices, vouchers and finance records of every OPMC but not the service orders.
- A call with no domain stays strict (assigned OPMCs only), so nothing widens by accident. Each module passes its own domain; the admin control monitor and the notification inbox stay strict.
- Domains: `sod`, `finance`, `project`, `inventory`, `reports`, `procurement`, `contractor`; `company` covers the rest (dashboard, OPMC list).
- Grants: CEO, Head of OSP and OSP Manager hold `scope.company.all` and every domain, with the Reports capabilities (`reports.read`, `reports.manager.read`, `reports.area.read`). Every finance role (Finance Manager/Assistant, Cashier, AR Officer, Invoice Manager/Assistant, SF Audit) holds `scope.finance.all`, `scope.project.all` (project money) and `invoice.status.read`. Finance Manager and Assistant also read (never write) procurement, stock and contractors in every region: `procurement.read`, `inventory.read`, `scope.procurement.all`, `scope.inventory.all`, `scope.contractor.all`.
- `invoice.status.read` opens Service Orders > Invoice Status (it has the invoices of the orders' contractors, not the orders). The service order people hold it with `sod.read`; the finance people hold it without `sod.read`, so they see the invoices of every RTOM and never the service orders.
- Rows of a domain still follow the function check (`sod.read`, `finance.read`...) and the existing row-level rules (own contractor, own area for area roles).

## Inventory roles (stores)

- **Stores Officer / Assistant** (`STORES_ASSISTANT`): daily work (`inventory.read`, `inventory.write`): request material from the main store, receive (GRN), issue (MIN), contractor material issue/returns. No stock adjustments.
- **Stores Executive** (`STORES_EXECUTIVE`, between the Officers and the Manager): the same, plus `inventory.review` (change the approved quantities of a pending request before the approval; action `ADJUST_QTY`, audited with a reason) and `inventory.adjust` (stock adjustments: contractor wastage). It has no `inventory.approve`, so it can neither approve nor reject a request.
- **Stores Manager**: approves (`inventory.approve`), reviews and adjusts at any time, all stores. The **Procurement Officer** may stand in for the Stores Manager at the main store approval gate (eligible role added by migration) and can review/adjust.
- `inventory.review` is held by every request approver (Area Manager, OSP Manager, Head of OSP, CEO, Stores Manager, Procurement Officer) and the Executive; `inventory.adjust` by the Executive, the Stores Manager and the CEO (and admins).
- **Review is not approval (same person):** whoever adjusted the quantities of a request (an `ADJUST_QTY` audit entry by that user) cannot pass the approval gate for that same request; another approver (the Manager, or another Executive) must. Enforced in `handleGatePassed` (`SEGREGATION_OF_DUTIES_VIOLATION`).

### Stores: who does what (final)

| Capability | Officer / Assistant | Executive | Manager | CEO / admins |
|---|---|---|---|---|
| Raise a material request to the Main Store, receive transfers at the own store (`inventory.write`) | yes | yes | yes | yes |
| Issue material to contractors, take their returns, stock take count (`inventory.write`) | yes, **only the contractors of the own store** | yes, own store contractors | yes, any (runs every store) | yes |
| Read the balance in hand of a contractor | only contractors of the own store | same | any | any |
| Review a request: change quantities (`inventory.review`) | no | yes | yes | yes |
| Release stock from the Main Store (`inventory.release`) | no | yes | yes | yes |
| Goods receipt GRN and return to the supplier MRN (`inventory.grn`) | no | yes | yes | yes |
| Stock adjustment / wastage (`inventory.adjust`) | no | yes | yes | yes |
| Approve / reject a request, approve MRN, wastage, stock take (`inventory.approve`) | no | no | yes (Procurement Officer stands in) | yes |

A contractor belongs to a store when its OPMC is served by the store or one of its teams is assigned to the store (`ContractorStoreService`); the stores pages use `/api/inventory/contractors` (the administrator-only contractor API gave store people an empty list).

**Update:** the Stores Executive is the Stores Manager's *deputy*: it also holds `inventory.approve` (approve and reject requests, approve MRN, wastage and stock takes; the maker still cannot approve their own), `scope.inventory.all` (every store) and `inventory.master`. When there is no Manager the Executive, not the Procurement Officer, passes the main store gates. `inventory.master` (item master, stores, initial stock, virtual swap, legacy reconciliation) and `inventory.grn` (also emergency purchases) are not the officers'.

## Petty cash of a site office (custodian and Area Manager)

- **The box belongs to a site office** (an inventory store), not to an OPMC/RTOM; one site office can cover several RTOMs. One box and one float per site office and type.
- **`petty-cash.site`** (new capability): work the petty cash of a site office. Default holders: the site office roles (`SITE_OFFICE_STAFF`, `OFFICE_ADMIN`, `OFFICE_ADMIN_ASSISTANT`), `AREA_MANAGER`, and the finance roles that watch and fund it. The capability alone opens no box: which box a person sees comes from the relationship below.
- **Custodian** (`PettyCashCustodian`): the finance approver names, for each box, who looks after it, from the people registered at that site office. A custodian records and cancels bills, asks for replenishment and sees only that box. A role without `petty-cash.site` cannot be chosen.
- **Area Manager of a site office** (`InventoryStore.areaManagerId`): set when the Area Manager is registered (the site offices the person covers). A site office has one ARM; a person who is no longer an active Area Manager covers nothing.
- **Release of cash** (a bill, or cash for an IOU on a petty cash float of a site office that keeps a box) is approved or rejected only by that site office's ARM, never by the person who asked, and there is **no Finance Manager step**. A site office without an ARM releases nothing. A box made before site offices keeps the finance approval. Replenishment and the float stay with Head Office funding.
- Visibility: people with company-wide finance scope see every box; a custodian or an ARM without a finance reading capability sees only the boxes they look after or are the ARM of.

## How to add a page, an approval or a menu entry (checklist for developers and AI assistants)

One rule: **the menu, the page and the API decide by the same capability code. A role name is never written in runtime code.**
The tests in `tests/unit/authorization-rules.test.ts` and `tests/unit/menu-page-reach.test.ts` fail when this is broken.

1. **Pick or add the capability** in `src/config/rbac-permissions.ts` (the key in `RBAC_PERMISSIONS` and a line in `RBAC_PERMISSION_DEFINITIONS`). Reuse a capability when the same people do the same thing.
2. **Give the starting grants** in `src/config/rbac-bootstrap.ts` (`CANONICAL_BOOTSTRAP_ROLE_GRANTS` by post, `MODULE_DESIGNATION_GRANTS` by designation). The deploy seed (`pnpm run rbac:seed`) writes them to the database. From then on the database is the truth: an administrator changes a grant on the Permissions page, and the next deploy seed resets the capabilities listed in the catalog to the bootstrap, so a lasting change belongs in the bootstrap file too.
3. **Guard the API**: `apiHandler({ permissions: [...] })` (any of the listed). Add the data scope (`resolveOpmcScope` and the like): a capability never grants all the data.
4. **Guard the page**: a rule in `src/config/page-capabilities.ts` (the longest prefix wins) and `RoleGuard`.
5. **Add the menu entry** in `src/config/sidebar-menu.ts` with `permissionId` set to a canonical capability. A leaf with no `permissionId` inherits its group's, which can hide a page from the people who may open it: set it on the leaf when the group's capability is broader or narrower.
6. **Menu levels** (what the person does in a module: view, operate, approve ...): the capability `menu.<module>.<level>`; an item says `module` and `level`. The starting levels per role are `BOOTSTRAP_MENU_LEVELS` in the bootstrap file; the menu reads only the capabilities.
7. **First page after sign-in** is `landingPath()` (`src/config/landing.ts`), from capabilities.
8. **Run**: `pnpm exec tsc --noEmit`, `pnpm run test:unit`, `pnpm run rbac:check`, and `pnpm exec tsx scripts/zz-audit-pages.ts` (every menu entry against its page rule, per role). Update the system guide when a screen or rule of a guided module changes.

### Petty cash settlement (24 Nov 2026)

- The custodian asks for cash for a person (`POST /api/finance/petty-cash/ious`); the site office ARM approves; the cash leaves the box.
- The custodian settles an issued IOU with the bills handed in and the cash returned (`POST /api/finance/petty-cash/ious/settlement`). It is stored as
  `OspIouSettlementSubmission` (SUBMITTED); nothing is booked. The ARM verifies (`PATCH`, `VERIFY`): the bills become an approved bill of the box and the
  returned cash goes back into the box, in one transaction. `REJECT` needs a reason and sends it back. The person who submitted never verifies.
  Bills plus cash returned cannot exceed what is outstanding; extra spend is a separate bill.

## Automated notices and who receives them (25 Nov 2026)

- A notice is sent to an **audience**: a capability `notification.audience.*` (catalogue in `src/services/notification/notification-audiences.ts`). The recipients are the active users whose role holds it, or who carry an explicit override with it.
- A call that is about one area passes `opmcId`: only the members of the audience who work in that area get it. A call without `opmcId` reaches the whole audience, so a company-wide notice must go to a small audience of its own (the Monday digest: `OPS_DIGEST`).
- The administrator sees and changes the audiences on **Administration > Automated Reports & Alerts**. The seed leaves an audience that already has grants as the administrator set it; a new audience gets its starting grants from `rbac-bootstrap.ts`. `src/lib/rbac-seed-rules.ts` holds that rule.
- Adding a scheduled job or an audience: describe it in `src/config/automated-notices.ts` (`tests/unit/automated-notices.test.ts` fails otherwise).

### Reports by module, job level and area (25 Nov 2026)

- A scheduled report goes to the people who work in its **module** at a **job level** (the menu level capability `menu.<module>.<level>` of the role) or above, and, for an area report, in the **area** it is about (their own areas or their store's), plus the people who see every area (administrators, `scope.company.all`, `notification.global`).
- The default rule of each report is in `src/config/automated-notices.ts` (`rule`); the administrator changes it on Administration > Automated Reports & Alerts, and the change is kept in the system settings (`AUTOMATED_NOTICE_RULES`) and audited. A person with no area receives none of an area report: the page lists them.
- Send with `NoticeRulesService.notify(job, { title, message, ..., opmcId })` (`src/services/notification/notice-rules.service.ts`); pass `opmcId` when the report is about one area.

## Purchase order approval steps (removed 26 Nov 2026)

Purchase orders and large payments are approved in the HO ERP, not in Nexus. The capabilities `procurement.po.approve.l1/l2/l3` and `procurement.invoice.approve.executive` were removed from the catalog (the deploy seed drops their grants); recording an order needs `procurement.write`, approving a supplier invoice `finance.approve` (or the vendor voucher chain).

## HO payment capability (26 Nov 2026)

`procurement.ho.payment.record` is held only by the Finance-section designation HO_ACCOUNT_EXECUTIVE_FINANCE_ASSISTANT (Account Executive at HO) through `MODULE_DESIGNATION_GRANTS`; no base role holds it. It records HO's payments on OSP vendor payment vouchers (`/api/finance/payment-vouchers/:id/payments`). The maker and the approver of a voucher can never record its payment. The other two positions (OSP Account Officer, OSP Account Manager) are designations on the Finance Assistant and Finance Manager roles and use their roles' capabilities.

## Session policy (25 Nov 2026)

All limits are in `src/config/session-policy.ts`; nothing else may hold a copy (a test checks). Idle timeout 30 minutes and absolute lifetime 12 hours (NIST SP 800-63B AAL2), enforced on the server: the refresh token expires after the idle window and is replaced at every refresh (rotation, OAuth security BCP) with the original `authTime`, and the refresh route refuses once `authTime` is 12 hours old. The access token lives 15 minutes. The browser (`SessionManager`) warns 2 minutes before the idle time and signs out a tab that wakes after it. A password or role change bumps `tokenVersion` and ends every session at once. The page's own background polling is not activity: every refresh carries `x-idle-seconds` (how long the person has really been inactive) and the new refresh token ends one idle window after the last activity, so polling cannot keep an idle session alive. Reuse detection of rotated tokens is not implemented.
