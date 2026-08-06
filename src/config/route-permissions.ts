/**
 * Route-level RBAC enforcement for middleware.
 * DYNAMICALLY extracts path -> allowedRoles from the SIDEBAR_MENU config.
 * No separate hardcoded mapping -- the sidebar IS the single source of truth.
 *
 * Paths not present in the sidebar menu are accessible to any authenticated user.
 */

import { SIDEBAR_MENU, MenuItem } from './sidebar-menu';

interface RoutePermission {
    prefix: string;
    allowedRoles: string[];
}

/**
 * Recursively extract path -> allowedRoles pairs from the FULL menu tree
 * (top-level AND every submenu level). Keys are the item's own path so
 * submenu restrictions are preserved — longest-prefix match at lookup time
 * picks the most specific rule.
 */
function extractRoutePermissions(items: MenuItem[]): Map<string, string[]> {
    const map = new Map<string, string[]>();

    const add = (path: string, roles: string[]) => {
        if (!path || path === '/') return;
        const existing = map.get(path);
        // MERGE roles when multiple menu items declare the same path
        map.set(path, existing ? [...new Set([...existing, ...roles])] : [...roles]);
    };

    const walk = (list: MenuItem[]) => {
        for (const item of list) {
            add(item.path, item.allowedRoles);
            if (item.submenu) walk(item.submenu);
        }
    };
    walk(items);

    return map;
}

// Build the permission map once at module load (singleton)
const permissionMap = extractRoutePermissions(SIDEBAR_MENU);

// Pre-sorted by path length descending so the first prefix hit is the most specific
const sortedPrefixes: RoutePermission[] = [...permissionMap.entries()]
    .map(([prefix, allowedRoles]) => ({ prefix, allowedRoles }))
    .sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Resolve the allowedRoles of an EXACT menu path (including submenu items).
 * Lets server actions derive their authorization from the same sidebar config
 * that drives route-level RBAC — single source of truth, zero duplication.
 * Returns null when the path is not declared in the sidebar menu.
 */
export function getMenuAllowedRoles(path: string): string[] | null {
    const search = (items: MenuItem[]): string[] | null => {
        for (const item of items) {
            if (item.path === path) return item.allowedRoles;
            if (item.submenu) {
                const found = search(item.submenu);
                if (found) return found;
            }
        }
        return null;
    };
    return search(SIDEBAR_MENU);
}

/**
 * Check if a given role has access to a specific pathname.
 * Returns true if access is allowed, false otherwise.
 * Paths not in the sidebar menu are allowed for any authenticated user.
 */
export function hasRouteAccess(pathname: string, userRole: string): boolean {
    // Super Admin & Admin always have access to everything. Mirrors the
    // hasAccess sidebar bypass so visible items are never blocked on click.
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return true;

    const normalized = pathname.split('?')[0].replace(/\/+$/, '') || '/';

    // LONGEST-prefix match over the full menu path map so submenu-level
    // restrictions win over their parent section's broader rule
    const rule = sortedPrefixes.find(
        (p) => normalized === p.prefix || normalized.startsWith(p.prefix + '/')
    );

    // No permission rule found -> allow any authenticated user
    if (!rule) return true;

    // Misconfiguration guard: an empty allowedRoles list denies everyone
    // (consistent with apiHandler fail-closed policy)
    if (rule.allowedRoles.length === 0) return false;

    // 'ALL' wildcard = every authenticated role
    if (rule.allowedRoles.includes('ALL')) return true;

    return rule.allowedRoles.includes(userRole);
}
