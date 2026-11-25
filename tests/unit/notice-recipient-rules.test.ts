import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { hasCompanyReach, isValidRule, meetsLevel, previewRule, selectRecipients, type RuleCandidate } from '../../src/lib/notice-recipient-rules';

const grants = CANONICAL_BOOTSTRAP_ROLE_GRANTS as Record<string, readonly string[]>;
const permsOf = (role: string): string[] => [
    ...Object.entries(grants).filter(([, r]) => r.includes(role)).map(([p]) => p),
    ...Object.entries(MODULE_DESIGNATION_GRANTS).filter(([, r]) => r.includes(role)).map(([p]) => p),
];
const person = (id: string, role: string, areas: string[] = []): RuleCandidate => ({ id, email: `${id}@x.lk`, role, permissions: permsOf(role), areas });

test('a rule needs a module, a level that module has, and an area setting', () => {
    assert.ok(isValidRule({ module: 'SOD', minLevel: 'operate', area: 'area' }));
    assert.ok(isValidRule({ module: 'REPORTS', minLevel: 'company', area: 'company' }));
    assert.ok(!isValidRule({ module: 'SOD', minLevel: 'company', area: 'area' }), 'company is a Reports level, not a Service Orders level');
    assert.ok(!isValidRule({ module: 'NOPE', minLevel: 'operate', area: 'area' }));
    assert.ok(!isValidRule({ module: 'SOD', minLevel: 'operate', area: 'everywhere' }));
    assert.ok(!isValidRule(null));
});

test('a person meets a level when they hold it or a higher one in that module', () => {
    assert.ok(meetsLevel(permsOf('AREA_COORDINATOR'), 'SOD', 'operate'));
    assert.ok(meetsLevel(permsOf('AREA_MANAGER'), 'SOD', 'operate'), 'approve is above operate');
    assert.ok(!meetsLevel(permsOf('AREA_COORDINATOR'), 'SOD', 'approve'), 'operate is below approve');
    assert.ok(!meetsLevel(permsOf('CASHIER'), 'SOD', 'view'), 'a person with no level in the module is not a recipient');
    assert.ok(meetsLevel(permsOf('CEO'), 'REPORTS', 'company'));
    assert.ok(!meetsLevel(permsOf('AREA_MANAGER'), 'REPORTS', 'company'), 'the Area Manager reads the reports of the own areas only');
});

test('the weekly digest rule (Reports, company level, company-wide) reaches the managers and not the engineers', () => {
    const people = [person('ceo', 'CEO'), person('osp', 'OSP_MANAGER'), person('hos', 'HEAD_OF_SECTION'), person('arm', 'AREA_MANAGER', ['a1']), person('eng', 'ENGINEER', ['a1']), person('coord', 'AREA_COORDINATOR', ['a1']), person('qc', 'QC_OFFICER', ['a1'])];
    const ids = selectRecipients(people, { module: 'REPORTS', minLevel: 'company', area: 'company' }).map((p) => p.id).sort();
    assert.deepEqual(ids, ['ceo', 'hos', 'osp']);
});

test('an area rule sends to the people of that area and to those who see every area, and to nobody else', () => {
    const people = [person('ceo', 'CEO'), person('osp', 'OSP_MANAGER'), person('eng1', 'ENGINEER', ['a1']), person('eng2', 'ENGINEER', ['a2']), person('coord1', 'AREA_COORDINATOR', ['a1']), person('engNone', 'ENGINEER'), person('cashier', 'CASHIER', ['a1'])];
    const rule = { module: 'SOD', minLevel: 'operate', area: 'area' } as const;
    assert.deepEqual(selectRecipients(people, rule, 'a1').map((p) => p.id).sort(), ['ceo', 'coord1', 'eng1', 'osp']);
    assert.deepEqual(selectRecipients(people, rule, 'a2').map((p) => p.id).sort(), ['ceo', 'eng2', 'osp']);
    assert.deepEqual(selectRecipients(people, rule).map((p) => p.id).sort(), ['ceo', 'osp'], 'with no area named only the company-wide people');
    assert.ok(!selectRecipients(people, rule, 'a1').some((p) => p.id === 'cashier'), 'a person who does not work in the module never receives it');
});

test('the preview names who meets the level but has no area, so receives none of the area notices', () => {
    const people = [person('ceo', 'CEO'), person('eng1', 'ENGINEER', ['a1']), person('engNone', 'ENGINEER'), person('engNone2', 'ENGINEER')];
    const p = previewRule(people, { module: 'SOD', minLevel: 'operate', area: 'area' });
    assert.equal(p.holders.length, 4);
    assert.deepEqual(p.noArea.map((x) => x.id).sort(), ['engNone', 'engNone2']);
    assert.deepEqual(p.withArea.map((x) => x.id), ['eng1']);
    assert.deepEqual(p.companyWide.map((x) => x.id), ['ceo']);
    assert.equal(previewRule(people, { module: 'SOD', minLevel: 'operate', area: 'company' }).noArea.length, 0, 'a company-wide report has no area problem');
});

test('company reach: administrators and the company-wide scope', () => {
    assert.ok(hasCompanyReach(permsOf('ADMIN')) && hasCompanyReach(permsOf('CEO')) && hasCompanyReach(permsOf('OSP_MANAGER')));
    assert.ok(!hasCompanyReach(permsOf('ENGINEER')) && !hasCompanyReach(permsOf('AREA_MANAGER')));
});
