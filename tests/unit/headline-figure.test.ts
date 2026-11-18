import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { headlineFigure } from '../../src/app/dashboard/components/health/headline-figure';

test('the first figure of an alert sentence becomes the big number', () => {
    assert.equal(headlineFigure('Net result -1,665,828 for Nov 2026'), '-1.67 M');
    assert.equal(headlineFigure('Bank and petty cash net -50,584'), '-50,584');
    assert.equal(headlineFigure('348 orders have been open for more than 30 days'), '348');
    assert.equal(headlineFigure('Only 73.3% of the last 7,426 completed orders finished within the 7-day target'), '73.3%');
    assert.equal(headlineFigure('25 payment voucher(s) in the last 30 days'), '25');
    assert.equal(headlineFigure('Net result 250,000'), '250 K');
    assert.equal(headlineFigure('Everything is fine'), null);
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
