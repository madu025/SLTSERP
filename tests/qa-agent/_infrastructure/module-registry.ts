import type { TestRole } from './fixtures';

/**
 * Single source of truth for the module-by-module QA sweep.
 *
 * Each entry declares:
 *   - path: primary URL for the module's index page
 *   - subPaths: additional URLs that should be exercised
 *   - roles: which test roles should have full access
 *   - forbiddenRoles: which test roles must NOT have access (expect 403/redirect)
 *   - criticalSelectors: DOM nodes whose presence proves the page rendered
 *   - apiRoutes: API endpoints this module depends on
 *   - skip: optional reason to skip the entire module (e.g., missing seed data)
 */
export interface ModuleSpec {
    readonly name: string;
    readonly path: string;
    readonly subPaths?: readonly string[];
    readonly roles: readonly TestRole[];
    readonly forbiddenRoles?: readonly TestRole[];
    readonly criticalSelectors: readonly string[];
    readonly apiRoutes?: readonly string[];
    readonly skip?: string;
}

export const MODULES: Record<string, ModuleSpec> = {
    /* ── Phase 1: Smoke / low-risk ── */
    dashboard: {
        name: 'Dashboard',
        path: '/dashboard',
        roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'ENGINEER', 'OSP_MANAGER'],
        criticalSelectors: ['[role="tablist"]', 'a[href="/dashboard"]'],
        apiRoutes: ['/api/dashboard/stats'],
    },

    /* ── Phase 2: Admin + Profile ── */
    admin_users: {
        name: 'Admin Users',
        path: '/admin/users',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        forbiddenRoles: ['ENGINEER', 'STORES_MANAGER', 'OSP_MANAGER'],
        criticalSelectors: ['table', 'input[type="search"]'],
        apiRoutes: ['/api/users'],
    },

    admin_audit: {
        name: 'Admin Audit Log',
        path: '/admin/audit-logs',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        forbiddenRoles: ['ENGINEER', 'STORES_MANAGER'],
        criticalSelectors: ['table'],
        apiRoutes: ['/api/admin/audit-logs'],
    },

    admin_traffic: {
        name: 'Admin Traffic',
        path: '/admin/traffic',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        forbiddenRoles: ['ENGINEER', 'STORES_MANAGER'],
        criticalSelectors: ['table'],
    },

    profile: {
        name: 'User Profile',
        path: '/profile',
        roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'ENGINEER', 'OSP_MANAGER'],
        criticalSelectors: ['input[name="name"]', 'input[name="email"]'],
        apiRoutes: ['/api/profile', '/api/auth/change-password'],
    },

    /* ── Phase 3: Inventory + Finance ── */
    inventory_stock: {
        name: 'Inventory Stock',
        path: '/inventory/stock',
        roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'],
        // No page-level RoleGuard on inventory pages — gating is at the API layer,
        // so no forbiddenRoles can be asserted on navigation.
        criticalSelectors: ['table'],
        apiRoutes: ['/api/inventory/stock'],
    },

    inventory_grn: {
        name: 'Inventory GRN',
        path: '/inventory/grn',
        roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'],
        criticalSelectors: ['table'],
        apiRoutes: ['/api/inventory/grn'],
    },

    inventory_issues: {
        name: 'Inventory Issues',
        path: '/inventory/issues',
        roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER'],
        criticalSelectors: ['table'],
    },

    inventory_requests: {
        name: 'Stock Requests',
        path: '/inventory/requests',
        // Engineers legitimately create material requests from this page.
        roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'ENGINEER'],
        criticalSelectors: ['table'],
        apiRoutes: ['/api/inventory/requests'],
    },

    finance_invoices: {
        name: 'Finance Invoices',
        path: '/finance/invoices',
        // Page-level RoleGuard restricts to SUPER_ADMIN + FINANCE_MANAGER.
        roles: ['SUPER_ADMIN'],
        forbiddenRoles: ['ENGINEER', 'STORES_MANAGER'],
        criticalSelectors: ['table'],
        apiRoutes: ['/api/invoices'],
    },

    finance_payments: {
        name: 'Finance Payments',
        path: '/finance/payments',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        criticalSelectors: ['table'],
        apiRoutes: ['/api/payments'],
    },

    finance_sf_audit: {
        name: 'Finance SF Audit',
        path: '/finance/sf-audit',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        criticalSelectors: ['body'],
    },

    /* ── Phase 4: Fleet + Service Orders + Procurement ── */
    fleet_vehicles: {
        name: 'Fleet Vehicles',
        path: '/fleet/vehicles',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        criticalSelectors: ['table'],
        apiRoutes: ['/api/vehicles'],
    },

    fleet_trips: {
        name: 'Fleet Trips',
        path: '/fleet/trips',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        criticalSelectors: ['table'],
        apiRoutes: ['/api/trips'],
    },

    service_orders: {
        name: 'Service Orders',
        // /service-orders redirects to /service-orders/work-order — target the real page
        path: '/service-orders/work-order',
        roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER'],
        criticalSelectors: ['table'],
        apiRoutes: ['/api/service-orders'],
    },

    procurement_approvals: {
        name: 'Procurement Approvals',
        path: '/procurement/approvals',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        criticalSelectors: ['table'],
        // PROCUREMENT_OFFICER needed for full test — not seeded by default
    },

    /* ── Phase 5: Contractor + Helpdesk ── */
    contractor_dashboard: {
        name: 'Contractor Portal',
        path: '/contractor/dashboard',
        // Contractor role not in seeded TEST_USERS — role-based steps are skipped,
        // but unauthenticated-redirect and login-page checks still run.
        roles: [],
        criticalSelectors: ['body'],
        skip: 'No CONTRACTOR_* user seeded in dev DB by default',
    },

    helpdesk: {
        name: 'Helpdesk',
        path: '/helpdesk',
        // RoleGuard allowedRoles=['ALL'] — any authenticated staff role may enter
        roles: ['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'STORES_MANAGER'],
        criticalSelectors: ['h1'],
        apiRoutes: ['/api/helpdesk/tickets'],
    },
};

/**
 * Iterate only modules we can actually test given the current seed state.
 */
export function testableModules(): Array<[string, ModuleSpec]> {
    return Object.entries(MODULES).filter(([, m]) => !m.skip && m.roles.length > 0);
}
