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
- Routes still carrying a legacy `roles:` option receive a module capability
  from `src/lib/route-capabilities.ts` once the session has canonical DB
  permissions; the legacy role list is then only a compatibility fallback.
- Dynamic pages: use `RoleGuard allowedRoles={[]} permissionId={...}`.
- Sidebar and middleware: use `permissionId` with an empty legacy role list
  for migrated modules.
- Resource endpoints must additionally call `assertProjectAccess` or the
  appropriate OPMC scope helper.
- Frontend visibility is convenience only; API/service authorization is
  mandatory.

## Migration rule

`ROLE_GROUPS` is a legacy compatibility/bootstrap mechanism only. It may be
used by modules that have not migrated yet, but new routes, pages, menu items,
and services must not add role names. Add a permission definition, seed the
DB grant, and guard with the permission code instead.

Direct `User.permissions` is an explicit administrator override. When it is
non-null it intentionally replaces inherited role permissions, so it must be
changed only through the admin permission workflow and audited.

## Verification checklist

### Project finance controls

`project.finance.read/write/approve/assign` separate financial visibility,
preparation, approval/posting, and team accountability management. Each still
requires the project OPMC boundary. Finance assignments record responsibility;
they do not grant capabilities or expand OPMC scope. OPMC-wide finance oversight
remains permission-based, not restricted to the assignment list.

Client invoice collections use CustomerReceipt, never outgoing payment vouchers.
Submission and settlement are distinct dimensions. Completion requires a
submitted client invoice with PAID settlement, zero balance, and sufficient
received funds. Collection and transition writes lock the invoice row within
their transaction; receipt bank references prevent duplicate settlement retries.

Before merging an authorization change:

1. Confirm the permission code exists in the catalog and DB seed.
2. Confirm the route/page uses the same permission code.
3. Confirm OPMC/area scope is enforced in the service query and mutation.
4. Test allow/deny for a shared manager, an OSP-only role, and an unassigned
   user.
5. Run `pnpm run rbac:check`, `pnpm run rbac:seed` when grants change,
   `pnpm run test:unit`, `pnpm run test:types`, and `pnpm run build`.
