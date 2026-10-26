import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSodForInvoicing } from '../../src/services/service-order/sod-financial-validation';

const baseSod = {
    soNum: 'SO-TEST-001',
    contractorId: 'contractor-1',
    completedDate: new Date('2026-10-26T00:00:00.000Z'),
    revenueAmount: 1000,
    contractorAmount: 600,
};

test('a completed SOD with financial snapshots is invoice-eligible', () => {
    assert.deepEqual(validateSodForInvoicing(baseSod), { eligible: true, reasons: [] });
});
test('missing contractor cost blocks invoice verification', () => {
    const result = validateSodForInvoicing({ ...baseSod, contractorAmount: null });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes('CONTRACTOR_COST_SNAPSHOT_MISSING_OR_INVALID'));
});

test('a recorded material usage row must have a positive cost', () => {
    const result = validateSodForInvoicing({
        ...baseSod,
        materialUsage: [{ quantity: 2, unitPrice: 0, costPrice: 0 }],
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes('MATERIAL_COST_MISSING_OR_INVALID'));
});

test('a positive unit price is accepted when cost price is the default zero', () => {
    const result = validateSodForInvoicing({
        ...baseSod,
        materialUsage: [{ quantity: 2, unitPrice: 125, costPrice: 0 }],
    });
    assert.deepEqual(result, { eligible: true, reasons: [] });
});
