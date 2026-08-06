/**
 * DEPRECATED: This is now only a template for creating new SystemRole records.
 * Runtime permissions are derived from SystemRole.permissions via sectionAssignments.
 * See: scripts/migrate-global-roles.ts for the migration that populated SystemRole from this.
 * 
 * Legacy default permissions per Postgres enum role — used only when creating
 * a brand new SystemRole that doesn't exist yet (edge case fallback).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
    SUPER_ADMIN: ['dashboard', 'service-orders', 'contractors', 'restore-requests', 'invoices', 'inventory', 'procurement', 'administration'],
    ADMIN: ['dashboard', 'service-orders', 'contractors', 'restore-requests', 'invoices', 'inventory', 'procurement', 'administration'],
    OSP_MANAGER: ['dashboard', 'service-orders', 'contractors'],
    AREA_MANAGER: ['dashboard', 'service-orders', 'contractors'],
    ENGINEER: ['dashboard', 'service-orders', 'contractors'],
    ASSISTANT_ENGINEER: ['dashboard', 'service-orders', 'contractors'],
    AREA_COORDINATOR: ['dashboard', 'service-orders', 'contractors'],
    QC_OFFICER: ['dashboard', 'service-orders', 'contractors'],
    MANAGER: ['dashboard', 'service-orders', 'contractors'],
    STORES_MANAGER: ['dashboard', 'inventory'],
    STORES_ASSISTANT: ['dashboard', 'inventory'],
    PROCUREMENT_OFFICER: ['dashboard', 'procurement'],
    FINANCE_MANAGER: ['dashboard', 'invoices'],
    FINANCE_ASSISTANT: ['dashboard', 'invoices'],
    INVOICE_MANAGER: ['dashboard', 'invoices'],
    INVOICE_ASSISTANT: ['dashboard', 'invoices'],
    SA_MANAGER: ['dashboard', 'restore-requests'],
    SA_ASSISTANT: ['dashboard', 'restore-requests'],
    OFFICE_ADMIN: ['dashboard', 'contractors', 'administration'],
    OFFICE_ADMIN_ASSISTANT: ['dashboard', 'contractors', 'administration'],
    SITE_OFFICE_STAFF: ['dashboard', 'contractors'],
    // Read-only reporting role (QA audit): dashboard + reports visibility is
    // granted via sidebar allowedRoles; no operational section permissions
    HEAD_OF_SECTION: ['dashboard']
};

/**
 * Allowlist of valid page-permission keys. Single source of truth for
 * API-side validation of SystemRole.permissions payloads (keep in sync with
 * PAGE_PERMISSIONS in the admin role UI).
 */
export const VALID_PERMISSION_KEYS: readonly string[] = [
    'dashboard',
    'service-orders',
    'contractors',
    'restore-requests',
    'invoices',
    'inventory',
    'procurement',
    'administration'
];

export const SECTION_MAPPING: Record<string, string[]> = {
    'OSP_MANAGER': ['PROJECTS'],
    'AREA_MANAGER': ['PROJECTS'],
    'ENGINEER': ['PROJECTS'],
    'ASSISTANT_ENGINEER': ['PROJECTS'],
    'AREA_COORDINATOR': ['PROJECTS'],
    'QC_OFFICER': ['PROJECTS'],
    'MANAGER': ['NEW_CONNECTION'],
    'SA_MANAGER': ['SERVICE_ASSURANCE'],
    'SA_ASSISTANT': ['SERVICE_ASSURANCE'],
    'STORES_MANAGER': ['STORES'],
    'STORES_ASSISTANT': ['STORES'],
    'PROCUREMENT_OFFICER': ['PROCUREMENT'],
    'FINANCE_MANAGER': ['FINANCE'],
    'FINANCE_ASSISTANT': ['FINANCE'],
    'INVOICE_MANAGER': ['INVOICE'],
    'INVOICE_ASSISTANT': ['INVOICE'],
    'OFFICE_ADMIN': ['OFFICE_ADMIN'],
    'OFFICE_ADMIN_ASSISTANT': ['OFFICE_ADMIN'],
    'SITE_OFFICE_STAFF': ['OFFICE_ADMIN'],
    'SUPER_ADMIN': ['ADMIN', 'PROJECTS', 'NEW_CONNECTION', 'SERVICE_ASSURANCE', 'STORES', 'PROCUREMENT', 'FINANCE', 'INVOICE', 'OFFICE_ADMIN'],
    'ADMIN': ['ADMIN', 'PROJECTS', 'NEW_CONNECTION', 'SERVICE_ASSURANCE', 'STORES', 'PROCUREMENT', 'FINANCE', 'INVOICE', 'OFFICE_ADMIN']
};
