import { ROLE_GROUPS, CONTRACTOR_ROLES } from './roles';

/**
 * Prefix-based default role guards for MUTATING API requests.
 *
 * Applied by apiHandler only when a route does not declare its own
 * `roles` / `menuPath` (explicit declarations always win). Longest prefix
 * match wins. This converts previously fail-open write namespaces into
 * fail-closed departmental baselines without touching every route file.
 */

/** Anyone who legitimately mutates project data (execution + finance + stores + field). */
const PROJECT_WRITERS = [...new Set([
    ...ROLE_GROUPS.SOD_PROJECT,
    ...ROLE_GROUPS.PROJECT_MANAGERS,
    ...ROLE_GROUPS.FINANCE,
    ...ROLE_GROUPS.SF_INVOICING,
    ...ROLE_GROUPS.STORES_ALL,
    ...ROLE_GROUPS.PROCUREMENT,
    ...CONTRACTOR_ROLES,
])];

/** GIS / survey writes — OSP + project teams + contractor field crews. */
const GIS_WRITERS = [...new Set([
    ...ROLE_GROUPS.SOD_PROJECT,
    ...ROLE_GROUPS.OSP_PROJECTS,
    ...CONTRACTOR_ROLES,
])];

/** Inventory writes — stores, procurement and finance approvers (+ section heads for report generation). */
const INVENTORY_WRITERS = [...new Set([
    ...ROLE_GROUPS.STORES_ALL,
    ...ROLE_GROUPS.PROCUREMENT,
    ...ROLE_GROUPS.FINANCE_APPROVERS,
    ...ROLE_GROUPS.SECTION_HEADS,
])];

export const PREFIX_WRITE_GUARDS: ReadonlyArray<{ prefix: string; roles: string[] }> = [
    { prefix: '/api/admin/', roles: ROLE_GROUPS.CORE_ADMINS },
    { prefix: '/api/projects/', roles: PROJECT_WRITERS },
    { prefix: '/api/gis/', roles: GIS_WRITERS },
    { prefix: '/api/inventory/', roles: INVENTORY_WRITERS },
];

/**
 * Resolve the default guard roles for a pathname (longest prefix match).
 * Returns undefined when no prefix applies — caller decides the fallback.
 */
export function getPrefixGuardRoles(pathname: string): string[] | undefined {
    let best: { prefix: string; roles: string[] } | null = null;
    for (const guard of PREFIX_WRITE_GUARDS) {
        if (pathname.startsWith(guard.prefix) && (!best || guard.prefix.length > best.prefix.length)) {
            best = guard;
        }
    }
    return best?.roles;
}

/**
 * Paths exempt from the forced-password-change lockdown. A user flagged
 * with mustChangePassword may only reach these endpoints until they rotate
 * their credentials.
 */
export const PASSWORD_CHANGE_EXEMPT_PATHS = new Set([
    '/api/profile/change-password',
    '/api/logout',
    '/api/login',
]);
