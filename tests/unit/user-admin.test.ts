import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    USER_STATUSES, USER_DEPARTMENTS, OPMC_REQUIRED_ROLES, normalizeUserStatus, isActiveStatus, passwordProblem, generateTemporaryPassword,
    roleNeedsOpmc, roleNeedsStoreOrOpmc, departmentRoles,
} from '../../src/config/user-admin';
import { ROLE_CATEGORIES } from '../../src/config/roles';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('statuses are compared without caring about letter case', () => {
    assert.equal(normalizeUserStatus('ACTIVE'), 'active');
    assert.equal(normalizeUserStatus(null), 'active');
    assert.ok(isActiveStatus('ACTIVE') && isActiveStatus('active') && !isActiveStatus('inactive') && !isActiveStatus('resigned'));
    assert.deepEqual([...USER_STATUSES], ['active', 'inactive', 'resigned']);
});

test('the password policy: 8+ characters with a letter and a number', () => {
    assert.ok(passwordProblem('abc123'));
    assert.ok(passwordProblem('abcdefghij'));
    assert.ok(passwordProblem('12345678'));
    assert.ok(passwordProblem('a'.repeat(129) + '1'));
    assert.equal(passwordProblem('Temp1234x'), null);
    assert.ok(passwordProblem(''));
    assert.ok(passwordProblem(undefined));
});

test('a generated temporary password always passes the policy and is not repeated', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
        const p = generateTemporaryPassword();
        assert.equal(passwordProblem(p), null, p);
        assert.ok(!/[01OIl]/.test(p), 'no look-alike characters');
        seen.add(p);
    }
    assert.ok(seen.size > 190);
});

test('regional roles need an OPMC; company-wide, contractor and admin roles do not', () => {
    for (const r of ['ENGINEER', 'AREA_MANAGER', 'QC_OFFICER', 'AREA_COORDINATOR', 'SA_MANAGER', 'MANAGER']) assert.ok(roleNeedsOpmc(r), r);
    for (const r of ['SUPER_ADMIN', 'ADMIN', 'CEO', 'OSP_MANAGER', 'FINANCE_MANAGER', 'SF_AUDIT_OFFICER', 'CONTRACTOR_FINANCE', 'STORES_MANAGER']) assert.ok(!roleNeedsOpmc(r), r);
    assert.ok(roleNeedsStoreOrOpmc('STORES_ASSISTANT') && !roleNeedsStoreOrOpmc('ENGINEER'));
    const all = Object.values(ROLE_CATEGORIES).flat();
    for (const r of OPMC_REQUIRED_ROLES) assert.ok(all.includes(r), `${r} is a known role`);
});

test('every department tab lists real roles, and the department filter finds them', () => {
    const known = new Set(Object.values(ROLE_CATEGORIES).flat());
    assert.ok(!USER_DEPARTMENTS.some((d) => d.id === 'CONTRACTOR'), 'no contractor tab: contractor logins belong to the contractor registration');
    for (const d of USER_DEPARTMENTS) {
        assert.ok(d.roles.length > 0, d.id);
        for (const r of d.roles) assert.ok(known.has(r), `${d.id}: ${r}`);
        assert.deepEqual(departmentRoles(d.id), d.roles);
    }
    assert.equal(departmentRoles('NOPE'), null);
});

test('users are created and edited on the RBAC model, by one service used by the form, the API and the scripts', () => {
    const svc = read('src/services/hr/user-admin.service.ts');
    assert.ok(svc.includes("systemRole: { connect: { id: base.id } }"), 'the base role (roleId) is set, from the SystemRole of the role');
    assert.ok(svc.includes("NO_SYSTEM_ROLE"), 'a role without a SystemRole is refused, not silently skipped');
    assert.ok(svc.includes('mustChangePassword: true'), 'the person changes the administrator-set password at the first sign-in');
    assert.ok(svc.includes('employeeId,') || svc.includes('employeeId:'), 'the employee ID is saved on the user');
    assert.ok(!/permissions:\s*(JSON|permissions)/.test(svc.replace(/permissions: roleChanged \? null : undefined/, '')), 'the manual permission list is never written from the form');
    assert.ok(svc.includes('renderEmailByCode(\'USER_ACCOUNT_CREATED\''), 'the welcome email goes through the DB template');
    assert.ok(!/data.password|u.password/.test(svc.slice(svc.indexOf('private static async sendWelcomeEmail'))), 'the password is never put in the email');
    const action = read('src/actions/user-actions.ts');
    assert.ok(action.includes('UserAdminService.create') && action.includes('UserAdminService.update') && action.includes('UserAdminService.resetPassword'), 'the form actions use the service');
    const old = read('src/services/hr/user.service.ts');
    assert.ok(old.includes('UserAdminService.create') && old.includes('UserAdminService.update') && old.includes('UserAdminService.list'), 'the older entry points delegate to it');
});

