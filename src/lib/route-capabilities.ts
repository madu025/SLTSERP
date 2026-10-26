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

    if (path.startsWith('/api/admin')) return RBAC_PERMISSIONS.ADMIN_RBAC;
    if (path.startsWith('/api/dashboard')) return RBAC_PERMISSIONS.DASHBOARD_READ;

    if (path.startsWith('/api/service-orders')) {
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

    if (path.startsWith('/api/finance')) {
        return actionPermission(verb, RBAC_PERMISSIONS.FINANCE_READ, RBAC_PERMISSIONS.FINANCE_WRITE, RBAC_PERMISSIONS.FINANCE_APPROVE, /(approve|status)/.test(path));
    }
    if (path.startsWith('/api/inventory')) {
        return actionPermission(verb, RBAC_PERMISSIONS.INVENTORY_READ, RBAC_PERMISSIONS.INVENTORY_WRITE, RBAC_PERMISSIONS.INVENTORY_APPROVE, /(approve|status)/.test(path));
    }
    if (path.startsWith('/api/procurement')) {
        return actionPermission(verb, RBAC_PERMISSIONS.PROCUREMENT_READ, RBAC_PERMISSIONS.PROCUREMENT_WRITE);
    }

    return undefined;
}
