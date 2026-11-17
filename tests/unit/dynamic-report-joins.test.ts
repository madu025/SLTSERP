import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { __joinInternals as j } from '../../src/services/inventory/dynamic-report.service';
import { describeSearch, humanizeField } from '../../src/services/ai/semantic-layer.service';

test('values travel as bound parameters, never inside the SQL text', () => {
    const params: unknown[] = [];
    const c = j.sqlCondition({ field: 'item.name', operator: 'contains', value: `x'; drop table "Contractor"; --` }, params);
    assert.equal(c.sql, 'j_item."name"::text ILIKE $1');
    assert.deepEqual(params, [`%x'; drop table "Contractor"; --%`]);
    assert.equal(c.rel, 'item');
    assert.ok(!c.sql.includes('drop'));
});

test('LIKE wildcards typed by the user are escaped so 50% means 50%', () => {
    const params: unknown[] = [];
    j.sqlCondition({ field: 'item.name', operator: 'contains', value: '50%_a' }, params);
    assert.deepEqual(params, [['%50', '%', '_a%'].join('\\')]);
});

test('numbers are checked; dates written without a time cover the whole day', () => {
    assert.throws(() => j.sqlCondition({ field: 'quantity', operator: 'gt', value: 'abc' }, []), /needs a number/);
    const p1: unknown[] = [];
    assert.equal(j.sqlCondition({ field: 'quantity', operator: 'gte', value: '5' }, p1).sql, 't."quantity" >= $1::numeric');
    assert.deepEqual(p1, [5]);
    const p2: unknown[] = [];
    assert.equal(j.sqlCondition({ field: 'serviceOrder.completedDate', operator: 'lte', value: '2026-10-31' }, p2).sql, `j_serviceOrder."completedDate" < $1::timestamp + interval '1 day'`);
    assert.equal(j.sqlCondition({ field: 'createdAt', operator: 'equals', value: '2026-10-31' }, []).sql, `(t."createdAt" >= $1::timestamp AND t."createdAt" < $1::timestamp + interval '1 day')`);
});

test('names compare without regard to case, codes and ids exactly', () => {
    assert.match(j.sqlCondition({ field: 'contractor.name', operator: 'equals', value: 'Sanjewa' }, []).sql, /ILIKE/);
    assert.equal(j.sqlCondition({ field: 'status', operator: 'equals', value: 'COMPLETED' }, []).sql, 't."status"::text = $1');
});

test('joins are built in dependency order and unknown paths are refused', () => {
    assert.equal(j.sqlJoins('materialUsage', ['serviceOrder.contractor']),
        'LEFT JOIN "ServiceOrder" j_serviceOrder ON j_serviceOrder."id" = t."serviceOrderId" LEFT JOIN "Contractor" j_serviceOrder_contractor ON j_serviceOrder_contractor."id" = j_serviceOrder."contractorId"');
    assert.throws(() => j.sqlJoins('materialUsage', ['serviceOrder.users']), /cannot be joined/);
    assert.equal(j.sqlJoins('serviceOrder', ['']), '');
});

test('row reports load only the relations they use, nested as deep as needed', () => {
    assert.equal(j.buildInclude(['soNum', 'status']), undefined);
    assert.deepEqual(j.buildInclude(['serviceOrder.soNum', 'serviceOrder.contractor.name', 'item.name']), { serviceOrder: { include: { contractor: true } }, item: true });
});

test('two filters on one relation are merged, and date-only values use day bounds', () => {
    const merged = j.mergeWhere({ item: { name: { contains: 'a' } } }, { item: { code: 'X' } });
    assert.deepEqual(merged, { item: { name: { contains: 'a' }, code: 'X' } });
    assert.deepEqual(j.mapOperator('lte', '2026-10-31'), { lt: new Date('2026-11-01T00:00:00Z') });
});

test('the evidence line names related fields in words', () => {
    assert.equal(humanizeField('serviceOrder.contractor.name'), 'Service order › Contractor › Name');
    assert.match(describeSearch({ entity: 'materialUsage', filters: [{ field: 'serviceOrder.contractor.name', operator: 'equals', value: 'Sanjewa' }], groupBy: 'item.category', rows: 2 }), /Service order › Contractor › Name equals Sanjewa · grouped by Item › Category · 2 rows/);
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
