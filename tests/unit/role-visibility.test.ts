import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
    const walk = (items: typeof SIDEBAR_MENU, inherit: { module?: string; level?: string; permissionId?: string } = {}, depth = 0) => {
        for (const it of items) {
            const m = { module: it.module ?? inherit.module, level: it.level ?? inherit.level, permissionId: it.permissionId ?? inherit.permissionId };
            // a group shows its items only when the group itself is visible
            if (it.submenu) { if (depth === 0 || canAccessMenuItem({ designations, module: m.module as never, level: it.level as never, permissionId: it.permissionId ?? inherit.permissionId, userPermissions: perms, pathname: it.path, itemTitle: it.title })) walk(it.submenu, { ...m, level: undefined }, depth + 1); }
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
        for (const p of ['/service-orders/invoice-status', '/finance/general-ledger', '/projects/dashboards/financials']) assert.ok(v.has(p), `${r} should open ${p}`);
        // the groups Head Office Payments and Finance Setup & Registers need finance.write: the read-only finance roles do not have it
        if (['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER'].includes(r)) assert.ok(v.has('/finance/payments'), `${r} should open /finance/payments`);
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

test('Stores: the Executive is the Manager\'s deputy (approves, reviews, adjusts, releases, receives goods, master data); the officers do the daily work only', async () => {
    const g = CANONICAL_BOOTSTRAP_ROLE_GRANTS as unknown as Record<string, string[]>;
    const { getStockRequestActionPermission } = await import('../../src/lib/inventory-stock-request-permissions');
    for (const r of ['STORES_EXECUTIVE', 'STORES_MANAGER', 'CEO']) assert.ok(g['inventory.adjust'].includes(r), `${r} adjusts stock`);
    assert.ok(!g['inventory.adjust'].includes('STORES_ASSISTANT'), 'the store officers do not adjust stock');
    // the officers raise and do the daily work
    for (const c of ['inventory.read', 'inventory.write']) assert.ok(g[c].includes('STORES_ASSISTANT') && g[c].includes('STORES_EXECUTIVE'), c);
    // review (change quantities before the approval): the Executive and every approver; approve / reject: not the Executive
    for (const r of ['STORES_EXECUTIVE', 'STORES_MANAGER', 'OSP_MANAGER', 'CEO', 'PROCUREMENT_OFFICER']) assert.ok(g['inventory.review'].includes(r), `${r} reviews`);
    assert.ok(!g['inventory.review'].includes('STORES_ASSISTANT'));
    assert.ok(g['inventory.approve'].includes('STORES_EXECUTIVE') && !g['inventory.approve'].includes('STORES_ASSISTANT'), 'the Executive approves and rejects as the Manager\'s deputy; the officers do not');
    for (const c of ['inventory.master', 'inventory.release', 'inventory.grn', 'inventory.adjust', 'inventory.review']) assert.ok(g[c].includes('STORES_EXECUTIVE') && g[c].includes('STORES_MANAGER') && !g[c].includes('STORES_ASSISTANT'), c);
    assert.ok(g['scope.inventory.all'].includes('STORES_EXECUTIVE'), 'the Executive works in every store, like the Manager');
    assert.equal(getStockRequestActionPermission('ADJUST_QTY'), 'inventory.review');
    assert.equal(getStockRequestActionPermission('REJECT'), 'inventory.approve');
    // the gate fallback is the Executive, not the Procurement Officer
    assert.ok(fs.readFileSync('prisma/migrations/20261215000000_stores_executive_gate_deputy/migration.sql', 'utf8').includes('STORES_EXECUTIVE'));
    // pages
    assert.ok(visible('STORES_EXECUTIVE').has('/inventory/admin/wastage') && visible('STORES_MANAGER').has('/inventory/admin/wastage'));
    assert.ok(!visible('STORES_ASSISTANT').has('/inventory/admin/wastage'), 'no adjustments page for the officers');
    for (const p of ['/inventory', '/inventory/requests', '/inventory/issues', '/inventory/admin/returns']) assert.ok(visible('STORES_EXECUTIVE').has(p) && visible('STORES_ASSISTANT').has(p), p);
    // release from the main store and returns to the supplier: the Executive and the Manager; the officers do not
    for (const r of ['STORES_EXECUTIVE', 'STORES_MANAGER', 'CEO']) assert.ok(g['inventory.release'].includes(r), `${r} releases`);
    assert.ok(!g['inventory.release'].includes('STORES_ASSISTANT'));
    assert.equal(getStockRequestActionPermission('RELEASE'), 'inventory.release');
    assert.equal(getStockRequestActionPermission('RECEIVE'), 'inventory.write', 'the officers receive at their own store');
    // goods receipt (GRN): the Executive and the Manager only; the officers raise material requests
    assert.ok(visible('STORES_EXECUTIVE').has('/inventory/grn') && visible('STORES_MANAGER').has('/inventory/grn'));
    assert.ok(!visible('STORES_ASSISTANT').has('/inventory/grn'), 'the store officers do not receive goods');
    assert.ok(g['inventory.grn'].includes('STORES_EXECUTIVE') && g['inventory.grn'].includes('STORES_MANAGER') && !g['inventory.grn'].includes('STORES_ASSISTANT') && !g['inventory.grn'].includes('PROCUREMENT_OFFICER'));
});

test('the quantities typed on the request page reach the service, and a wastage entry needs the adjust capability', () => {
    const fsx = require('node:fs') as typeof import('node:fs');
    assert.ok(fsx.readFileSync('src/actions/inventory-actions.ts', 'utf8').includes('items: data?.items ?? data?.allocation'), 'allocation is mapped to items (it was silently dropped)');
    assert.ok(fsx.readFileSync('src/app/api/inventory/wastage/route.ts', 'utf8').includes('INVENTORY_ADJUST'));
    const svc = fsx.readFileSync('src/services/inventory/stock-request.service.ts', 'utf8');
    assert.ok(svc.includes("case 'ADJUST_QTY'") && svc.includes("'RELEASE', 'ADJUST_QTY'"), 'the adjust action exists and the requester cannot adjust their own request');
});

test('a quantity adjustment needs a reason, known lines, and non-negative numbers', async () => {
    const { validateQtyAdjustment } = await import('../../src/lib/stock-request-adjust');
    const lines = [{ id: 'a', requestedQty: 10 }, { id: 'b', requestedQty: 5 }];
    assert.equal(validateQtyAdjustment([{ id: 'a', approvedQty: 6 }], lines, 'only 6 are needed').ok, true);
    assert.equal(validateQtyAdjustment([{ id: 'a', approvedQty: 6 }], lines, '').ok, false, 'a reason is required');
    assert.equal(validateQtyAdjustment([{ id: 'zzz', approvedQty: 1 }], lines, 'reason').ok, false, 'a line of another request');
    assert.equal(validateQtyAdjustment([{ id: 'a', approvedQty: -1 }], lines, 'reason').ok, false);
    assert.equal(validateQtyAdjustment([{ id: 'a', approvedQty: Number.NaN }], lines, 'reason').ok, false);
    assert.equal(validateQtyAdjustment([{ id: 'a', approvedQty: 1 }, { id: 'a', approvedQty: 2 }], lines, 'reason').ok, false, 'a line twice');
    assert.equal(validateQtyAdjustment([], lines, 'reason').ok, false);
    assert.equal(validateQtyAdjustment([{ id: 'a', approvedQty: 0 }], lines, 'not needed').ok, true, 'zero is allowed: the line is not needed');
});

test('the first fallback migration (Procurement) exists and a later one makes the Executive the deputy', () => {
    const sql = fs.readFileSync('prisma/migrations/20261214000001_stores_manager_gate_fallback/migration.sql', 'utf8');
    assert.ok(sql.includes("'ARM_APPROVAL'") && sql.includes("'MAIN_STORE_RELEASE'") && sql.includes('PROCUREMENT_OFFICER') && sql.includes('NOT ('), 'targets that one gate and is idempotent');
    assert.ok(fs.readFileSync('prisma/migrations/20261214000000_stores_executive_role/migration.sql', 'utf8').includes("ADD VALUE IF NOT EXISTS 'STORES_EXECUTIVE'"));
});

test('the low-stock trigger has the cooldown table it writes to (its absence rolled back every stock movement that reached the minimum level)', () => {
    const all = fs.readdirSync('prisma/migrations').filter((d) => fs.existsSync(`prisma/migrations/${d}/migration.sql`));
    const creators = all.filter((d) => /CREATE TABLE IF NOT EXISTS "InventoryAlertCooldown"/.test(fs.readFileSync(`prisma/migrations/${d}/migration.sql`, 'utf8')));
    assert.ok(creators.length >= 2, 'the table is created again by a later migration, because the first one did not leave it in production');
});

test('contractor material: the store pages load their contractors through a store-scoped API, and the balance and issue are limited to the contractors of the own store', () => {
    for (const p of ['issue', 'returns', 'balance-sheet', 'wastage']) {
        const src = fs.readFileSync(`src/app/inventory/admin/${p}/page.tsx`, 'utf8');
        assert.ok(src.includes('/api/inventory/contractors') && !src.includes('/api/admin/contractors'), `${p} page: not the administrator-only contractor API`);
    }
    const svc = fs.readFileSync('src/services/inventory/contractor-store.service.ts', 'utf8');
    assert.ok(svc.includes('storeAssignments') && svc.includes('opmc: { is: { storeId'), 'a contractor belongs to a store by its OPMC or by a team assigned to the store');
    for (const f of ['issue.service', 'wastage.service', 'transaction.service']) assert.ok(fs.readFileSync(`src/services/inventory/${f}.ts`, 'utf8').includes('ContractorStoreService.assertForStore'), f);
    assert.ok(fs.readFileSync('src/app/api/inventory/in-hand-stock/route.ts', 'utf8').includes('assertCanSee'));
    assert.ok(fs.readFileSync('src/app/api/inventory/contractors/route.ts', 'utf8').includes('INVENTORY_READ'));
});

test('every inventory function has an owner among the store roles; master data, adjustments and emergency purchases are not the officers\'', () => {
    const g = CANONICAL_BOOTSTRAP_ROLE_GRANTS as unknown as Record<string, string[]>;
    const guard = (f: string, method: string) => { const s = fs.readFileSync(f, 'utf8'); const i = s.indexOf(`export const ${method} =`); const j = s.indexOf('permissions: [', i); return s.slice(j, s.indexOf(']', j)); };
    assert.ok(guard('src/app/api/inventory/items/route.ts', 'DELETE').includes('INVENTORY_MASTER') && guard('src/app/api/inventory/stores/route.ts', 'POST').includes('INVENTORY_MASTER'), 'item master and stores are master data');
    assert.ok(guard('src/app/api/inventory/reconciliation/route.ts', 'POST').includes('INVENTORY_ADJUST') && guard('src/app/api/inventory/pre-erp-reconciliation/adjust/route.ts', 'POST').includes('INVENTORY_ADJUST'), 'reconciliation adjustments are stock adjustments');
    assert.ok(guard('src/app/api/inventory/emergency-petty-purchase/route.ts', 'POST').includes('INVENTORY_GRN'), 'an emergency purchase receives goods');
    assert.ok(guard('src/app/api/inventory/reports/dynamic/route.ts', 'POST').includes('INVENTORY_READ'), 'the stores people can run their inventory reports (they hold inventory.read, not reports.read)');
    for (const r of ['STORES_EXECUTIVE', 'STORES_MANAGER']) for (const c of ['inventory.master', 'inventory.adjust', 'inventory.grn', 'inventory.release', 'inventory.approve', 'inventory.review']) assert.ok(g[c].includes(r), `${r} ${c}`);
    assert.ok(!g['inventory.master'].includes('STORES_ASSISTANT'));
    assert.ok(g['notification.audience.process-gate-stores'].includes('STORES_EXECUTIVE'), 'the deputy hears of the gates');
    for (const r of ['STORES_ASSISTANT', 'STORES_EXECUTIVE', 'STORES_MANAGER']) assert.ok(visible(r).has('/inventory/requests') && visible(r).has('/inventory/stock') && visible(r).has('/inventory/admin/balance-sheet') && visible(r).has('/inventory/audit'), `${r} basic pages`);
    for (const p of ['/inventory/admin/initial', '/inventory/admin/virtual-swap', '/inventory/admin/pre-erp-reconciliation', '/inventory/items']) assert.ok(visible('STORES_EXECUTIVE').has(p) && !visible('STORES_ASSISTANT').has(p), `${p}: the Executive yes, the officers no`);
});

test('the Inventory menu is in five groups by what the person does, and Pending Approvals is one page for the approvers', () => {
    const inv = SIDEBAR_MENU.find((m) => m.title === 'Inventory / Stores')!;
    const groups = (inv.submenu ?? []).filter((x) => x.submenu).map((x) => x.title);
    assert.deepEqual(groups, ['Daily work', 'Stock & reports', 'Receiving & returns', 'Approvals', 'Setup']);
    // the officers see only the first two groups (plus the dashboard and the requisitions); the Executive and the Manager see all five
    const top = (r: string) => { const g = new Set<string>(); const v = visible(r); for (const grp of inv.submenu ?? []) if (grp.submenu && grp.submenu.some((c) => v.has(c.path))) g.add(grp.title); return [...g]; };
    assert.deepEqual(top('STORES_ASSISTANT'), ['Daily work', 'Stock & reports']);
    assert.deepEqual(top('STORES_EXECUTIVE'), ['Daily work', 'Stock & reports', 'Receiving & returns', 'Approvals', 'Setup']);
    assert.deepEqual(top('STORES_MANAGER'), ['Daily work', 'Stock & reports', 'Receiving & returns', 'Approvals', 'Setup']);
    // the approvers who do not work in the stores keep the requisitions, the reports and the approvals page
    for (const r of ['AREA_MANAGER', 'OSP_MANAGER', 'HEAD_OF_OSP']) { assert.ok(visible(r).has('/inventory/requests') && visible(r).has('/inventory/approvals'), r); assert.ok(!visible(r).has('/inventory/grn'), r); }
    assert.ok(!visible('STORES_ASSISTANT').has('/inventory/approvals') && !visible('STORES_ASSISTANT').has('/inventory/admin/mrns'));
    assert.ok(fs.readFileSync('src/app/api/inventory/approvals/route.ts', 'utf8').includes('INVENTORY_APPROVE'));
    assert.ok(fs.readFileSync('src/services/inventory/approval-queue.service.ts', 'utf8').includes("status: 'PENDING_APPROVAL'") && fs.readFileSync('src/services/inventory/approval-queue.service.ts', 'utf8').includes('own:'));
});
