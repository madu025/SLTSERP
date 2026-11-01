---
name: rbac-scope
description: Implement or review SLTSERP canonical permissions, OPMC/project/store scope, and maker-checker approval boundaries.
metadata:
  short-description: Enforce capability and data scope separately
---

# RBAC and scope

Use for routes, pages, sidebar entries, services, workflow stages, approvals,
Project Finance, Inventory, or any multi-tenant read/write operation.

- Read `docs/authorization-architecture.md` and `src/config/rbac-permissions.ts`
  before changing authorization.
- Use `apiHandler({ permissions: [...] })`, `RoleGuard`/`permissionId`,
  `resolveOpmcScope`, `assertProjectAccess`, and
  `StoreService.assertStoreWriteAccess` at the appropriate boundary.
- Treat `PermissionDefinition` + `RolePermission` as authoritative. Legacy
  `User.role` and display role labels are compatibility data only.
- Keep capability separate from data scope. `undefined` scope is global admin,
  `[]` denies all, and a non-empty list is an exact allowlist.
- Bind approval actors to the authenticated session; reject self-approval and
  client-supplied identity/role selectors.

Add or update catalog, seed, admin UI, guards, frontend guards, tests, and the
architecture document together when adding a capability. Test allow, deny,
cross-scope, inactive-role, and direct-override cases.
