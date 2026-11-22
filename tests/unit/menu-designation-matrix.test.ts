import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIDEBAR_MENU, canAccessMenuItem } from '../../src/config/sidebar-menu';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { designationLevel, levelAllowsItem, MODULE_DESIGNATION_LEVELS } from '../../src/config/menu-access';

/**
 * The menu matrix: for each designation of the Service Orders module, the items of that module its menu shows, from the bootstrap grants.
 * If a menu or a grant changes, this table must change with it on purpose.
 */
const grantsOf = (code: string): string[] => Object.entries({ ...CANONICAL_BOOTSTRAP_ROLE_GRANTS } as Record<string, readonly string[]>)
    .filter(([, roles]) => roles.includes(code))
    .map(([perm]) => perm)
    .concat(Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, roles]) => roles.includes(code)).map(([perm]) => perm));

const sodItems = (designation: string): string[] => {
    const perms = grantsOf(designation);
    const sod = SIDEBAR_MENU.find((m) => m.title === 'Service Orders')!;
    const ok = (m: typeof sod, parent?: typeof sod) => canAccessMenuItem({
        itemTitle: m.title, permissionId: m.permissionId || parent?.permissionId, userPermissions: perms, pathname: m.path,
        designations: [designation], module: m.module ?? parent?.module, level: m.level,
    });
    if (!ok(sod)) return [];
    return (sod.submenu ?? []).filter((s) => ok(s, sod)).map((s) => s.title);
};

const VIEW = ['Pending SOD', 'Install Closed SOD', 'Completed SOD', 'Return SOD', 'Disappeared SODs', 'PAT Status Monitor', 'Contractors & Stock', 'SOD Performance & SLA'];
const INVOICE = ['Invoicing', 'Material Deviation'];
const APPROVE = ['Invoice Approvals', 'Contractor Approvals'];

test('Area Coordinator and QC Officer: the work pages, contractors and performance, nothing of the money steps', () => {
    for (const d of ['AREA_COORDINATOR', 'QC_OFFICER']) assert.deepEqual(sodItems(d).sort(), [...VIEW].sort(), d);
});

test('Engineer and Assistant Engineer add invoicing and material deviation, not the approvals', () => {
    for (const d of ['ENGINEER', 'ASSISTANT_ENGINEER']) assert.deepEqual(sodItems(d).sort(), [...VIEW, ...INVOICE].sort(), d);
});

test('Area Manager has every service order item including both approvals', () => {
    assert.deepEqual(sodItems('AREA_MANAGER').sort(), [...VIEW, ...INVOICE, ...APPROVE].sort());
});

test('OSP Manager sees the money steps but not the Area Manager approvals; an administrator sees everything', () => {
    assert.deepEqual(sodItems('OSP_MANAGER').sort(), [...VIEW, ...INVOICE].sort());
    assert.deepEqual(sodItems('ADMIN').sort(), [...VIEW, ...INVOICE, ...APPROVE].sort());
});

test('levels: the highest designation of a person counts, an unlisted designation leaves the capability check alone', () => {
    assert.equal(designationLevel('SOD', ['ENGINEER', 'PROJECTS_ENGINEER']), 'invoice');
    assert.equal(designationLevel('SOD', ['PROJECTS_ENGINEER']), null);
    assert.equal(levelAllowsItem('SOD', 'approve', ['PROJECTS_ENGINEER']), true, 'no SOD designation: capability decides');
    assert.equal(levelAllowsItem('SOD', 'approve', ['QC_OFFICER']), false);
    assert.equal(levelAllowsItem('SOD', 'approve', undefined), true, 'an old session without designations keeps working');
    assert.equal(levelAllowsItem(undefined, undefined, ['QC_OFFICER']), true);
    assert.ok(Object.keys(MODULE_DESIGNATION_LEVELS.SOD).includes('AREA_COORDINATOR'));
});

test('login and refresh carry the designations the menu needs', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');
    assert.ok(read('src/services/hr/user.service.ts').includes('designations: [...new Set([user.systemRole?.code'), 'login returns the designations');
    assert.ok(read('src/app/api/auth/refresh/route.ts').includes('designations:'), 'refresh returns them too');
    for (const f of ['src/components/sidebar/SidebarMenu.tsx', 'src/components/MobileNav.tsx']) assert.ok(read(f).includes('designations: user?.designations'), `${f} passes the designations to the menu check`);
});
