import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';

test('explicit user permissions override inherited role permissions', () => {
    assert.deepEqual(
        deriveEffectivePermissions({
            permissions: '["dashboard"]',
            systemRole: { permissions: '["invoices"]' },
        }),
        ['dashboard']
    );
});

test('assigned DB roles and RolePermission rows are merged', () => {
    assert.deepEqual(
        deriveEffectivePermissions({
            permissions: null,
            systemRole: {
                permissions: '["dashboard"]',
                rolePermissions: [{ permission: 'PROJECT.READ', permissionDefinition: { code: 'project.read' } }],
            },
            sectionAssignments: [
                {
                    role: {
                        permissions: '["invoices"]',
                        rolePermissions: [{ permission: 'FINANCE.APPROVE', permissionDefinition: { code: 'finance.approve' } }],
                    },
                },
            ],
        }),
        ['dashboard', 'project.read', 'PROJECT.READ', 'invoices', 'finance.approve', 'FINANCE.APPROVE']
    );
});

test('inactive DB roles contribute no permissions', () => {
    assert.deepEqual(
        deriveEffectivePermissions({
            permissions: null,
            systemRole: { isActive: false, permissions: '["dashboard"]' },
            sectionAssignments: [{ role: { isActive: false, permissions: '["invoices"]' } }],
        }),
        []
    );
});
