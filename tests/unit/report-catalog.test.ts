import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_CATALOG } from '../../src/config/report-catalog';
import { SIDEBAR_MENU, type MenuItem } from '../../src/config/sidebar-menu';
import { resolvePageCapability } from '../../src/config/page-capabilities';
import { reportMeta, runUserReport, REPORT_ENTITY_PERMISSION } from '../../src/services/reports/report-center.service';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';

const flatten = (items: MenuItem[]): MenuItem[] => items.flatMap((i) => [i, ...flatten(i.submenu ?? [])]);

test('every report page in the sidebar is in the Report Center catalog', () => {
    const catalog = new Set(REPORT_CATALOG.map((r) => r.path));
    const missing = flatten(SIDEBAR_MENU).filter((i) => /report|analytic/i.test(`${i.path} ${i.title}`) && i.path !== '#' && i.path !== '/reports' && !i.path.startsWith('/admin') && !catalog.has(i.path)).map((i) => i.path);
    assert.deepEqual(missing, [], `add these to src/config/report-catalog.ts: ${missing.join(', ')}`);
});

test('every catalog entry has a page that exists in the sidebar and a capability to gate it', () => {
    const paths = new Set(flatten(SIDEBAR_MENU).map((i) => i.path));
    for (const r of REPORT_CATALOG) {
        assert.ok(paths.has(r.path), `${r.path} is not a sidebar page`);
        assert.ok(resolvePageCapability(r.path), `${r.path} has no page capability, so nobody could see it`);
    }
    assert.equal(new Set(REPORT_CATALOG.map((r) => r.path)).size, REPORT_CATALOG.length, 'duplicate catalog paths');
});

test('the builder offers only what the caller may report on', () => {
    const sod = new Set<string>([RBAC_PERMISSIONS.SOD_READ]);
    assert.deepEqual(reportMeta(sod, undefined).map((e) => e.id).sort(), ['materialUsage', 'serviceOrder']);
    const so = reportMeta(sod, undefined).find((e) => e.id === 'serviceOrder')!;
    assert.ok(!so.fields.some((f) => f.path === 'revenueAmount'), 'revenue needs finance access');
    assert.ok(reportMeta(new Set([RBAC_PERMISSIONS.SOD_READ, RBAC_PERMISSIONS.FINANCE_READ]), undefined).find((e) => e.id === 'serviceOrder')!.fields.some((f) => f.path === 'revenueAmount'));
    // a user limited to specific OPMCs only gets entities that can be scoped
    const all = new Set<string>(Object.values(REPORT_ENTITY_PERMISSION));
    assert.deepEqual(reportMeta(all, ['opmc-1']).map((e) => e.id).sort(), ['materialUsage', 'serviceOrder']);
    assert.deepEqual(reportMeta(new Set(), undefined), []);
});

test('a report is refused before any query when capability, finance field or OPMC scope does not allow it', async () => {
    const sod = new Set<string>([RBAC_PERMISSIONS.SOD_READ]);
    assert.deepEqual(await runUserReport({ entity: 'journalEntry', columns: ['description'] }, sod, undefined), { error: 'You do not have access to this report.' });
    assert.deepEqual(await runUserReport({ entity: 'serviceOrder', columns: ['revenueAmount'] }, sod, undefined), { error: 'Revenue figures require finance access.' });
    assert.deepEqual(await runUserReport({ entity: 'serviceOrder', columns: [], aggregation: { groupBy: 'status', targetField: 'revenueAmount', type: 'SUM' } }, sod, undefined), { error: 'Revenue figures require finance access.' });
    const inv = new Set<string>([RBAC_PERMISSIONS.INVENTORY_READ]);
    assert.deepEqual(await runUserReport({ entity: 'contractorStock', columns: ['quantity'] }, inv, ['opmc-1']), { error: 'This report is only available to users with company-wide access.' });
    assert.deepEqual(await runUserReport({ entity: 'materialUsage', columns: ['unitPrice'] }, sod, undefined), { error: 'Cost figures require inventory cost access.' });
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
