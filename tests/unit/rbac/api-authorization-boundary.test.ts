import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveRouteCapability } from '@/lib/route-capabilities';

const API_ROOT = path.resolve(process.cwd(), 'src/app/api');
const CLIENT_ROOTS = [
    path.resolve(process.cwd(), 'src/app'),
    path.resolve(process.cwd(), 'src/components'),
    path.resolve(process.cwd(), 'src/hooks'),
];

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
