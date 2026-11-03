import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SIDEBAR_MENU, canAccessMenuItem } from '@/config/sidebar-menu';
import { resolveRouteCapability } from '@/lib/route-capabilities';

const API_ROOT = path.resolve(process.cwd(), 'src/app/api');
const CLIENT_ROOTS = [
    path.resolve(process.cwd(), 'src/app'),
    path.resolve(process.cwd(), 'src/components'),
    path.resolve(process.cwd(), 'src/hooks'),
];
const API_HANDLER_SOURCE = readFileSync(path.resolve(process.cwd(), 'src/lib/api-handler.ts'), 'utf8');
const ROLE_GUARD_SOURCE = readFileSync(path.resolve(process.cwd(), 'src/components/RoleGuard.tsx'), 'utf8');
const SIDEBAR_SOURCE = readFileSync(path.resolve(process.cwd(), 'src/config/sidebar-menu.ts'), 'utf8');

function routeFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? routeFiles(entryPath) : entry.name === 'route.ts' ? [entryPath] : [];
    });
}

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(entryPath);
        return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    });
}

test('API routes do not trust client identity headers or legacy role groups', () => {
    const forbidden = /ROLE_GROUPS|x-user-id|x-user-role|x-contractor-id|x-user-name|x-user-rtom|_userRole/;
    const violations = routeFiles(API_ROOT).flatMap((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        return forbidden.test(source) ? [path.relative(process.cwd(), filePath)] : [];
    });

    assert.deepEqual(violations, [], `legacy authorization references remain: ${violations.join(', ')}`);
});

test('browser code does not send spoofable identity headers', () => {
    const forbidden = /['"]x-(?:user-id|user-role|contractor-id|user-rtom|user-name)['"]/;
    const files = CLIENT_ROOTS.flatMap((root) => sourceFiles(root));
    const violations = files.flatMap((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        return forbidden.test(source) ? [path.relative(process.cwd(), filePath)] : [];
    });

    assert.deepEqual(violations, [], `spoofable client identity headers remain: ${violations.join(', ')}`);
});

test('API routes do not accept client-supplied audit or approval identities', () => {
    const forbidden = /(?:body|formData)\s*(?:\.|\.get\(['"])(?:createdById|approvedById|requestedById|recordedById|closedById|inspectorId|identifiedById|reviewerUserId|assignedById|leviedById|paidById|issuedById|loggedById)/;
    const violations = routeFiles(API_ROOT).flatMap((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        return forbidden.test(source) ? [path.relative(process.cwd(), filePath)] : [];
    });

    assert.deepEqual(violations, [], `client identity fields remain in API routes: ${violations.join(', ')}`);
});

test('all migrated API namespaces resolve to canonical capabilities', () => {
    assert.equal(resolveRouteCapability('/api/helpdesk/tickets', 'GET'), RBAC_PERMISSIONS.HELPDESK_READ);
    assert.equal(resolveRouteCapability('/api/helpdesk/disposal', 'PUT'), RBAC_PERMISSIONS.HELPDESK_APPROVE);
    assert.equal(resolveRouteCapability('/api/trips/123/start', 'POST'), RBAC_PERMISSIONS.FLEET_WRITE);
    assert.equal(resolveRouteCapability('/api/contractors', 'GET'), RBAC_PERMISSIONS.CONTRACTOR_READ);
    assert.equal(resolveRouteCapability('/api/contractors', 'POST'), RBAC_PERMISSIONS.CONTRACTOR_WRITE);
    assert.equal(resolveRouteCapability('/api/admin/users', 'GET'), RBAC_PERMISSIONS.ADMIN_RBAC);
    assert.equal(resolveRouteCapability('/api/ai/copilot', 'POST'), RBAC_PERMISSIONS.DASHBOARD_READ);
    assert.equal(resolveRouteCapability('/api/notifications/analytics', 'GET'), RBAC_PERMISSIONS.DASHBOARD_READ);
    assert.equal(resolveRouteCapability('/api/reports/daily-operational', 'GET'), RBAC_PERMISSIONS.REPORTS_READ);
    assert.equal(resolveRouteCapability('/api/gis/map-data', 'GET'), RBAC_PERMISSIONS.PROJECT_PLAN_READ);
});

test('leaves scoped public and agent-auth routes to their own boundary', () => {
    assert.equal(resolveRouteCapability('/api/contractor-portal/auth/login', 'POST'), undefined);
    assert.equal(resolveRouteCapability('/api/contractors/public-register/token', 'POST'), undefined);
    assert.equal(resolveRouteCapability('/api/helpdesk/assets/audits', 'POST'), undefined);
    assert.equal(resolveRouteCapability('/api/helpdesk/agent/telemetry', 'POST'), undefined);
});

test('API handler has no legacy role fallback and requires an explicit boundary', () => {
    assert.doesNotMatch(API_HANDLER_SOURCE, /getPrefixGuardRoles|getPrefixReadGuardRoles|options\?\.roles|options\?\.menuPath/);
    assert.match(API_HANDLER_SOURCE, /publicRoute\?: boolean/);
    assert.match(API_HANDLER_SOURCE, /Route must declare a canonical permission guard/);
});

test('RoleGuard never authorizes from allowed role arrays', () => {
    assert.doesNotMatch(ROLE_GUARD_SOURCE, /hasAccess\(/);
    assert.doesNotMatch(ROLE_GUARD_SOURCE, /allowedRoles/);
    assert.match(ROLE_GUARD_SOURCE, /resolvePageCapability/);
    assert.match(ROLE_GUARD_SOURCE, /user\.permissions/);
});

test('sidebar visibility uses canonical capabilities without role-array metadata', () => {
    assert.doesNotMatch(SIDEBAR_SOURCE, /allowedRoles|ROLE_GROUPS/);

    const nestedItems = SIDEBAR_MENU.flatMap((item) => [
        item,
        ...(item.submenu ?? []).flatMap((sub) => [sub, ...(sub.submenu ?? [])]),
    ]);
    assert.equal(nestedItems.some((item) => Object.hasOwn(item, 'allowedRoles')), false);

    assert.equal(canAccessMenuItem({
        permissionId: RBAC_PERMISSIONS.PROJECT_READ,
        pathname: '/projects',
        userPermissions: [RBAC_PERMISSIONS.PROJECT_READ],
    }), true);
    assert.equal(canAccessMenuItem({
        permissionId: 'contractor-portal',
        pathname: '/contractor/dashboard',
        userPermissions: [RBAC_PERMISSIONS.CONTRACTOR_READ],
    }), true);
    assert.equal(canAccessMenuItem({
        permissionId: RBAC_PERMISSIONS.PROJECT_READ,
        pathname: '/projects',
        userPermissions: [RBAC_PERMISSIONS.FINANCE_READ],
    }), false);
});
