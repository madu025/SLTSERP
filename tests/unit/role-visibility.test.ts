import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIDEBAR_MENU, canAccessMenuItem } from '../../src/config/sidebar-menu';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { SECTION_MAPPING } from '../../src/config/auth-defaults';

/**
 * What the company-level roles can open, from the bootstrap grants (function + designation level). The rules of the owner:
 *  - OSP Manager, Head of OSP and CEO read every service order page, Invoice Status, Projects, Inventory stores and stock reports and the Reports.
 *  - The finance people see the money of every module: invoices and Invoice Status, project finance, purchase orders and supplier invoices,
 *    contractor balances, stock value, vouchers and ledgers; but not the service orders themselves and not the operational reports.
 */
const grantsOf = (code: string): string[] => Object.entries({ ...CANONICAL_BOOTSTRAP_ROLE_GRANTS } as Record<string, readonly string[]>)
    .filter(([, roles]) => roles.includes(code)).map(([p]) => p)
    .concat(Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, roles]) => roles.includes(code)).map(([p]) => p));

const visible = (role: string): Set<string> => {
    const designations = [role, ...(((SECTION_MAPPING as Record<string, string[]>)[role] ?? []).map((s) => `${s}_${role}`))];
    const perms = [...new Set(designations.flatMap(grantsOf))];
    const out = new Set<string>();
    const walk = (items: typeof SIDEBAR_MENU, inherit: { module?: string; level?: string; permissionId?: string } = {}) => {
        for (const it of items) {
            const m = { module: it.module ?? inherit.module, level: it.level ?? inherit.level, permissionId: it.permissionId ?? inherit.permissionId };
            if (it.submenu) walk(it.submenu, m);
            else if (canAccessMenuItem({ designations, module: m.module as never, level: m.level as never, permissionId: m.permissionId, userPermissions: perms, pathname: it.path, itemTitle: it.title })) out.add(it.path);
        }
    };
    walk(SIDEBAR_MENU);
    return out;
};

const MANAGER_PAGES = [
    '/service-orders/work-order', '/service-orders/work-order/completed', '/service-orders/work-order/pat', '/service-orders/invoice-status', '/service-orders/contractor-stock', '/service-orders/performance',
    '/projects', '/projects/dashboards/pm', '/projects/dashboards/financials', '/projects/dashboards/qaqc', '/projects/dashboards/logistics',
    '/inventory', '/inventory/health', '/inventory/stock', '/inventory/requests', '/inventory/reports/cardex', '/inventory/reports/material-summary', '/inventory/stores',
    '/reports', '/reports/manager', '/reports/arm', '/reports/daily-operational',
];

test('OSP Manager, Head of OSP and CEO open every service order, Invoice Status, Projects, Inventory stores/reports and Reports page', () => {
    for (const r of ['OSP_MANAGER', 'HEAD_OF_OSP', 'CEO']) {
        const v = visible(r);
        for (const p of MANAGER_PAGES) assert.ok(v.has(p), `${r} should open ${p}`);
    }
});

test('the finance people open Invoice Status and every money page, but no service order page and no operational report', () => {
    for (const r of ['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER']) {
        const v = visible(r);
        for (const p of ['/service-orders/invoice-status', '/finance/payments', '/finance/general-ledger', '/projects/dashboards/financials']) assert.ok(v.has(p), `${r} should open ${p}`);
        for (const p of ['/service-orders/work-order', '/service-orders/work-order/completed', '/reports/arm', '/reports/manager']) assert.ok(!v.has(p), `${r} must not open ${p}`);
    }
    for (const r of ['FINANCE_MANAGER', 'FINANCE_ASSISTANT']) {
        const v = visible(r);
        for (const p of ['/procurement/purchase-orders', '/procurement/invoices', '/inventory/stock', '/inventory/reports/material-summary', '/contractors/scorecard']) assert.ok(v.has(p), `${r} should open ${p}`);
        for (const p of ['/inventory/issues', '/inventory/grn', '/procurement/quotations/new']) assert.ok(!v.has(p), `${r} must not open ${p} (writes stay with the stores and procurement)`);
    }
});

test('the project finance dashboard is for the finance roles and the OSP managers, not for the project engineers', () => {
    for (const r of ['OSP_MANAGER', 'HEAD_OF_OSP', 'CEO', 'FINANCE_MANAGER', 'SF_AUDIT_OFFICER']) assert.ok(visible(r).has('/projects/dashboards/financials'), r);
    for (const r of ['ENGINEER', 'AREA_MANAGER', 'STORES_MANAGER']) assert.ok(!visible(r).has('/projects/dashboards/financials'), r);
    // the OSP Manager still has no Finance & Accounting menu
    assert.ok(!visible('OSP_MANAGER').has('/finance/payments'));
});

test('Invoice Status keeps everyone who had it (service order people) and adds the finance people', () => {
    for (const r of ['AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER']) assert.ok(visible(r).has('/service-orders/invoice-status'), r);
    for (const r of ['STORES_MANAGER', 'PROCUREMENT_OFFICER']) assert.ok(!visible(r).has('/service-orders/invoice-status'), `${r} has no business there`);
});
