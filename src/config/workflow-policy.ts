import { RBAC_PERMISSIONS, type RbacPermission } from './rbac-permissions';

/**
 * Bootstrap compatibility only.
 *
 * These mappings translate the old workflow role snapshot into a canonical
 * capability while policies are first materialised. Runtime authorization must
 * never use this map: it evaluates PermissionDefinition/RolePermission and
 * active SystemRole/section assignments from the database.
 */
const ROLE_CAPABILITY_DEFAULTS: Record<string, RbacPermission> = {
    ENGINEER: RBAC_PERMISSIONS.PROJECT_APPROVE,
    ASSISTANT_ENGINEER: RBAC_PERMISSIONS.PROJECT_APPROVE,
    AREA_MANAGER: RBAC_PERMISSIONS.PROJECT_APPROVE,
    OSP_MANAGER: RBAC_PERMISSIONS.PROJECT_APPROVE,
    HEAD_OF_OSP: RBAC_PERMISSIONS.PROJECT_APPROVE,
    QC_OFFICER: RBAC_PERMISSIONS.PROJECT_APPROVE,
    CEO: RBAC_PERMISSIONS.PROJECT_APPROVE,
    MANAGER: RBAC_PERMISSIONS.PROJECT_APPROVE,
    ADMIN: RBAC_PERMISSIONS.PROJECT_APPROVE,
    SUPER_ADMIN: RBAC_PERMISSIONS.PROJECT_APPROVE,
    FINANCE_MANAGER: RBAC_PERMISSIONS.FINANCE_APPROVE,
    STORES_MANAGER: RBAC_PERMISSIONS.INVENTORY_APPROVE,
    PROCUREMENT_OFFICER: RBAC_PERMISSIONS.PROCUREMENT_WRITE,
    CONTRACTOR: RBAC_PERMISSIONS.CONTRACTOR_WRITE,
};

export function workflowPermissionForRole(
    role: string,
    entityType?: string,
): RbacPermission | null {
    const normalizedRole = role.trim().replace(/_GLOBAL$/, '');
    if (entityType === 'MATERIAL_REQUEST' || entityType === 'STOCK_TRANSFER' || entityType === 'MRN' || entityType === 'GRN') {
        return RBAC_PERMISSIONS.INVENTORY_APPROVE;
    }
    if (entityType === 'PURCHASE_ORDER' || normalizedRole === 'PROCUREMENT_OFFICER') {
        return RBAC_PERMISSIONS.PROCUREMENT_WRITE;
    }
    if (entityType === 'SERVICE_ORDER') {
        return normalizedRole === 'CONTRACTOR'
            ? RBAC_PERMISSIONS.CONTRACTOR_WRITE
            : RBAC_PERMISSIONS.SOD_WRITE;
    }
    if (entityType === 'INVOICE') {
        return RBAC_PERMISSIONS.FINANCE_APPROVE;
    }
    return ROLE_CAPABILITY_DEFAULTS[normalizedRole] ?? null;
}

export function workflowEligibleRoles(role: string): string[] {
    const normalizedRole = role.trim().replace(/_GLOBAL$/, '');
    return normalizedRole ? [normalizedRole] : [];
}
