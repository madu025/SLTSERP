import { RBAC_PERMISSIONS } from './rbac-permissions';

/**
 * Where a person lands after signing in: decided by what the person may do, never by the name of a role.
 *  - the contractors own people (contractor.write, no service order access) land on the contractor portal;
 *  - the store people (the operate level of the inventory menu, no service order access) land on the inventory pages;
 *  - everyone else lands on the dashboard.
 * This only chooses the first page; every page and API still checks its own capability.
 */
export function landingPath(permissions: readonly string[] | undefined | null): string {
    const held = new Set(permissions ?? []);
    const noServiceOrders = !held.has(RBAC_PERMISSIONS.SOD_READ);
    if (held.has(RBAC_PERMISSIONS.CONTRACTOR_WRITE) && noServiceOrders) return '/contractor/dashboard';
    if (held.has(RBAC_PERMISSIONS.MENU_INVENTORY_OPERATE) && noServiceOrders) return '/inventory';
    return '/dashboard';
}
