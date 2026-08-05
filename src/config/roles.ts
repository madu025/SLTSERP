
/**
 * UI grouping of user roles for Administration dropdowns (user create/edit,
 * category pages). Served by GET /api/admin/role-options alongside the live
 * enum values. Roles absent from this map fall into "Other" on the client —
 * so new enum values never disappear from the UI.
 */
export const ROLE_CATEGORIES: Record<string, string[]> = {
    'System Admin': ['SUPER_ADMIN', 'ADMIN'],
    'Main Management': ['CEO', 'HEAD_OF_OSP', 'HEAD_OF_SECTION', 'OSP_MANAGER', 'MANAGER'],
    'OSP & Operations': ['AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER'],
    'Stores & Inventory': ['STORES_MANAGER', 'STORES_ASSISTANT'],
    'Finance': ['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER'],
    'Invoice Section': ['INVOICE_MANAGER', 'INVOICE_ASSISTANT'],
    'Service Assurance': ['SA_MANAGER', 'SA_ASSISTANT', 'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN'],
    'SF Audit Section': ['SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER', 'RATE_AUDITOR'],
    'Office Admin': ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    'Procurement': ['PROCUREMENT_OFFICER']
};

export const ROLE_GROUPS = {
    // Super-admin only tier (destructive / privilege-granting operations)
    SUPER_ADMINS: ['SUPER_ADMIN'],
    // Core administration pair
    CORE_ADMINS: ['SUPER_ADMIN', 'ADMIN'],

    // Executive Leadership Tier
    EXECUTIVES: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'],
    ADMINS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'],
    OPS: ['OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],

    // Department Roles (From sidebar-menu)
    SOD_PROJECT: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
    SA_PROJECT: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'SA_MANAGER', 'SA_ASSISTANT', 'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN'],
    OSP_PROJECTS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR', 'CABLE_SPLICER', 'ENGINEER'],
    FINANCE: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER'],
    STORES: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'STORES_MANAGER', 'STORES_ASSISTANT'],
    SF_INVOICING: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER'],
    INVOICE: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER'],
    SF_AUDITING: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER', 'RATE_AUDITOR', 'FINANCE_MANAGER'],
    PROCUREMENT: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'PROCUREMENT_OFFICER'],
    NEW_CONNECTION: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER'],
    SERVICE_ASSURANCE: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'SA_MANAGER', 'SA_ASSISTANT'],
    ALL_OPS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'SA_MANAGER', 'SA_ASSISTANT', 'OSP_ENGINEER'],

    // Presets for cross-functional operations
    FINANCE_APPROVERS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'STORES_MANAGER'],
    FINANCE_ALL: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT'],
    STORES_MANAGERS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'HEAD_OF_OSP'],
    STORES_ALL: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'STORES_MANAGER', 'STORES_ASSISTANT'],
    PROJECT_MANAGERS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER'],
    MATERIAL_REQUESTERS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'STORES_MANAGER', 'STORES_ASSISTANT', 'PROCUREMENT_OFFICER', 'CONTRACTOR_SUPERVISOR'],
    PURCHASE_ORDER_MANAGERS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 'PROCUREMENT_OFFICER'],
    AREA_MANAGERS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'AREA_MANAGER'],
    SF_AUDITORS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'FINANCE_MANAGER', 'SF_AUDIT_OFFICER', 'SF_AUDIT_MANAGER', 'RATE_AUDITOR'],
    OFFICE_ADMINS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF'],
    CONTRACTORS: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE'],

    // SLT portal bridge / BOM registry sync endpoints
    SLT_REGISTRY_ADMINS: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER'],
    BOM_IMPORT_ADMINS: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'STORES_MANAGER'],
    // Office / IT asset management (EAM)
    EAM_ASSET_MANAGERS: ['SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN'],
    // Read-only report viewers across all stores/areas (QA audit scope) —
    // intentionally excluded from all store/inventory operational groups
    SECTION_HEADS: ['HEAD_OF_SECTION'],

    // Union of every page that can trigger contractor invoice generation
    // (/invoices + /service-orders/invoicable) — composed from existing groups
    INVOICE_GENERATORS: [
        ...['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'],
        ...['INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'AR_OFFICER'],
        ...['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER'],
        ...['OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER'],
        'MANAGER'
    ],

    // Contractor data read scopes
    CONTRACTOR_READERS: [
        'SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT',
        'OSP_MANAGER', 'AREA_MANAGER', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT',
        'SITE_OFFICE_STAFF', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR',
        'MANAGER', 'QC_OFFICER', 'STORES_MANAGER',
        'CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE'
    ],
    CONTRACTOR_TEAM_READERS: [
        'SUPER_ADMIN', 'ADMIN', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT',
        'OSP_MANAGER', 'AREA_MANAGER', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT',
        'SITE_OFFICE_STAFF', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR',
        'MANAGER', 'QC_OFFICER'
    ],
};

export type RoleGroup = keyof typeof ROLE_GROUPS;

/**
 * Contractor portal roles — single shared definition so client role checks
 * (sidebar, login redirect, RoleGuard) never drift apart.
 */
export const CONTRACTOR_ROLES = ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE'] as const;

export function isContractorRole(role: string | null | undefined): boolean {
    return !!role && (CONTRACTOR_ROLES as readonly string[]).includes(role);
}

/** Stores operational roles — shared by login redirect and stores-scoped checks */
export const STORES_ROLES = ['STORES_MANAGER', 'STORES_ASSISTANT'] as const;

export function isStoresRole(role: string | null | undefined): boolean {
    return !!role && (STORES_ROLES as readonly string[]).includes(role);
}

export function hasRole(userRole: string | undefined | null, roleGroup: string[]): boolean {
    if (!userRole) return false;
    return roleGroup.includes(userRole);
}
