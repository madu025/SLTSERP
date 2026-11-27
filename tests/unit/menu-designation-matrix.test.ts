import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIDEBAR_MENU, canAccessMenuItem } from '../../src/config/sidebar-menu';
import { BOOTSTRAP_MENU_LEVELS, CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { levelFromPermissions, levelAllowsItem } from '../../src/config/menu-access';

/**
 * The menu matrix: for each designation of the Service Orders module, the items of that module its menu shows, from the bootstrap grants.
 * If a menu or a grant changes, this table must change with it on purpose.
 */
const grantsOf = (code: string): string[] => Object.entries({ ...CANONICAL_BOOTSTRAP_ROLE_GRANTS } as Record<string, readonly string[]>)
    .filter(([, roles]) => roles.includes(code))
    .map(([perm]) => perm)
    .concat(Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, roles]) => roles.includes(code)).map(([perm]) => perm));

/** What a person holds through these roles (a post and its module designations). */
const permsOf = (designations: string[]): string[] => [...new Set(designations.flatMap(grantsOf))];
const designationLevel = (module: Parameters<typeof levelFromPermissions>[0], d: string[]) => levelFromPermissions(module, permsOf(d));

const sectionItems = (title: string, designations: string[], base = designations[0]): string[] => {
    const perms = [...new Set(designations.flatMap(grantsOf))];
    const top = SIDEBAR_MENU.find((m) => m.title === title)!;
    type Item = typeof top;
    const ok = (m: Item, parent?: Item, module?: Item['module']) => canAccessMenuItem({
        itemTitle: m.title, permissionId: m.permissionId || parent?.permissionId, userPermissions: perms, pathname: m.path,
        designations, module: m.module ?? module, level: m.level,
    });
    if (!ok(top)) return [];
    void base;
    // a group (path '#') shows its visible items; an item shows only when its group does
    const leaves = (list: Item[] | undefined, parent: Item, module: Item['module']): string[] => (list ?? []).filter((x) => ok(x, parent, module)).flatMap((x) => (x.submenu ? leaves(x.submenu, x, module) : [x.title]));
    return leaves(top.submenu, top, top.module);
};
const sodItems = (designation: string): string[] => sectionItems('Service Orders', [designation]);
const inventoryItems = (...designations: string[]): string[] => sectionItems('Inventory / Stores', designations);
const projectItems = (...designations: string[]): string[] => sectionItems('Projects', designations);

const VIEW = ['Pending SOD', 'Install Closed SOD', 'Completed SOD', 'Return SOD', 'Disappeared SODs', 'PAT Status Monitor', 'Contractors & Stock', 'SOD Performance & SLA', 'Invoice Status'];
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
    assert.equal(levelAllowsItem('SOD', 'approve', permsOf(['PROJECTS_ENGINEER'])), true, 'no SOD designation: capability decides');
    assert.equal(levelAllowsItem('SOD', 'approve', permsOf(['QC_OFFICER'])), false);
    assert.equal(levelAllowsItem('SOD', 'approve', undefined), true, 'an old session without designations keeps working');
    assert.equal(levelAllowsItem(undefined, undefined, permsOf(['QC_OFFICER'])), true);
    assert.ok(Object.keys(BOOTSTRAP_MENU_LEVELS.SOD).includes('AREA_COORDINATOR'));
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
// the approvers (Manager, Executive, Area Manager, OSP Manager, Head of OSP, CEO, admins) also have the Pending Approvals page
const INV_APPROVALS = ['Pending Approvals'];
const INV_OPERATE = ['Item Master Data', 'Goods Receipt (GRN)', 'Goods Issue (MIN)', 'Inventory Adjustments (Wastage)', 'Contractor Material Issue', 'Contractor Returns', 'Opening Stock', 'Virtual Material Swap', 'Material Returns (MRN)', 'Pre-ERP Legacy Recon'];

test('Inventory: the store staff and administrators have the whole menu, the Area Manager and other approvers the balances and requisitions', () => {
    for (const d of ['STORES_MANAGER', 'STORES_EXECUTIVE', 'ADMIN']) assert.deepEqual(inventoryItems(d).sort(), [...INV_VIEW, ...INV_OPERATE, ...INV_APPROVALS].sort(), d);
    // the store officers do the daily work but make no stock adjustments
    assert.deepEqual(inventoryItems('STORES_ASSISTANT').sort(), [...INV_VIEW, ...INV_OPERATE].filter((t) => !['Inventory Adjustments (Wastage)', 'Goods Receipt (GRN)', 'Item Master Data', 'Opening Stock', 'Virtual Material Swap', 'Pre-ERP Legacy Recon', 'Material Returns (MRN)', 'Pending Approvals'].includes(t)).sort(), 'the store officers');
    for (const d of ['AREA_MANAGER', 'OSP_MANAGER', 'HEAD_OF_OSP']) assert.deepEqual(inventoryItems(d).sort(), [...INV_VIEW, ...INV_APPROVALS].sort(), d);
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
    assert.equal(levelAllowsItem('INVENTORY', 'view', permsOf(['AREA_MANAGER'])), true);
    assert.equal(levelAllowsItem('INVENTORY', 'operate', permsOf(['AREA_MANAGER'])), false);
    assert.equal(levelAllowsItem('INVENTORY', 'operate', permsOf(['STORES_MANAGER'])), true);
    assert.equal(levelAllowsItem('INVENTORY', 'invoice' as never, permsOf(['STORES_MANAGER'])), false, 'a level the module does not have hides the item');
});

