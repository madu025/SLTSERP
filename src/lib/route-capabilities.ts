import { RBAC_PERMISSIONS, type RbacPermission } from '@/config/rbac-permissions';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function actionPermission(
    method: string,
    read: RbacPermission,
    write: RbacPermission,
    approve?: RbacPermission,
    approvalRoute = false
): RbacPermission {
    if (approvalRoute && approve && (method === 'POST' || method === 'PUT' || method === 'PATCH')) return approve;
    return READ_METHODS.has(method) ? read : write;
}

/**
 * Default module boundary for routes that have not yet been individually
 * migrated to an explicit `apiHandler({ permissions })` declaration.
 *
 * This is capability metadata, not a role allowlist. Once a session contains
 * canonical DB permissions, apiHandler uses this result as the authoritative
 * module gate and ignores legacy role arrays for that request.
 */
export function resolveRouteCapability(pathname: string, method: string): RbacPermission | undefined {
    const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
    const verb = method.toUpperCase();

    // Public and bridge endpoints authenticate with their own scoped token,
    // upload token, or agent key. Do not apply the surrounding module
    // capability here; each handler owns that non-session boundary.
    if (
        path === '/api/contractor-portal/auth' ||
        path.startsWith('/api/contractor-portal/auth/') ||
        path === '/api/contractors/public' ||
        path === '/api/contractors/public-register' ||
        path.startsWith('/api/contractors/public-register/') ||
        (path === '/api/helpdesk/assets/audits' && verb === 'POST') ||
        path === '/api/helpdesk/assets/search-by-serial' ||
        path === '/api/helpdesk/agent/telemetry'
    ) {
        return undefined;
    }

    if (path.startsWith('/api/admin')) return RBAC_PERMISSIONS.ADMIN_RBAC;
    if (path.startsWith('/api/automation')) return RBAC_PERMISSIONS.ADMIN_RBAC;
    if (path.startsWith('/api/dashboard')) return RBAC_PERMISSIONS.DASHBOARD_READ;
    if (path.startsWith('/api/ai')) return RBAC_PERMISSIONS.DASHBOARD_READ;
    if (path.startsWith('/api/notifications')) return RBAC_PERMISSIONS.DASHBOARD_READ;
    if (path.startsWith('/api/reports')) return RBAC_PERMISSIONS.REPORTS_READ;
    if (path.startsWith('/api/maintenance')) return RBAC_PERMISSIONS.ADMIN_RBAC;
    if (path.startsWith('/api/profile')) return RBAC_PERMISSIONS.DASHBOARD_READ;

    if (path.startsWith('/api/service-orders')) {
        if (path.startsWith('/api/service-orders/extension-push') || path.startsWith('/api/service-orders/bridge-sync') || path.startsWith('/api/service-orders/bridge-data')) {
            return undefined;
        }
        if (path.includes('/verify-invoicable') || path.includes('/invoices/generate')) {
            return RBAC_PERMISSIONS.SOD_INVOICE;
        }
        return actionPermission(verb, RBAC_PERMISSIONS.SOD_READ, RBAC_PERMISSIONS.SOD_WRITE);
    }

    if (path.startsWith('/api/projects')) {
        if (path === '/api/projects' && verb === 'DELETE') return RBAC_PERMISSIONS.ADMIN_RBAC;

        if (/(invoices|expenses|ld-penalties|payment-vouchers|retentions|budget)/.test(path)) {
            return actionPermission(verb, RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_APPROVE, /(approve|status)/.test(path));
        }
        if (/(goods-receipts|ir-ledger|ir-return|ir-transfer|ir-wastage|stock-issue)/.test(path)) {
            return actionPermission(verb, RBAC_PERMISSIONS.INVENTORY_READ, RBAC_PERMISSIONS.INVENTORY_WRITE, RBAC_PERMISSIONS.INVENTORY_APPROVE, /(approve|status)/.test(path));
        }
        if (/(purchase-orders|quotations|requisitions)/.test(path)) {
            return actionPermission(verb, RBAC_PERMISSIONS.PROCUREMENT_READ, RBAC_PERMISSIONS.PROCUREMENT_WRITE);
        }
        if (/(approve|approvals|close|workflow\/stages)/.test(path)) {
            return actionPermission(verb, RBAC_PERMISSIONS.PROJECT_READ, RBAC_PERMISSIONS.PROJECT_WRITE, RBAC_PERMISSIONS.PROJECT_APPROVE, true);
        }
        return actionPermission(verb, RBAC_PERMISSIONS.PROJECT_READ, RBAC_PERMISSIONS.PROJECT_WRITE);
    }

    if (path.startsWith('/api/invoices/import-bom/csv') || path.startsWith('/api/invoices/slt-registry')) {
        // These endpoints support a separately authenticated SLT bridge or
        // extension key and perform their own permission checks in the route.
        return undefined;
    }

    if (path.startsWith('/api/invoices')) {
        if (path.includes('/generate')) return RBAC_PERMISSIONS.SOD_INVOICE;
        if (path.includes('/sf-audit') || path.includes('/amend')) {
            return actionPermission(verb, RBAC_PERMISSIONS.FINANCE_AUDIT, RBAC_PERMISSIONS.FINANCE_AUDIT, RBAC_PERMISSIONS.FINANCE_APPROVE, /(approve|status)/.test(path));
        }
        return actionPermission(verb, RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_APPROVE, /(approve|status)/.test(path));
    }

    if (path.startsWith('/api/finance')) {
        return actionPermission(verb, RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_APPROVE, /(approve|status)/.test(path));
    }
    if (path.startsWith('/api/inventory')) {
        return actionPermission(verb, RBAC_PERMISSIONS.INVENTORY_READ, RBAC_PERMISSIONS.INVENTORY_WRITE, RBAC_PERMISSIONS.INVENTORY_APPROVE, /(approve|status)/.test(path));
    }
    if (path.startsWith('/api/stores')) {
        return actionPermission(verb, RBAC_PERMISSIONS.INVENTORY_READ, RBAC_PERMISSIONS.INVENTORY_WRITE);
    }
    if (path.startsWith('/api/procurement')) {
        return actionPermission(verb, RBAC_PERMISSIONS.PROCUREMENT_READ, RBAC_PERMISSIONS.PROCUREMENT_WRITE);
    }

    if (path.startsWith('/api/gis')) {
        return actionPermission(verb, RBAC_PERMISSIONS.PROJECT_PLAN_READ, RBAC_PERMISSIONS.PROJECT_PLAN_WRITE);
    }

    if (path.startsWith('/api/contractor-portal') || path.startsWith('/api/contractors')) {
        return actionPermission(verb, RBAC_PERMISSIONS.CONTRACTOR_READ, RBAC_PERMISSIONS.CONTRACTOR_WRITE);
    }

    if (path.startsWith('/api/team-members') && !path.startsWith('/api/team-members/public')) {
        return actionPermission(verb, RBAC_PERMISSIONS.CONTRACTOR_READ, RBAC_PERMISSIONS.CONTRACTOR_WRITE);
    }

    if (path.startsWith('/api/helpdesk') || path.startsWith('/api/eam')) {
        return actionPermission(
            verb,
            RBAC_PERMISSIONS.HELPDESK_READ,
            RBAC_PERMISSIONS.HELPDESK_WRITE,
            RBAC_PERMISSIONS.HELPDESK_APPROVE,
            /(approve|handover|disposal|audit)/.test(path),
        );
    }

    if (path.startsWith('/api/trips') || path.startsWith('/api/vehicles')) {
        return actionPermission(verb, RBAC_PERMISSIONS.FLEET_READ, RBAC_PERMISSIONS.FLEET_WRITE);
    }
    if (path.startsWith('/api/drivers')) return RBAC_PERMISSIONS.FLEET_READ;
    if (path.startsWith('/api/files/contractors')) return RBAC_PERMISSIONS.CONTRACTOR_READ;
    if (path.startsWith('/api/storage')) return RBAC_PERMISSIONS.DASHBOARD_READ;

    if (path.startsWith('/api/contracts')) {
        return actionPermission(verb, RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.FINANCE_WRITE);
    }

    if (path.startsWith('/api/banks')) {
        // Contractor registration uses anonymous bank/branch GET lookups.
        return READ_METHODS.has(verb) ? undefined : RBAC_PERMISSIONS.FINANCE_WRITE;
    }

    if (path.startsWith('/api/payments') || path.startsWith('/api/vendors')) {
        return actionPermission(verb, RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.FINANCE_WRITE);
    }

    if (path.startsWith('/api/jobs')) {
        return actionPermission(verb, RBAC_PERMISSIONS.SOD_READ, RBAC_PERMISSIONS.SOD_WRITE);
    }

    if (path.startsWith('/api/opmcs') || path.startsWith('/api/staff') || path.startsWith('/api/users') || path.startsWith('/api/system')) {
        return RBAC_PERMISSIONS.ADMIN_RBAC;
    }

    if (path.startsWith('/api/tax-configs')) {
        return actionPermission(verb, RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.FINANCE_APPROVE, RBAC_PERMISSIONS.FINANCE_APPROVE, true);
    }

    return undefined;
}