test('the list is paged on the server with counts over every account, and the form no longer carries the page-name override', () => {
    const page = read('src/app/admin/users/page.tsx');
    assert.ok(page.includes('PAGE_SIZE') && page.includes('totalPages') && page.includes('stats?.all'), 'paging and server counts');
    assert.ok(!page.includes('limit=1000'), 'the page does not ask for 1000 rows (the API caps at 200 and the rest vanished)');
    const drawer = read('src/app/admin/users/components/UserFormDrawer.tsx');
    assert.ok(!drawer.includes('AVAILABLE_PAGES'), 'the old override that replaced every role grant is gone');
    assert.ok(drawer.includes('placeholderData') && !drawer.includes('initialData: {\n      roles'), 'role options are really fetched (initialData with a stale time never fetched them)');
    const api = read('src/app/api/users/route.ts');
    assert.ok((api.match(/permissions: \[RBAC_PERMISSIONS\.ADMIN_RBAC\]/g) ?? []).length === 3, 'create, update and delete need the admin capability at the API too');
    assert.ok(read('src/app/api/users/[id]/reset-password/route.ts').includes('UserAdminService.resetPassword'), 'a reset-password endpoint exists (the page used to fall back to a full update)');
});

test('every place a password is chosen uses the one policy', () => {
    for (const f of ['src/components/ForcePasswordChangeModal.tsx', 'src/app/profile/page.tsx', 'src/app/forgot-password/page.tsx', 'src/app/api/auth/forgot-password/reset/route.ts', 'src/services/hr/user.service.ts']) {
        const s = read(f);
        assert.ok(s.includes('passwordProblem'), `${f} uses passwordProblem`);
        assert.ok(!/length < 6|min\(6/.test(s), `${f} has no older length rule`);
    }
});

test('the welcome email template is registered and seeded', () => {
    assert.ok(read('src/config/notification-templates.ts').includes("code: 'USER_ACCOUNT_CREATED'"));
    assert.ok(read('prisma/seed-notification-templates.ts').includes("code: 'USER_ACCOUNT_CREATED'"));
});

test('a role change keeps the other designations, and an admin-capable designation needs a Super Admin', () => {
    const svc = read('src/services/hr/user-admin.service.ts');
    assert.ok(svc.includes('oldUsual') && svc.includes("roleId: { in: [...oldUsual] }"), 'only the old role usual designations are removed');
    assert.ok(!/if \(roleChanged\) designations = /.test(svc), 'a role change no longer wipes every designation');
    assert.ok(svc.includes('callerCanGrantAdmin') && svc.includes('RBAC_PERMISSIONS.ADMIN_RBAC'), 'an administrator designation is only assignable by a Super Admin');
});

test('a designation fits only its own base role (SECTION_ROLE), or no role at all', async () => {
    const { designationRoleOf, designationFitsRole } = await import('../../src/config/user-admin');
    const roles = Object.values(ROLE_CATEGORIES).flat();
    assert.equal(designationRoleOf('PROJECTS_ENGINEER', 'PROJECTS', roles), 'ENGINEER');
    assert.equal(designationRoleOf('PROJECTS_ASSISTANT_ENGINEER', 'PROJECTS', roles), 'ASSISTANT_ENGINEER');
    assert.equal(designationRoleOf('REGIONAL_GENERAL_MANAGER', 'EXECUTIVE', roles), null);
    assert.ok(designationFitsRole('PROJECTS_ENGINEER', 'PROJECTS', 'ENGINEER', roles));
    assert.ok(!designationFitsRole('PROJECTS_ENGINEER', 'PROJECTS', 'FINANCE_ASSISTANT', roles));
    assert.ok(!designationFitsRole('PROJECTS_ENGINEER', 'PROJECTS', 'ASSISTANT_ENGINEER', roles));
    assert.ok(designationFitsRole('REGIONAL_GENERAL_MANAGER', 'EXECUTIVE', 'FINANCE_ASSISTANT', roles));
});

test('data scope by domain: a scope capability opens one domain, nothing else, and a call without a domain stays strict', async () => {
    const { scopeFromPermissions } = await import('../../src/lib/opmc-scope');
    const { CANONICAL_BOOTSTRAP_ROLE_GRANTS } = await import('../../src/config/rbac-bootstrap');
    const own = ['opmc-1'];
    assert.equal(scopeFromPermissions(['admin.rbac'], own), undefined, 'an administrator sees everything');
    assert.deepEqual(scopeFromPermissions(['finance.read'], own, 'finance'), own, 'a function alone never widens the data');
    assert.equal(scopeFromPermissions(['scope.finance.all'], [], 'finance'), undefined, 'finance scope opens finance');
    assert.deepEqual(scopeFromPermissions(['scope.finance.all'], [], 'sod'), [], 'finance scope does not open service orders');
    assert.deepEqual(scopeFromPermissions(['scope.finance.all'], own, undefined), own, 'a call with no domain stays strict');
    assert.equal(scopeFromPermissions(['scope.company.all'], [], 'procurement' as never), undefined, 'company scope opens every domain');
    assert.deepEqual(scopeFromPermissions([], [], 'sod'), [], 'no OPMC and no scope capability sees nothing');

    const g = CANONICAL_BOOTSTRAP_ROLE_GRANTS as unknown as Record<string, string[]>;
    for (const r of ['CEO', 'HEAD_OF_OSP', 'OSP_MANAGER']) for (const c of ['scope.company.all', 'scope.sod.all', 'scope.project.all', 'scope.inventory.all', 'scope.reports.all', 'scope.finance.all']) assert.ok(g[c].includes(r), `${r} ${c}`);
    for (const r of ['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER']) assert.ok(g['scope.finance.all'].includes(r), r);
    // finance people see the money of every region but never the service orders, reports or company-wide data
    for (const c of ['scope.sod.all', 'scope.reports.all', 'scope.company.all']) {
        for (const r of ['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'INVOICE_MANAGER', 'SF_AUDIT_OFFICER']) assert.ok(!g[c].includes(r), `${r} must not have ${c}`);
    }
    for (const r of ['FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'CASHIER', 'AR_OFFICER', 'INVOICE_MANAGER', 'INVOICE_ASSISTANT', 'SF_AUDIT_MANAGER', 'SF_AUDIT_OFFICER']) assert.ok(g['scope.project.all'].includes(r) && g['invoice.status.read'].includes(r), `${r}: project money and Invoice Status`);
    for (const c of ['scope.procurement.all', 'scope.contractor.all', 'scope.inventory.all']) for (const r of ['FINANCE_MANAGER', 'FINANCE_ASSISTANT']) assert.ok(g[c].includes(r), `${r} ${c}`);
    for (const r of ['STORES_MANAGER', 'PROCUREMENT_OFFICER']) assert.ok(g['scope.inventory.all'].includes(r), `${r} sees every store`);
    assert.ok(!g['scope.inventory.all'].includes('STORES_EXECUTIVE') && !g['scope.inventory.all'].includes('STORES_ASSISTANT'), 'the Executive and the officers work in their assigned stores');
    for (const r of ['CEO', 'HEAD_OF_OSP', 'OSP_MANAGER']) for (const c of ['reports.read', 'reports.manager.read', 'reports.area.read']) assert.ok(g[c].includes(r), `${r} ${c}`);
    // the finance people read purchase orders and stock value but cannot change them
    for (const r of ['FINANCE_MANAGER', 'FINANCE_ASSISTANT']) { assert.ok(g['procurement.read'].includes(r) && g['inventory.read'].includes(r)); assert.ok(!g['procurement.write'].includes(r) && !g['inventory.write'].includes(r)); }
    assert.ok(!g['sod.read'].includes('FINANCE_MANAGER') && !g['sod.read'].includes('FINANCE_ASSISTANT'), 'finance still cannot open service orders');
    assert.ok(!g['scope.sod.all'].includes('AREA_MANAGER') && !g['scope.company.all'].includes('STORES_MANAGER'));
});

test('every module passes its domain to the scope check; admin-only and notification checks stay strict', () => {
    const files: Array<[string, string]> = [
        ['src/services/invoice/invoice-status.service.ts', 'finance'], ['src/services/invoice/invoicing.service.ts', 'finance'], ['src/lib/payment-voucher-access.ts', 'finance'],
        ['src/services/service-order/sod-dashboard.service.ts', 'sod'], ['src/lib/project-access.ts', 'project'], ['src/services/inventory/store.service.ts', 'inventory'],
        ['src/lib/report-scope.ts', 'reports'], ['src/app/api/opmcs/route.ts', 'company'],
    ];
    for (const [f, d] of files) assert.ok(new RegExp(`resolveOpmcScope\([^)]*, '${d}'\)`).test(read(f)), `${f} uses the ${d} domain`);
    assert.ok(!/resolveOpmcScope\([^)]*, '/.test(read('src/app/api/admin/control/route.ts')), 'the admin control monitor stays strict');
    assert.ok(!/resolveOpmcScope\([^)]*, '/.test(read('src/services/notification/index.ts')), 'the notification inbox stays strict');
});
