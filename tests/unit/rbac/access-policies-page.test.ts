import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { RBAC_PERMISSION_DEFINITIONS, RBAC_PERMISSIONS } from '@/config/rbac-permissions';

const PAGE_PATH = path.resolve(process.cwd(), 'src/app/admin/settings/access-policies/page.tsx');
const PAGE_SOURCE = readFileSync(PAGE_PATH, 'utf8');

test('access policy UI is a canonical capability registry, not a legacy role editor', () => {
    assert.doesNotMatch(PAGE_SOURCE, /ROLE_GROUPS|allowedRoles|PAGE_ACCESS_POLICIES/);
    assert.doesNotMatch(PAGE_SOURCE, /fetch\(['"]\/api\/admin\/access-policies/);
    assert.match(PAGE_SOURCE, /RBAC_PERMISSION_DEFINITIONS/);
    assert.match(PAGE_SOURCE, /permissionId=\{RBAC_PERMISSIONS\.ADMIN_RBAC\}/);
    assert.match(PAGE_SOURCE, /RolePermission/);
});

test('every canonical permission definition has a stable capability identity for the registry', () => {
    assert.ok(RBAC_PERMISSION_DEFINITIONS.length > 0);
    assert.equal(new Set(RBAC_PERMISSION_DEFINITIONS.map((definition) => definition.code)).size, RBAC_PERMISSION_DEFINITIONS.length);
    assert.equal(RBAC_PERMISSION_DEFINITIONS.some((definition) => definition.code === RBAC_PERMISSIONS.ADMIN_RBAC), true);
    assert.equal(RBAC_PERMISSION_DEFINITIONS.every((definition) => (
        definition.code.length > 0
        && definition.module.length > 0
        && definition.action.length > 0
        && definition.scope.length > 0
        && definition.description.length > 0
    )), true);
});
