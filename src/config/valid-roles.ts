// AUTO-GENERATED from prisma/schema/enums.prisma by scripts/rbac-sync.js — do not edit.
// Mirrors the Prisma Role enum so RBAC configs can be validated against the
// database-enforced role domain.

export const VALID_ROLES: ReadonlyArray<string> = [
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'HEAD_OF_OSP',
    'HEAD_OF_SECTION',
    'MANAGER',
    'OSP_MANAGER',
    'AREA_MANAGER',
    'ENGINEER',
    'ASSISTANT_ENGINEER',
    'AREA_COORDINATOR',
    'QC_OFFICER',
    'OFFICE_ADMIN',
    'OFFICE_ADMIN_ASSISTANT',
    'SITE_OFFICE_STAFF',
    'FINANCE_MANAGER',
    'FINANCE_ASSISTANT',
    'CASHIER',
    'INVOICE_MANAGER',
    'INVOICE_ASSISTANT',
    'STORES_MANAGER',
    'STORES_ASSISTANT',
    'SA_MANAGER',
    'SA_ASSISTANT',
    'PROCUREMENT_OFFICER',
    'CONTRACTOR_SUPERVISOR',
    'CONTRACTOR_TECHNICIAN',
    'CONTRACTOR_FINANCE',
    'OSP_ENGINEER',
    'CIVIL_SUPERVISOR',
    'CABLE_SPLICER',
    'FAULT_COORDINATOR',
    'REPAIR_TECHNICIAN',
    'SF_AUDIT_MANAGER',
    'SF_AUDIT_OFFICER',
    'RATE_AUDITOR',
    'AR_OFFICER'
] as const;

export const VALID_ROLE_SET: ReadonlySet<string> = new Set(VALID_ROLES);

export function isValidRole(role: string): boolean {
    return VALID_ROLE_SET.has(role);
}
