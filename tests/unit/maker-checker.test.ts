import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertNotMaker } from '../../src/lib/maker-checker';

test('the maker cannot approve their own item', () => {
    assert.throws(() => assertNotMaker('u1', 'u1'), /SEGREGATION_OF_DUTIES_VIOLATION/);
});
test('another person can approve; legacy items without a maker stay approvable', () => {
    assert.doesNotThrow(() => assertNotMaker('u1', 'u2'));
    assert.doesNotThrow(() => assertNotMaker(null, 'u2'));
    assert.doesNotThrow(() => assertNotMaker(undefined, undefined));
});
test('every OSP account approval records the approver and checks the maker', () => {
    const src = fs.readFileSync('src/services/finance/osp-account-crud.service.ts', 'utf8');
    for (const fn of ['approveIOU', 'approveAdvance', 'approveRentPayment', 'approveFuelDeposit', 'approveHiringPayment']) {
        const start = src.indexOf(`static async ${fn}(`);
        const end = src.indexOf('static async ', start + 10);
        const body = src.slice(start, end < 0 ? undefined : end);
        assert.match(body, /assertNotMaker\(/, `${fn} checks the maker`);
        assert.match(body, /approvedById: actorId/, `${fn} records the approver`);
    }
});
