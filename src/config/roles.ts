/**
 * UI grouping of user roles for Administration dropdowns (user create/edit,
 * category pages). Served by GET /api/admin/role-options alongside the live
 * enum values. Roles absent from this map fall into "Other" on the client
 * so new enum values never disappear from the UI.
 *
 * Authorization does not use this file. Runtime access is resolved from the
 * canonical PermissionDefinition + RolePermission records.
 */
export const ROLE_CATEGORIES: Record<string, string[]> = {
    'System Admin': ['SUPER_ADMIN', 'ADMIN'],
    'Main Management': ['CEO', 'HEAD_OF_OSP', 'HEAD_OF_SECTION', 'OSP_MANAGER', 'MANAGER'],
    'OSP & Operations': ['AREA_MANAGER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
    'OSP Project': ['ENGINEER', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER'],
    'Stores & Inventory': ['STORES_MANAGER', 'STORES_ASSISTANT'],
    Finance: ['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER'],
    'Invoice Section': ['INVOICE_MANAGER', 'INVOICE_ASSISTANT'],
    'Service Assurance': ['SA_MANAGER', 'SA_ASSISTANT', 'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN'],
    'SF Audit Section': ['SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER', 'RATE_AUDITOR'],
    'Office Admin': ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    Procurement: ['PROCUREMENT_OFFICER'],
};

/**
 * Contractor portal segment used only for navigation/redirect UX after the
 * canonical permission guard has made the access decision.
 */
export const CONTRACTOR_ROLES = [
    'CONTRACTOR_SUPERVISOR',
    'CONTRACTOR_TECHNICIAN',
    'CONTRACTOR_FINANCE',
] as const;

export function isContractorRole(role: string | null | undefined): boolean {
    return !!role && (CONTRACTOR_ROLES as readonly string[]).includes(role);
}

/** Stores navigation segment used only after canonical permission checks. */
export const STORES_ROLES = ['STORES_MANAGER', 'STORES_ASSISTANT'] as const;

export function isStoresRole(role: string | null | undefined): boolean {
    return !!role && (STORES_ROLES as readonly string[]).includes(role);
}
