import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { hasDashboardTab, quickStartLinks } from '../../src/config/dashboard-quick-start';

const grants = CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>;
const roles = [...new Set([...Object.values(grants), ...Object.values(MODULE_DESIGNATION_GRANTS)].flat())].sort();
const grantsOf = (role: string): string[] => [
    ...Object.entries(grants).filter(([, r]) => r.includes(role)).map(([p]) => p),
    ...Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, r]) => r.includes(role)).map(([p]) => p),
];

test('a role with no dashboard tab gets the places it works in (the contractors have their own portal)', () => {
    const noTab = roles.filter((r) => grantsOf(r).includes('dashboard.read') && !hasDashboardTab(grantsOf(r)));
    assert.deepEqual(noTab.filter((r) => !r.startsWith('CONTRACTOR_')).sort(), ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF']);
    for (const r of noTab.filter((x) => !x.startsWith('CONTRACTOR_'))) {
        const titles = quickStartLinks(grantsOf(r)).map((l) => l.title);
        assert.ok(titles.includes('Petty cash') && titles.includes('Raise a support ticket'), r);
    }
});

test('a person with a tab or without any capability gets no link they cannot open', () => {
    assert.deepEqual(quickStartLinks([]), []);
    assert.deepEqual(quickStartLinks(undefined), []);
    assert.ok(!quickStartLinks(['dashboard.read']).some((l) => l.href === '/petty-cash'));
});

test('the operations stats are fetched only for a person who holds sod.read, so no failed tab is shown', () => {
    const page = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');
    assert.ok(page.includes("(activeTab === 'operations' || activeTab === 'overview') && canViewOperations"));
    assert.ok(page.includes('<QuickStartSection permissions={user.permissions} />'));
});
