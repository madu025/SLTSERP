/**
 * Route-level RBAC enforcement for middleware. Sidebar metadata may provide a
 * direct canonical permission, while page capability rules cover unmigrated
 * menu entries. Legacy role arrays are never an allow decision.
 */

import { SIDEBAR_MENU, MenuItem } from './sidebar-menu';
import { resolveLegacyMenuPermission, resolvePageCapability } from './page-capabilities';
import { isCanonicalPermission } from './rbac-permissions';

/**
 * Recursively extract path -> allowedRoles pairs from the FULL menu tree
 * (top-level AND every submenu level). Keys are the item's own path so
 * submenu restrictions are preserved — longest-prefix match at lookup time
 * picks the most specific rule.
 */
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
 * Check if a given session has a canonical capability for a specific pathname.
 * Returns true if access is allowed, false otherwise.
 * Paths not in the sidebar menu are allowed for any authenticated user.
 *
 * @param pathname - The page path to check
 * @param _userRole - Retained for session compatibility; never grants access.
 * @param userPermissions - Effective canonical/legacy permissions from DB.
 *   Canonical permission IDs are authoritative for migrated menu entries.
 */
export function hasRouteAccess(pathname: string, _userRole: string, userPermissions?: string[]): boolean {
    const normalized = pathname.split('?')[0].replace(/\/+$/, '') || '/';
    const menuPermission = getMenuPermissionForPath(normalized);
    const canonicalPermission = menuPermission && isCanonicalPermission(menuPermission)
        ? menuPermission
        : resolvePageCapability(normalized) ?? menuPermission;
    return !!canonicalPermission && !!userPermissions?.includes(canonicalPermission);
}

/**
 * Resolve the permissionId for a given path by finding the most specific
 * menu item that matches. Returns undefined if no permissionId is found.
 */
export function getMenuPermissionForPath(pathname: string): string | undefined {
    const findPermissionId = (
        items: import('./sidebar-menu').MenuItem[],
        targetPath: string,
    ): string | undefined => {
        for (const item of items) {
            if (item.path === targetPath) return resolveLegacyMenuPermission(item.permissionId);
            if (item.submenu) {
                const found = findPermissionId(item.submenu, targetPath);
                if (found) return found;
            }
        }
        return undefined;
    };

    return findPermissionId(SIDEBAR_MENU, pathname);
}
