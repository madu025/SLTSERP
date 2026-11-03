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
