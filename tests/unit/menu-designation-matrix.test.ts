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

const sectionItems = (title: string, designations: string[], base = designations[0]): string[] => {
    const perms = [...new Set(designations.flatMap(grantsOf))];
    const sod = SIDEBAR_MENU.find((m) => m.title === title)!;
    const ok = (m: typeof sod, parent?: typeof sod) => canAccessMenuItem({
        itemTitle: m.title, permissionId: m.permissionId || parent?.permissionId, userPermissions: perms, pathname: m.path,
        designations, module: m.module ?? parent?.module, level: m.level,
    });
    if (!ok(sod)) return [];
    void base;
    return (sod.submenu ?? []).filter((s) => ok(s, sod)).map((s) => s.title);
};
const sodItems = (designation: string): string[] => sectionItems('Service Orders', [designation]);
const inventoryItems = (...designations: string[]): string[] => sectionItems('Inventory / Stores', designations);

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

const INV_VIEW = ['Dashboard Overview', 'Inventory Health', 'Material Requisitions', 'Project Material Control', 'Inventory Balance', 'Contractor Balance Sheet', 'Physical Stock Take & Recon', 'Stock Ledger (Cardex)', 'Material Consumption Report'];
const INV_OPERATE = ['Item Master Data', 'Goods Receipt (GRN)', 'Goods Issue (MIN)', 'Inventory Adjustments (Wastage)', 'Contractor Material Issue', 'Contractor Returns', 'Initial Stock Setup', 'Virtual Material Swap', 'Material Returns (MRN)', 'Pre-ERP Legacy Recon'];

test('Inventory: the store staff and administrators have the whole menu, the Area Manager and other approvers the balances and requisitions', () => {
    for (const d of ['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN']) assert.deepEqual(inventoryItems(d).sort(), [...INV_VIEW, ...INV_OPERATE].sort(), d);
    for (const d of ['AREA_MANAGER', 'OSP_MANAGER', 'HEAD_OF_OSP']) assert.deepEqual(inventoryItems(d).sort(), [...INV_VIEW].sort(), d);
});

test('Inventory: a Project Engineer (designation) sees the project material pages, the SOD Engineer has no inventory menu at all', () => {
    assert.deepEqual(inventoryItems('ENGINEER', 'PROJECTS_ENGINEER').sort(), [...INV_VIEW].sort());
    assert.deepEqual(inventoryItems('ENGINEER'), [], 'the base Engineer role has no inventory capability');
    assert.deepEqual(inventoryItems('AREA_COORDINATOR'), []);
    assert.deepEqual(inventoryItems('QC_OFFICER'), []);
});

test('one person, two modules: an Engineer who is also a Project Engineer gets the invoice level in service orders and view in inventory', () => {
    const d = ['ENGINEER', 'PROJECTS_ENGINEER'];
    assert.equal(designationLevel('SOD', d), 'invoice');
    assert.equal(designationLevel('INVENTORY', d), 'view');
    assert.deepEqual(sectionItems('Service Orders', d).sort(), [...VIEW, ...INVOICE].sort());
});

test('Inventory level order: the Area Manager approves but does not operate the store', () => {
    assert.equal(levelAllowsItem('INVENTORY', 'view', ['AREA_MANAGER']), true);
    assert.equal(levelAllowsItem('INVENTORY', 'operate', ['AREA_MANAGER']), false);
    assert.equal(levelAllowsItem('INVENTORY', 'operate', ['STORES_MANAGER']), true);
    assert.equal(levelAllowsItem('INVENTORY', 'invoice' as never, ['STORES_MANAGER']), false, 'a level the module does not have hides the item');
});
