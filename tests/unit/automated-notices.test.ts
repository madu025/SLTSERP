import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AUDIENCE_INFO, SCHEDULED_NOTICES, SCHEDULED_JOBS_WITHOUT_NOTICE } from '../../src/config/automated-notices';
import { NOTIFICATION_AUDIENCES } from '../../src/services/notification/notification-audiences';
import { codesToPreserve } from '../../src/lib/rbac-seed-rules';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS } from '../../src/config/rbac-bootstrap';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';
import { SIDEBAR_MENU } from '../../src/config/sidebar-menu';

/**
 * The administrator's page "Automated reports and alerts" must show everything the system sends by itself.
 * So: every audience and every scheduled job that notifies somebody is described in src/config/automated-notices.ts.
 */
test('every notification audience is described for the administrator (a new audience needs its entry)', () => {
    assert.deepEqual(Object.keys(NOTIFICATION_AUDIENCES).sort(), Object.keys(AUDIENCE_INFO).sort());
});

test('every scheduled job is either described as a notice or listed as a job that notifies nobody', () => {
    const sync = fs.readFileSync('src/services/service-order/sod.sync.service.ts', 'utf8');
    const jobs = [...sync.matchAll(/\{ name: '([a-z-]+)', type: '[A-Z_]+', at: '/g)].map((m) => m[1]);
    assert.ok(jobs.length >= 9, 'the job list was found: ' + jobs.length);
    const described = new Set([...SCHEDULED_NOTICES.map((n) => n.job), ...SCHEDULED_JOBS_WITHOUT_NOTICE]);
    assert.deepEqual(jobs.filter((j) => !described.has(j)), [], 'a scheduled job is not in the catalogue');
    assert.deepEqual([...described].filter((j) => !jobs.includes(j)), [], 'the catalogue names a job that does not exist');
    for (const n of SCHEDULED_NOTICES) for (const a of n.audiences ?? []) assert.ok(a in NOTIFICATION_AUDIENCES, `${n.job}: ${a}`);
});

test('the seed leaves the audiences that already have grants as the administrator set them, and seeds a new one', () => {
    const all = ['finance.read', 'notification.audience.ops-digest', 'notification.audience.helpdesk-ticket-managers', 'notification.audience.brand-new'];
    const kept = codesToPreserve(all, new Set(['notification.audience.ops-digest', 'notification.audience.helpdesk-ticket-managers', 'finance.read']));
    assert.deepEqual([...kept].sort(), ['notification.audience.helpdesk-ticket-managers', 'notification.audience.ops-digest']);
    assert.ok(!kept.has('finance.read'), 'only audiences are preserved, never other capabilities');
    assert.ok(!kept.has('notification.audience.brand-new'), 'an audience with no grants yet gets its starting grants');
    const seed = fs.readFileSync('scripts/seed-rbac-capabilities.ts', 'utf8');
    assert.ok(seed.includes('codesToPreserve') && seed.includes('!preserved.has('));
});

test('the new help desk audience is the IT staff, not every field engineer; the digest audience stays with the managers', () => {
    const grants = CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>;
    const tickets = grants[RBAC_PERMISSIONS.NOTIFICATION_HELPDESK_TICKET_MANAGERS] ?? [];
    assert.ok(!tickets.includes('ENGINEER'));
    for (const r of ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT', 'SITE_OFFICE_STAFF']) assert.ok(tickets.includes(r), r);
});

test('the page is in the Administration menu and its API is administrator only', () => {
    const admin = SIDEBAR_MENU.find((m) => m.title === 'Administration')!;
    const leaf = admin.submenu!.find((s) => s.path === '/admin/settings/automated-notices');
    assert.ok(leaf && leaf.permissionId === RBAC_PERMISSIONS.ADMIN_RBAC);
    for (const f of ['src/app/api/admin/automated-notices/route.ts', 'src/app/api/admin/automated-notices/[audience]/people/route.ts']) {
        assert.ok(fs.readFileSync(f, 'utf8').includes('RBAC_PERMISSIONS.ADMIN_RBAC'), f);
    }
});
