/**
 * Canonical capability catalog.
 *
 * These are application capabilities, not organization-specific role names.
 * Role-to-capability assignments live in PermissionDefinition/RolePermission
 * records. OPMC/area restrictions are evaluated separately by the scope layer.
 */
export const RBAC_PERMISSIONS = {
    DASHBOARD_READ: 'dashboard.read',
    SOD_READ: 'sod.read',
    SOD_WRITE: 'sod.write',
    SOD_INVOICE: 'sod.invoice',
    PROJECT_READ: 'project.read',
    PROJECT_WRITE: 'project.write',
    PROJECT_APPROVE: 'project.approve',
    PROJECT_PLAN_READ: 'project.plan.read',
    PROJECT_PLAN_WRITE: 'project.plan.write',
    PROJECT_PLAN_APPROVE: 'project.plan.approve',
    FINANCE_READ: 'finance.read',
    FINANCE_WRITE: 'finance.write',
    FINANCE_APPROVE: 'finance.approve',
    FINANCE_AUDIT: 'finance.audit',
    INVENTORY_READ: 'inventory.read',
    INVENTORY_WRITE: 'inventory.write',
    INVENTORY_APPROVE: 'inventory.approve',
    PROCUREMENT_READ: 'procurement.read',
    PROCUREMENT_WRITE: 'procurement.write',
    CONTRACTOR_READ: 'contractor.read',
    CONTRACTOR_WRITE: 'contractor.write',
    ADMIN_RBAC: 'admin.rbac',
} as const;

export type RbacPermission = typeof RBAC_PERMISSIONS[keyof typeof RBAC_PERMISSIONS];

export const RBAC_PERMISSION_DEFINITIONS = [
    { code: RBAC_PERMISSIONS.DASHBOARD_READ, module: 'DASHBOARD', action: 'READ', scope: 'GLOBAL', description: 'View the user dashboard' },
    { code: RBAC_PERMISSIONS.SOD_READ, module: 'SOD', action: 'READ', scope: 'OPMC', description: 'Read service orders within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.SOD_WRITE, module: 'SOD', action: 'WRITE', scope: 'OPMC', description: 'Create or update service orders within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.SOD_INVOICE, module: 'SOD', action: 'INVOICE', scope: 'OPMC', description: 'Verify and invoice service orders within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.PROJECT_READ, module: 'PROJECT', action: 'READ', scope: 'OPMC', description: 'Read projects within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.PROJECT_WRITE, module: 'PROJECT', action: 'WRITE', scope: 'OPMC', description: 'Modify projects within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.PROJECT_APPROVE, module: 'PROJECT', action: 'APPROVE', scope: 'OPMC', description: 'Approve project workflow actions within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.PROJECT_PLAN_READ, module: 'PROJECT', action: 'PLAN_READ', scope: 'OPMC', description: 'Read project task plans within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.PROJECT_PLAN_WRITE, module: 'PROJECT', action: 'PLAN_WRITE', scope: 'OPMC', description: 'Configure project task plans within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.PROJECT_PLAN_APPROVE, module: 'PROJECT', action: 'PLAN_APPROVE', scope: 'OPMC', description: 'Approve and generate project task plans within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.FINANCE_READ, module: 'FINANCE', action: 'READ', scope: 'OPMC', description: 'Read finance data within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.FINANCE_WRITE, module: 'FINANCE', action: 'WRITE', scope: 'OPMC', description: 'Modify finance data within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.FINANCE_APPROVE, module: 'FINANCE', action: 'APPROVE', scope: 'OPMC', description: 'Approve finance workflows within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.FINANCE_AUDIT, module: 'FINANCE', action: 'AUDIT', scope: 'OPMC', description: 'Perform finance and contractor invoice audit actions within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.INVENTORY_READ, module: 'INVENTORY', action: 'READ', scope: 'OPMC', description: 'Read inventory data within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.INVENTORY_WRITE, module: 'INVENTORY', action: 'WRITE', scope: 'OPMC', description: 'Modify inventory data within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.INVENTORY_APPROVE, module: 'INVENTORY', action: 'APPROVE', scope: 'OPMC', description: 'Approve inventory workflows within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.PROCUREMENT_READ, module: 'PROCUREMENT', action: 'READ', scope: 'OPMC', description: 'Read procurement data within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.PROCUREMENT_WRITE, module: 'PROCUREMENT', action: 'WRITE', scope: 'OPMC', description: 'Modify procurement data within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.CONTRACTOR_READ, module: 'CONTRACTOR', action: 'READ', scope: 'OPMC', description: 'Read contractor data within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.CONTRACTOR_WRITE, module: 'CONTRACTOR', action: 'WRITE', scope: 'OPMC', description: 'Submit contractor portal work, stock, and return actions within the assigned OPMC scope' },
    { code: RBAC_PERMISSIONS.ADMIN_RBAC, module: 'ADMIN', action: 'RBAC', scope: 'GLOBAL', description: 'Manage users, roles, permission grants, and scope assignments' },
] as const;

export const RBAC_PERMISSION_CODES = RBAC_PERMISSION_DEFINITIONS.map((item) => item.code);
export const RBAC_PERMISSION_SET = new Set<string>(RBAC_PERMISSION_CODES);

export function isCanonicalPermission(value: string): value is RbacPermission {
    return RBAC_PERMISSION_SET.has(value);
}
