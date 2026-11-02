import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSodForInvoicing } from '../../src/services/service-order/sod-financial-validation';

const sodServiceSource = readFileSync('src/services/service-order/index.ts', 'utf8');
const ledgerSource = readFileSync('src/services/finance/ledger.service.ts', 'utf8');
const syncSource = readFileSync('src/services/service-order/sod.sync.service.ts', 'utf8');

const baseSod = {
    soNum: 'SO-TEST-001',
    contractorId: 'contractor-1',
    completedDate: new Date('2026-10-26T00:00:00.000Z'),
    revenueAmount: 1000,
    contractorAmount: 600,
    sltsPatStatus: 'PAT_PASSED',
    opmcPatStatus: 'PAT_PASSED',
    hoPatStatus: 'PAT_PASSED',
};

test('a completed SOD with financial snapshots is invoice-eligible', () => {
    assert.deepEqual(validateSodForInvoicing(baseSod), { eligible: true, reasons: [] });
});
test('missing contractor cost blocks invoice verification', () => {
    const result = validateSodForInvoicing({ ...baseSod, contractorAmount: null });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes('CONTRACTOR_COST_SNAPSHOT_MISSING_OR_INVALID'));
});

test('financial verification cannot replace missing PAT approvals', () => {
    const result = validateSodForInvoicing({ ...baseSod, hoPatStatus: 'PENDING' });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes('PAT_APPROVALS_INCOMPLETE'));
});

test('PAT approval is required at every approval level', () => {
    const result = validateSodForInvoicing({ ...baseSod, sltsPatStatus: 'PASSED' });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes('PAT_APPROVALS_INCOMPLETE'));
});

test('financial verification does not manufacture PAT status evidence', () => {
    const start = sodServiceSource.indexOf('static async verifyInvoicable');
    const end = sodServiceSource.indexOf('\n    }', start);
    const verifyBlock = sodServiceSource.slice(start, end);
    assert.doesNotMatch(verifyBlock, /sltsPatStatus:\s*['"]PAT_PASSED['"]/);
    assert.doesNotMatch(verifyBlock, /opmcPatStatus:\s*['"]PAT_PASSED['"]/);
    assert.doesNotMatch(verifyBlock, /hoPatStatus:\s*['"]PAT_PASSED['"]/);
});

test('manual and sync completion use an idempotent contractor accrual posting', () => {
    assert.match(ledgerSource, /referenceType:\s*'CONTRACTOR_ACCRUAL',[\s\S]*?idempotencyKey:\s*`CONTRACTOR_ACCRUAL_\$\{sodId\}`/);
    assert.match(syncSource, /if \(isCompleting && updated\.contractorAmount\)/);
    assert.match(syncSource, /LedgerService\.logContractorAccrual\(/);
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
