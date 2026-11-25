import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS } from '../../src/config/rbac-bootstrap';
import { NOTIFICATION_AUDIENCES } from '../../src/services/notification/notification-audiences';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';

/**
 * The Monday operations digest holds company-wide figures and exceptions. It must go to the managers who read the company,
 * not to every engineer, coordinator and QC officer that holds the shared SOD_PROJECT audience (205 people in production, 180 of them engineers).
 */
const grants = CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>;

test('the digest has its own audience, held by the company managers only', () => {
    assert.equal(NOTIFICATION_AUDIENCES.OPS_DIGEST.permission, RBAC_PERMISSIONS.NOTIFICATION_OPS_DIGEST);
    const holders = grants[RBAC_PERMISSIONS.NOTIFICATION_OPS_DIGEST] ?? [];
    for (const r of ['CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'HEAD_OF_SECTION', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']) assert.ok(holders.includes(r), r);
    for (const r of ['ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'AREA_MANAGER', 'STORES_MANAGER', 'FINANCE_MANAGER', 'CASHIER']) assert.ok(!holders.includes(r), r + ' must not receive the company digest');
});

test('the digest service sends to that audience, for the notification and for the email', () => {
    const text = fs.readFileSync('src/services/notification/ops-weekly-digest.service.ts', 'utf8');
    assert.ok(text.includes("audience: 'OPS_DIGEST'"));
    assert.ok(text.includes("getAudienceRecipients({ audience: 'OPS_DIGEST' })"));
    assert.ok(!text.includes("'SOD_PROJECT'"), 'the shared audience is not used for the digest');
});

test('the ordinary service-order notices keep their own audience, which the engineers still hold', () => {
    assert.ok((grants[RBAC_PERMISSIONS.NOTIFICATION_SOD_PROJECT] ?? []).includes('ENGINEER'));
});
