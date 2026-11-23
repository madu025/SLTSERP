/**
 * Rules for creating and listing users (Administration > Users). Client-safe: no server imports.
 *
 * Authorization never comes from this file. A user's access comes from the SystemRole in User.roleId (the base role),
 * the module designations in UserSectionAssignment, and the OPMC allow-list (see docs/authorization-architecture.md).
 */
import { ROLE_CATEGORIES, isContractorRole } from '@/config/roles';

/** Statuses an administrator may set. 'deleted' is only set by the delete action. */
export const USER_STATUSES = ['active', 'inactive', 'resigned'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<string, string> = {
    active: 'Active (full access)',
    inactive: 'Inactive (disabled)',
    resigned: 'Resigned / terminated',
    deleted: 'Deleted',
};

/** The database holds 'ACTIVE' for a few old accounts: compare statuses through this, never with ===. */
export function normalizeUserStatus(value: string | null | undefined): string {
    const v = (value ?? '').trim().toLowerCase();
    return v || 'active';
}

export function isActiveStatus(value: string | null | undefined): boolean {
    return normalizeUserStatus(value) === 'active';
}

/**
 * Roles whose data is scoped by OPMC/RTOM. With no OPMC assigned they see and change nothing (the server scope is
 * deny-all, see resolveOpmcScope), so creating them without a region is always a mistake. Company-wide roles (admin,
 * management, finance, invoice, SF audit, procurement) and contractor users are not listed.
 */
export const OPMC_REQUIRED_ROLES: readonly string[] = [
    'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'OSP_ENGINEER',
    'CIVIL_SUPERVISOR', 'CABLE_SPLICER', 'MANAGER', 'SA_MANAGER', 'SA_ASSISTANT', 'FAULT_COORDINATOR', 'REPAIR_TECHNICIAN',
    'SITE_OFFICE_STAFF', 'OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT',
];

export function roleNeedsOpmc(role: string | null | undefined): boolean {
    return !!role && !isContractorRole(role) && OPMC_REQUIRED_ROLES.includes(role);
}

/** Store staff work through the store they are assigned to; they need a store or a region. */
export function roleNeedsStoreOrOpmc(role: string | null | undefined): boolean {
    return role === 'STORES_MANAGER' || role === 'STORES_ASSISTANT';
}

/** Department tabs of the user list, built from the same role groups the role picker uses. */
export const USER_DEPARTMENTS: Array<{ id: string; label: string; roles: string[] }> = [
    { id: 'OSP', label: 'OSP & Operations', roles: [...ROLE_CATEGORIES['OSP & Operations'], ...ROLE_CATEGORIES['OSP Project'], 'OSP_MANAGER', 'MANAGER'] },
    { id: 'STORES', label: 'Stores & Inventory', roles: ROLE_CATEGORIES['Stores & Inventory'] },
    { id: 'FINANCE', label: 'Finance & Invoicing', roles: [...ROLE_CATEGORIES.Finance, ...ROLE_CATEGORIES['Invoice Section'], ...ROLE_CATEGORIES['SF Audit Section'], ...ROLE_CATEGORIES.Procurement] },
    { id: 'ADMIN', label: 'System Admins', roles: ROLE_CATEGORIES['System Admin'] },

];

/** Contractor logins belong to the contractor registration (Contractors module); the staff list leaves them out unless asked. */
export const CONTRACTOR_LOGIN_ROLES = ['CONTRACTOR_SUPERVISOR', 'CONTRACTOR_TECHNICIAN', 'CONTRACTOR_FINANCE'] as const;

export function departmentRoles(id: string): string[] | null {
    return USER_DEPARTMENTS.find((d) => d.id === id)?.roles ?? null;
}

// ---------- password policy (create, edit and reset all use this one rule) ----------
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_RULE_TEXT = `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`;

/** Returns the reason a password is refused, or null when it is acceptable. */
export function passwordProblem(password: string | null | undefined): string | null {
    const p = password ?? '';
    if (p.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
    if (p.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters long`;
    if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Password must contain at least one letter and one number';
    return null;
}

/** A readable one-time password for the administrator to hand over (no look-alike characters). Works in the browser and on the server. */
export function generateTemporaryPassword(length = 12): string {
    const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
    const digits = '23456789';
    const all = letters + digits;
    const bytes = new Uint32Array(length);
    globalThis.crypto.getRandomValues(bytes);
    const chars = Array.from(bytes, (b) => all[b % all.length]);
    // guarantee one letter and one digit
    chars[0] = letters[bytes[0] % letters.length];
    chars[1] = digits[bytes[1] % digits.length];
    return chars.join('');
}

/**
 * The base role a module designation belongs to: its code is SECTION_ROLE (PROJECTS_ENGINEER belongs to ENGINEER, PROJECTS_ASSISTANT_ENGINEER to
 * ASSISTANT_ENGINEER). A designation that is not of that form (REGIONAL_GENERAL_MANAGER) belongs to no role and suits anyone.
 * A person may only hold the designations of their own base role, or those of no role: a Finance Assistant cannot be made a Projects Engineer.
 */
export function designationRoleOf(code: string, sectionCode: string, roles: readonly string[]): string | null {
    const prefix = sectionCode + '_';
    if (!code.startsWith(prefix)) return null;
    const rest = code.slice(prefix.length);
    return roles.includes(rest) ? rest : null;
}

export function designationFitsRole(code: string, sectionCode: string, baseRole: string, roles: readonly string[]): boolean {
    const owner = designationRoleOf(code, sectionCode, roles);
    return owner === null || owner === baseRole;
}

/** Section/designation roles (module designations) are the SystemRoles whose code is not a base Role value. */
export function isQaLeftoverRole(code: string): boolean {
    return /^QA\d+_/.test(code);
}
