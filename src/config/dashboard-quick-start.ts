import { RBAC_PERMISSIONS } from './rbac-permissions';

/**
 * The dashboard of a person who holds no dashboard tab (no service order, project, procurement, finance or inventory view, no company
 * view): a short list of the places they work in, chosen by what they may do. Decided by capabilities only, never by role names.
 */
export interface QuickStartLink { title: string; description: string; href: string }

const LINKS: ReadonlyArray<QuickStartLink & { permission: string }> = [
    { permission: RBAC_PERMISSIONS.PETTY_CASH_SITE, title: 'Petty cash', description: 'The cash box of your site office: bills, cash released to people, settlements.', href: '/petty-cash' },
    { permission: RBAC_PERMISSIONS.HELPDESK_TICKET_CREATE, title: 'Raise a support ticket', description: 'Ask the IT help desk for help.', href: '/helpdesk/tickets/new' },
    { permission: RBAC_PERMISSIONS.HELPDESK_TICKET_CREATE, title: 'My tickets', description: 'The tickets you raised and where they stand.', href: '/helpdesk' },
    { permission: RBAC_PERMISSIONS.FLEET_READ, title: 'Vehicles and fleet', description: 'Vehicles, drivers and trips.', href: '/fleet/vehicles' },
    { permission: RBAC_PERMISSIONS.DASHBOARD_READ, title: 'Notifications', description: 'What needs your attention.', href: '/notifications' },
];

/** The capabilities that each give the person a tab on the dashboard. */
export const DASHBOARD_TAB_PERMISSIONS: readonly string[] = [
    RBAC_PERMISSIONS.REPORTS_MANAGER_READ,
    RBAC_PERMISSIONS.ADMIN_RBAC,
    RBAC_PERMISSIONS.SOD_READ,
    RBAC_PERMISSIONS.PROJECT_READ,
    RBAC_PERMISSIONS.PROCUREMENT_READ,
    RBAC_PERMISSIONS.FINANCE_READ,
    RBAC_PERMISSIONS.INVENTORY_READ,
];

export const hasDashboardTab = (permissions: readonly string[] | undefined | null): boolean => !!permissions?.some((p) => DASHBOARD_TAB_PERMISSIONS.includes(p));

export function quickStartLinks(permissions: readonly string[] | undefined | null): QuickStartLink[] {
    const held = new Set(permissions ?? []);
    return LINKS.filter((l) => held.has(l.permission)).map(({ title, description, href }) => ({ title, description, href }));
}
