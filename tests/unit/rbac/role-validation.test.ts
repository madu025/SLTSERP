import assert from 'node:assert/strict';
import test from 'node:test';
import { ROLE_GROUPS } from '@/config/roles';
import { isDatabaseRole } from '@/lib/role-validation';
import { VALID_ROLES } from '@/config/valid-roles';
import { hasRouteAccess } from '@/config/route-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveRouteCapability } from '@/lib/route-capabilities';

test('all configured RBAC group roles belong to the database Role enum', () => {
    const valid = new Set(VALID_ROLES);
    const invalid = Object.entries(ROLE_GROUPS).flatMap(([group, roles]) =>
        roles.filter((role) => !valid.has(role)).map((role) => `${group}:${role}`)
    );

    assert.deepEqual(invalid, []);
});

test('unknown organization label is not accepted as an authorization role', () => {
    assert.equal(isDatabaseRole('CUSTOM_ORGANIZATION_MANAGER'), false);
    assert.equal(isDatabaseRole('FINANCE_MANAGER'), true);
});

test('SOD module group includes OSP project roles for read access', () => {
    assert.equal(ROLE_GROUPS.SOD_MODULE_USERS.includes('AREA_MANAGER'), true);
    assert.equal(ROLE_GROUPS.SOD_MODULE_USERS.includes('SA_MANAGER'), true);
    assert.equal(ROLE_GROUPS.SOD_MODULE_USERS.includes('OSP_ENGINEER'), true);
    assert.equal(ROLE_GROUPS.SOD_MODULE_USERS.includes('CIVIL_SUPERVISOR'), true);
    assert.equal(ROLE_GROUPS.SOD_MODULE_USERS.includes('CABLE_SPLICER'), true);
});

test('frontend SOD routes follow the same module boundary', () => {
    const sodPaths = [
        '/service-orders/work-order',
        '/service-orders/work-order/pat',
        '/service-orders/work-order/offline-work-orders'
    ];

    for (const path of sodPaths) {
        assert.equal(hasRouteAccess(path, 'OSP_ENGINEER'), false, `${path} must reject OSP_ENGINEER`);
        assert.equal(hasRouteAccess(path, 'OSP_ENGINEER', [RBAC_PERMISSIONS.SOD_READ]), true, `${path} must allow DB-granted OSP_ENGINEER`);
        assert.equal(hasRouteAccess(path, 'AREA_MANAGER', [RBAC_PERMISSIONS.SOD_READ]), true, `${path} must allow DB-granted AREA_MANAGER`);
    }

    assert.equal(hasRouteAccess('/service-orders/invoicable', 'SA_MANAGER'), false);
    assert.equal(hasRouteAccess('/service-orders/invoicable', 'ENGINEER', [RBAC_PERMISSIONS.SOD_INVOICE]), true);
});

test('frontend project routes use DB capabilities rather than role names', () => {
    assert.equal(hasRouteAccess('/projects', 'OSP_ENGINEER'), false);
    assert.equal(hasRouteAccess('/projects', 'OSP_ENGINEER', [RBAC_PERMISSIONS.PROJECT_READ]), true);
    assert.equal(hasRouteAccess('/projects/dashboards/financials', 'OSP_ENGINEER', [RBAC_PERMISSIONS.PROJECT_READ]), false);
    assert.equal(hasRouteAccess('/projects/dashboards/financials', 'FINANCE_MANAGER', [RBAC_PERMISSIONS.FINANCE_READ]), true);
});

test('API route capability defaults separate module and action boundaries', () => {
    assert.equal(resolveRouteCapability('/api/service-orders', 'GET'), RBAC_PERMISSIONS.SOD_READ);
    assert.equal(resolveRouteCapability('/api/service-orders', 'POST'), RBAC_PERMISSIONS.SOD_WRITE);
    assert.equal(resolveRouteCapability('/api/projects/123/approvals', 'POST'), RBAC_PERMISSIONS.PROJECT_APPROVE);
    assert.equal(resolveRouteCapability('/api/projects/123/expenses', 'GET'), RBAC_PERMISSIONS.FINANCE_READ);
    assert.equal(resolveRouteCapability('/api/projects/123/expenses', 'POST'), RBAC_PERMISSIONS.FINANCE_WRITE);
    assert.equal(resolveRouteCapability('/api/projects', 'DELETE'), RBAC_PERMISSIONS.ADMIN_RBAC);
});