const PRJ_VIEW = ['All Projects', 'PM Dashboard', 'QA/QC Dashboard', 'Logistics Dashboard', 'National GIS Map'];

test('Projects: the Project Engineer and the managers run and approve, the Assistant Engineer operates, the readers see the dashboards only', () => {
    assert.deepEqual(projectItems('ENGINEER', 'PROJECTS_ENGINEER').sort(), [...PRJ_VIEW, 'IR Material Audit', 'My Tasks', 'GIS File Import'].sort(), 'a Project Engineer');
    assert.ok(projectItems('ASSISTANT_ENGINEER', 'PROJECTS_ASSISTANT_ENGINEER').includes('My Tasks'), 'an Assistant Project Engineer has My Tasks');
    assert.ok(projectItems('FINANCE_ASSISTANT').every((t) => [...PRJ_VIEW, 'Finance Dashboard', 'IR Material Audit'].includes(t)), 'a reader sees dashboards and the map only (and the IR material audit, which they can read with stock read)');
    for (const d of ['FINANCE_MANAGER', 'STORES_ASSISTANT', 'CASHIER']) assert.ok(!projectItems(d).includes('My Tasks') && !projectItems(d).includes('GIS File Import'), d + ' has no tasks and no import');
});

test('Projects: the SOD Engineer role alone has no Projects menu; the same person with the Project Engineer designation has it', () => {
    assert.deepEqual(projectItems('ENGINEER'), [], 'base Engineer: no project capability');
    assert.ok(projectItems('ENGINEER', 'PROJECTS_ENGINEER').length >= 6);
    assert.deepEqual(projectItems('AREA_COORDINATOR'), []);
    assert.deepEqual(projectItems('QC_OFFICER'), []);
});

test('three modules for one person: Engineer + Project Engineer = Service Orders (invoice), Projects (approve), Inventory (view)', () => {
    const d = ['ENGINEER', 'PROJECTS_ENGINEER'];
    assert.deepEqual([designationLevel('SOD', d), designationLevel('PROJECTS', d), designationLevel('INVENTORY', d)], ['invoice', 'approve', 'view']);
});

const section = (title: string, ...d: string[]) => sectionItems(title, d);

test('Reports: the Area Manager has the area reports and the scorecard, the company managers add the executive overview', () => {
    assert.deepEqual(section('Reports & Analytics', 'AREA_MANAGER').sort(), ['Area Performance', 'Contractor Scorecard', 'Daily Operational', 'Report Center']);
    assert.deepEqual(section('Reports & Analytics', 'OSP_MANAGER').sort(), ['Area Performance', 'Contractor Scorecard', 'Daily Operational', 'Executive Overview', 'Report Center']);
    for (const d of ['ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER']) assert.deepEqual(section('Reports & Analytics', d), [], d + ' has no reports menu');
});

test('ITMS: every area role raises tickets and sees two items; the IT staff see the queue and assets; asset audits need the approver', () => {
    for (const d of ['ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'AREA_MANAGER']) assert.deepEqual(section('ITMS & IT Help Desk', d).sort(), ['New Support Ticket', 'User Portal'], d);
    assert.ok(section('ITMS & IT Help Desk', 'SITE_OFFICE_STAFF').includes('IT Admin Queue'));
    assert.ok(!section('ITMS & IT Help Desk', 'SITE_OFFICE_STAFF').includes('Physical Asset Audits'), 'the audits are for approvers');
    assert.ok(section('ITMS & IT Help Desk', 'OFFICE_ADMIN').includes('Physical Asset Audits'));
});

test('Fleet: the office staff run the payments, the managers see vehicles, drivers and trips', () => {
    assert.ok(section('Vehicle & Fleet Management', 'OFFICE_ADMIN').includes('Fleet Payments'));
    for (const d of ['AREA_MANAGER', 'OSP_MANAGER']) {
        const items = section('Vehicle & Fleet Management', d);
        assert.ok(items.includes('All Vehicles') && items.includes('Trip Management') && !items.includes('Fleet Payments'), d);
    }
    for (const d of ['ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER']) assert.deepEqual(section('Vehicle & Fleet Management', d), [], d + ' has no fleet menu');
});

test('Fleet Payments is closed to the managers by the page too, not only by the menu', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const pages = fs.readFileSync(path.resolve(__dirname, '../../src/config/page-capabilities.ts'), 'utf8');
    assert.ok(pages.includes("prefix: '/fleet/payments', permission: RBAC_PERMISSIONS.FLEET_WRITE"));
});
