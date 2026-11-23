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
    // The four chain stages are checked by the API per order; the page only needs a signed-in dashboard user
    { prefix: '/service-orders/approvals', permission: RBAC_PERMISSIONS.DASHBOARD_READ },
    { prefix: '/projects/dashboards/financials', permission: RBAC_PERMISSIONS.PROJECT_FINANCE_DASHBOARD },
    { prefix: '/service-orders/invoice-status', permission: RBAC_PERMISSIONS.INVOICE_STATUS_READ },
    { prefix: '/service-orders/invoicable', permission: RBAC_PERMISSIONS.SOD_INVOICE },
    { prefix: '/service-orders/invoicing', permission: RBAC_PERMISSIONS.SOD_INVOICE },
    { prefix: '/service-orders/material-deviation', permission: RBAC_PERMISSIONS.SOD_INVOICE },
    { prefix: '/service-orders', permission: RBAC_PERMISSIONS.SOD_READ },
    // The four confirmation stages are separate capabilities (checked by the API); the page itself only needs a signed-in user
    { prefix: '/invoices/confirmations', permission: RBAC_PERMISSIONS.DASHBOARD_READ },
    { prefix: '/invoices/osp-approvals', permission: RBAC_PERMISSIONS.INVOICE_OSP_APPROVE },
    { prefix: '/invoices', permission: RBAC_PERMISSIONS.SOD_INVOICE },
    { prefix: '/projects', permission: RBAC_PERMISSIONS.PROJECT_READ },
    { prefix: '/inventory/grn', permission: RBAC_PERMISSIONS.INVENTORY_GRN },
    { prefix: '/inventory/admin/wastage', permission: RBAC_PERMISSIONS.INVENTORY_ADJUST },
    { prefix: '/inventory/admin/initial', permission: RBAC_PERMISSIONS.INVENTORY_APPROVE },
    { prefix: '/inventory/admin/virtual-swap', permission: RBAC_PERMISSIONS.INVENTORY_APPROVE },
    { prefix: '/inventory/admin/pre-erp-reconciliation', permission: RBAC_PERMISSIONS.INVENTORY_APPROVE },
    { prefix: '/inventory', permission: RBAC_PERMISSIONS.INVENTORY_READ },
    { prefix: '/procurement/orders', permission: RBAC_PERMISSIONS.PROCUREMENT_WRITE },
    { prefix: '/procurement', permission: RBAC_PERMISSIONS.PROCUREMENT_READ },
    { prefix: '/helpdesk/tickets/new', permission: RBAC_PERMISSIONS.HELPDESK_TICKET_CREATE },
    { prefix: '/helpdesk/assets/audits', permission: RBAC_PERMISSIONS.HELPDESK_APPROVE },
    // fleet payments are the office staff's: the managers see vehicles, drivers and trips, not the payments
    { prefix: '/fleet/payments', permission: RBAC_PERMISSIONS.FLEET_WRITE },
    { prefix: '/fleet/vehicles/new', permission: RBAC_PERMISSIONS.FLEET_WRITE },
    { prefix: '/fleet/trips/new', permission: RBAC_PERMISSIONS.FLEET_WRITE },
    { prefix: '/fleet', permission: RBAC_PERMISSIONS.FLEET_READ },
    { prefix: '/helpdesk/assets', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    // the User Portal (own tickets) is for everyone who may raise a ticket; the IT queue, telemetry, SLA, licences, reports and asset pages are IT staff's
    { prefix: '/helpdesk', permission: RBAC_PERMISSIONS.HELPDESK_TICKET_CREATE },
    { prefix: '/helpdesk/admin', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/helpdesk/telemetry', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/helpdesk/sla-monitor', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/helpdesk/software-licenses', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/helpdesk/reports', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/helpdesk/depreciation', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/helpdesk/disposals', permission: RBAC_PERMISSIONS.HELPDESK_WRITE },
    { prefix: '/reports', permission: RBAC_PERMISSIONS.REPORTS_READ },
    // the company-wide executive overview is for the company managers; the Area Manager has the area performance report
    { prefix: '/reports/manager', permission: RBAC_PERMISSIONS.REPORTS_MANAGER_READ },
    { prefix: '/reports/arm', permission: RBAC_PERMISSIONS.REPORTS_AREA_READ },
    { prefix: '/finance/vendors/import', permission: RBAC_PERMISSIONS.ADMIN_RBAC },
    { prefix: '/finance/banks/import', permission: RBAC_PERMISSIONS.ADMIN_RBAC },
    { prefix: '/finance/sf-audit', permission: RBAC_PERMISSIONS.FINANCE_AUDIT },
    { prefix: '/finance/invoice-dispatch', permission: RBAC_PERMISSIONS.FINANCE_WRITE },
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

