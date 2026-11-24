import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIDEBAR_MENU, canAccessMenuItem, type MenuItem } from '../../src/config/sidebar-menu';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { resolvePageCapability } from '../../src/config/page-capabilities';

/** Every menu entry a role sees must open for that role: no dead link, from the bootstrap grants. */
const grants = CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>;
const roles = [...new Set([...Object.values(grants), ...Object.values(MODULE_DESIGNATION_GRANTS)].flat())].sort();
const grantsOf = (role: string): string[] => [...new Set([
    ...Object.entries(grants).filter(([, r]) => r.includes(role)).map(([p]) => p),
    ...Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, r]) => r.includes(role)).map(([p]) => p),
])];

test('no role sees a menu entry whose page it cannot open', () => {
    const dead: string[] = [];
    for (const role of roles) {
        const perms = grantsOf(role);
        const ok = (m: MenuItem, parent?: MenuItem, module?: MenuItem['module']) => canAccessMenuItem({ itemTitle: m.title, permissionId: m.permissionId || parent?.permissionId, userPermissions: perms, pathname: m.path, designations: [role], module: m.module ?? module, level: m.level });
        const walk = (list: MenuItem[], top: MenuItem, parent: MenuItem) => {
            for (const m of list) {
                if (!ok(m, parent, top.module)) continue;
                if (m.submenu) { walk(m.submenu, top, m); continue; }
                const cap = m.path && m.path !== '#' ? resolvePageCapability(m.path) : undefined;
                if (cap && !perms.includes(cap)) dead.push(`${role}: ${top.title} > ${m.title} (${m.path} needs ${cap})`);
            }
        };
        for (const top of SIDEBAR_MENU) {
            if (!ok(top)) continue;
            if (top.submenu) walk(top.submenu, top, top);
            else { const cap = resolvePageCapability(top.path); if (cap && !perms.includes(cap)) dead.push(`${role}: ${top.title} (${top.path} needs ${cap})`); }
        }
    }
    assert.deepEqual(dead, []);
});

test('the OSP Manager step of the invoices and of the contractor registrations is in the OSP Manager menu', () => {
    const approvals = SIDEBAR_MENU.find((m) => m.title === 'Approvals')!;
    const titles = (approvals.submenu ?? []).map((s) => s.title);
    assert.ok(titles.includes('OSP Manager Approvals') && titles.includes('Contractor Registrations'));
    const perms = grantsOf('OSP_MANAGER');
    for (const t of ['OSP Manager Approvals', 'Contractor Registrations']) {
        const item = approvals.submenu!.find((s) => s.title === t)!;
        assert.ok(canAccessMenuItem({ itemTitle: item.title, permissionId: item.permissionId, userPermissions: perms, pathname: item.path, designations: ['OSP_MANAGER'] }), t);
    }
});

test('the cashier and the AR officer do not get the QA/QC and logistics dashboards of the projects', () => {
    const projects = SIDEBAR_MENU.find((m) => m.title === 'Projects')!;
    for (const role of ['CASHIER', 'AR_OFFICER']) {
        const perms = grantsOf(role);
        for (const t of ['PM Dashboard', 'QA/QC Dashboard', 'Logistics Dashboard']) {
            const item = projects.submenu!.find((s) => s.title === t)!;
            assert.equal(canAccessMenuItem({ itemTitle: item.title, permissionId: item.permissionId, userPermissions: perms, pathname: item.path, designations: [role], module: projects.module, level: item.level }), false, `${role} ${t}`);
        }
    }
});
