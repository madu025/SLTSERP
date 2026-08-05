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
 * Recursively extract all path -> allowedRoles pairs from the menu tree.
 * Uses the TOP-LEVEL menu item's path prefix for enforcement (not sub-paths).
 */
function extractRoutePermissions(items: MenuItem[]): Map<string, string[]> {
    const map = new Map<string, string[]>();

    for (const item of items) {
        // Use the top-level path as the prefix for route guarding
        const prefix = getPrefixFromPath(item.path);
        if (prefix) {
            if (map.has(prefix)) {
                // MERGE roles when multiple menu items share the same prefix
                const existing = map.get(prefix)!;
                const merged = [...new Set([...existing, ...item.allowedRoles])];
                map.set(prefix, merged);
            } else {
                map.set(prefix, [...item.allowedRoles]);
            }
        }

        // Recurse into submenu and merge roles there too
        if (item.submenu) {
            for (const sub of item.submenu) {
                const subPrefix = getPrefixFromPath(sub.path);
                if (subPrefix) {
                    if (map.has(subPrefix)) {
                        const existing = map.get(subPrefix)!;
                        const merged = [...new Set([...existing, ...sub.allowedRoles])];
                        map.set(subPrefix, merged);
                    } else {
                        map.set(subPrefix, [...sub.allowedRoles]);
                    }
                }
            }
        }
    }

    return map;
}

/**
 * Extract the root prefix from a full path.
 * '/service-orders/work-order' -> '/service-orders'
 * '/dashboard' -> '/dashboard'
 * '/fleet/vehicles' -> '/fleet'
 */
function getPrefixFromPath(path: string): string | null {
    if (!path || path === '/') return null;
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    return '/' + segments[0];
}

// Build the permission map once at module load (singleton)
const permissionMap = extractRoutePermissions(SIDEBAR_MENU);

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
    // Super Admin always has access to everything
    if (userRole === 'SUPER_ADMIN') return true;

    // Find the matching prefix for this pathname
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return true;

    const prefix = '/' + segments[0];
    const allowedRoles = permissionMap.get(prefix);

    // No permission rule found -> allow any authenticated user
    if (!allowedRoles) return true;

    return allowedRoles.includes(userRole);
}
