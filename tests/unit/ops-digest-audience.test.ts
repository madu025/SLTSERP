import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';
import { RULE_BASED_NOTICES } from '../../src/config/automated-notices';
import { selectRecipients, type RuleCandidate } from '../../src/lib/notice-recipient-rules';

/**
 * The Monday operations digest holds company-wide figures and exceptions. It must go to the managers who read the company,
 * not to every engineer, coordinator and QC officer that holds the shared SOD_PROJECT audience (205 people in production, 180 of them engineers).
 * Who receives it is a rule (module, job level, area): by default the company-wide reports level of the Reports module.
 */
const grants = CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>;
const permsOf = (role: string): string[] => [
    ...Object.entries(grants).filter(([, r]) => r.includes(role)).map(([p]) => p),
    ...Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, r]) => r.includes(role)).map(([p]) => p),
];
const person = (role: string): RuleCandidate => ({ id: role, email: `${role}@x.lk`, permissions: permsOf(role), areas: ['a1'] });

test('the digest rule is Reports, company level, company-wide, and reaches the company managers only', () => {
    assert.deepEqual(RULE_BASED_NOTICES['ops-weekly-digest'], { module: 'REPORTS', minLevel: 'company', area: 'company' });
    const roles = ['CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'HEAD_OF_SECTION', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER', 'AREA_MANAGER', 'STORES_MANAGER', 'FINANCE_MANAGER', 'CASHIER'];
    const got = selectRecipients(roles.map(person), RULE_BASED_NOTICES['ops-weekly-digest']).map((p) => p.id).sort();
    assert.deepEqual(got, ['ADMIN', 'CEO', 'HEAD_OF_OSP', 'HEAD_OF_SECTION', 'MANAGER', 'OSP_MANAGER', 'SUPER_ADMIN']);
});

test('the digest service sends by the rule, for the notification and for the email', () => {
    const text = fs.readFileSync('src/services/notification/ops-weekly-digest.service.ts', 'utf8');
    assert.ok(text.includes("NoticeRulesService.notify('ops-weekly-digest'"));
    assert.ok(text.includes("NoticeRulesService.resolve('ops-weekly-digest')"));
    assert.ok(!text.includes("'SOD_PROJECT'"), 'the shared audience is not used for the digest');
});

test('the ordinary service-order notices keep their own audience, which the engineers still hold', () => {
    assert.ok((grants[RBAC_PERMISSIONS.NOTIFICATION_SOD_PROJECT] ?? []).includes('ENGINEER'));
});
