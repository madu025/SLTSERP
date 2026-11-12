import { RBAC_PERMISSIONS, type RbacPermission, isCanonicalPermission } from './rbac-permissions';

/**
 * Canonical capability resolver for page-level access.
 *
 * Sidebar role arrays are retained as presentation/bootstrap metadata while
 * pages migrate. They are never consulted by RoleGuard or middleware after a
 * capability is resolved here.
 */
const PAGE_RULES: ReadonlyArray<{ prefix: string; permission: RbacPermission }> = [
    { prefix: '/admin', permission: RBAC_PERMISSIONS.ADMIN_RBAC },
    { prefix: '/contractors/management', permission: RBAC_PERMISSIONS.ADMIN_RBAC },
    { prefix: '/contractor', permission: RBAC_PERMISSIONS.CONTRACTOR_READ },
    { prefix: '/contractors', permission: RBAC_PERMISSIONS.CONTRACTOR_READ },
    { prefix: '/service-orders/invoicable', permission: RBAC_PERMISSIONS.SOD_INVOICE },
    { prefix: '/service-orders/material-deviation', permission: RBAC_PERMISSIONS.SOD_INVOICE },
    { prefix: '/service-orders', permission: RBAC_PERMISSIONS.SOD_READ },
    { prefix: '/invoices', permission: RBAC_PERMISSIONS.SOD_INVOICE },
    { prefix: '/projects', permission: RBAC_PERMISSIONS.PROJECT_READ },
    { prefix: '/inventory/admin/initial', permission: RBAC_PERMISSIONS.INVENTORY_APPROVE },
    { prefix: '/inventory/admin/virtual-swap', permission: RBAC_PERMISSIONS.INVENTORY_APPROVE },
    { prefix: '/inventory/admin/pre-erp-reconciliation', permission: RBAC_PERMISSIONS.INVENTORY_APPROVE },
    { prefix: '/inventory', permission: RBAC_PERMISSIONS.INVENTORY_READ },
    { prefix: '/procurement/orders', permission: RBAC_PERMISSIONS.PROCUREMENT_WRITE },
    { prefix: '/procurement', permission: RBAC_PERMISSIONS.PROCUREMENT_READ },
    { prefix: '/helpdesk/tickets/new', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/helpdesk/assets/audits', permission: RBAC_PERMISSIONS.HELPDESK_APPROVE },
    { prefix: '/fleet/vehicles/new', permission: RBAC_PERMISSIONS.FLEET_WRITE },
    { prefix: '/fleet/trips/new', permission: RBAC_PERMISSIONS.FLEET_WRITE },
    { prefix: '/fleet', permission: RBAC_PERMISSIONS.FLEET_READ },
    { prefix: '/helpdesk/assets', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/helpdesk', permission: RBAC_PERMISSIONS.HELPDESK_READ },
    { prefix: '/reports', permission: RBAC_PERMISSIONS.REPORTS_READ },
    { prefix: '/finance/vendors/import', permission: RBAC_PERMISSIONS.ADMIN_RBAC },
    { prefix: '/finance/banks/import', permission: RBAC_PERMISSIONS.ADMIN_RBAC },
    { prefix: '/finance/sf-audit', permission: RBAC_PERMISSIONS.FINANCE_AUDIT },
    { prefix: '/finance/bank/reconciliation', permission: RBAC_PERMISSIONS.FINANCE_APPROVE },
    { prefix: '/finance/bank-reconciliation', permission: RBAC_PERMISSIONS.FINANCE_APPROVE },
    { prefix: '/finance/fpa-dashboard', permission: RBAC_PERMISSIONS.FINANCE_APPROVE },
    { prefix: '/finance/exchange-rates', permission: RBAC_PERMISSIONS.FINANCE_APPROVE },
    { prefix: '/finance/rate-matrix', permission: RBAC_PERMISSIONS.FINANCE_APPROVE },
    { prefix: '/finance/capex-opex', permission: RBAC_PERMISSIONS.PROJECT_FINANCE_READ },
    { prefix: '/finance/budget', permission: RBAC_PERMISSIONS.PROJECT_FINANCE_READ },
    { prefix: '/finance', permission: RBAC_PERMISSIONS.FINANCE_READ },
    { prefix: '/dashboard', permission: RBAC_PERMISSIONS.DASHBOARD_READ },
    // Personal pages every signed-in staff user needs; without a rule the route gate redirected them to /dashboard
    { prefix: '/profile', permission: RBAC_PERMISSIONS.DASHBOARD_READ },
    { prefix: '/notifications', permission: RBAC_PERMISSIONS.DASHBOARD_READ },
];

function normalizePath(pathname: string): string {
    const path = pathname.split('?')[0].replace(/\/+$/, '');
    return path || '/';
}
function matchesPrefix(pathname: string, prefix: string): boolean {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Resolve a page pathname to the most specific canonical capability. */
export function resolvePageCapability(pathname: string): RbacPermission | undefined {
    const normalized = normalizePath(pathname);
    return PAGE_RULES
        .filter((rule) => matchesPrefix(normalized, rule.prefix))
        .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.permission;
}

/** Translate old sidebar permission labels during the UI migration. */
export function resolveLegacyMenuPermission(value?: string): RbacPermission | undefined {
    if (!value) return undefined;
    if (isCanonicalPermission(value)) return value;

    const legacyMap: Record<string, RbacPermission> = {
        'contractor-portal': RBAC_PERMISSIONS.CONTRACTOR_READ,
        contractors: RBAC_PERMISSIONS.CONTRACTOR_READ,
        'sf-audit': RBAC_PERMISSIONS.FINANCE_AUDIT,
        inventory: RBAC_PERMISSIONS.INVENTORY_READ,
        procurement: RBAC_PERMISSIONS.PROCUREMENT_READ,
        'corporate-finance': RBAC_PERMISSIONS.FINANCE_READ,
        'finance-ops': RBAC_PERMISSIONS.FINANCE_WRITE,
        billing: RBAC_PERMISSIONS.SOD_INVOICE,
        'osp-account': RBAC_PERMISSIONS.FINANCE_READ,
        administration: RBAC_PERMISSIONS.ADMIN_RBAC,
        restore_requests: RBAC_PERMISSIONS.HELPDESK_READ,
    };

    return legacyMap[value];
}

