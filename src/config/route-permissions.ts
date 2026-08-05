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
        if (prefix && !map.has(prefix)) {
            map.set(prefix, item.allowedRoles);
        }

        // Recurse into submenu but only register NEW prefixes
        if (item.submenu) {
            for (const sub of item.submenu) {
                const subPrefix = getPrefixFromPath(sub.path);
                if (subPrefix && !map.has(subPrefix)) {
                    map.set(subPrefix, sub.allowedRoles);
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
