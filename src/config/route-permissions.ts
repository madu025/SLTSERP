/**
 * Route-level RBAC enforcement for middleware.
 *
 * Sidebar metadata may provide a direct canonical permission, while page
 * capability rules cover menu entries that have not yet been annotated.
 * Legacy role arrays are never an allow decision.
 */

import { SIDEBAR_MENU } from './sidebar-menu';
import { resolveLegacyMenuPermission, resolvePageCapability } from './page-capabilities';
import { isCanonicalPermission } from './rbac-permissions';

/**
 * Check whether a session has the canonical capability for a page pathname.
 * The role argument is retained only for middleware call-site compatibility;
 * it never grants access.
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
 * Resolve the canonical permissionId for an exact sidebar path.
 */
export function getMenuPermissionForPath(pathname: string): string | undefined {
    const findPermissionId = (
        items: Array<(typeof SIDEBAR_MENU)[number]>,
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
