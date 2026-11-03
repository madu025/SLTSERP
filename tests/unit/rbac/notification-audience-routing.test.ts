import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    NOTIFICATION_AUDIENCES,
    resolveProcessGateAudience,
} from '@/services/notification/notification-audiences';

const notificationService = readFileSync('src/services/notification/index.ts', 'utf8');
const audienceSource = readFileSync('src/services/notification/notification-audiences.ts', 'utf8');
const dynamicPolicySchema = readFileSync('prisma/schema/dynamic-policy.prisma', 'utf8');
const cleanupMigration = readFileSync('prisma/migrations/20261104000000_canonical_change_approvals_and_drop_notification_role_snapshot/migration.sql', 'utf8');
const targetSources = [
    'src/services/notification/notification-policy.service.ts',
    'src/services/notification/domain-policies.service.ts',
    'src/services/automation/index.ts',
    'src/services/service-order/sod-auto-completion.service.ts',
    'src/services/service-order/sod.sync.service.ts',
    'src/services/invoice/invoice.service.ts',
    'src/services/helpdesk/helpdesk.service.ts',
    'src/services/inventory/mrn.service.ts',
    'src/services/inventory/stock-request.service.ts',
    'src/services/project/project-approval.service.ts',
].map((path) => readFileSync(path, 'utf8'));

test('notification audiences are canonical capability identifiers', () => {
    assert.ok(Object.keys(NOTIFICATION_AUDIENCES).length >= 10);
    assert.match(audienceSource, /PermissionDefinition|capability-backed/);
    assert.doesNotMatch(audienceSource, /ROLE_GROUPS|\buser\.role\s*[!=]|where: \{ role/);
});

test('process-gate notification routing is canonical and fail-closed', () => {
    assert.equal(resolveProcessGateAudience('PROCESS_GATE_STORES'), 'PROCESS_GATE_STORES');
    assert.equal(resolveProcessGateAudience('UNKNOWN_AUDIENCE'), null);
    assert.equal(resolveProcessGateAudience(null), null);
    assert.doesNotMatch(audienceSource, /rolesToNotify|resolveLegacyProcessGateAudience/);
    assert.doesNotMatch(dynamicPolicySchema, /rolesToNotify/);
    assert.match(cleanupMigration, /DROP COLUMN IF EXISTS "rolesToNotify"/);
    assert.match(cleanupMigration, /\["HOS"\]/);
    assert.match(cleanupMigration, /RAISE EXCEPTION/);
});

test('recipient resolution honors active definitions, explicit overrides, and OPMC scope', () => {
    assert.match(notificationService, /permissionDefinition: \{[\s\S]*?isActive: true/);
    assert.match(notificationService, /user\.permissions !== null && user\.permissions !== undefined/);
    assert.match(notificationService, /const effectivePermissions = directPermissions \?\? inheritedPermissions/);
    assert.match(notificationService, /accessibleOpmcs\.some/);
    assert.match(notificationService, /assignedStore\?\.opmcs\.some/);
    assert.match(notificationService, /NOTIFICATION_GLOBAL/);
});

test('all migrated notification callsites use audience API and preserve dedup inputs', () => {
    for (const source of targetSources) {
        assert.doesNotMatch(source, /notifyByRole/);
        assert.doesNotMatch(source, /ROLE_GROUPS/);
    }
    assert.match(notificationService, /static async notifyByAudience/);
    assert.match(notificationService, /dedupKey/);
    assert.match(notificationService, /return await this\.broadcast/);
});
