import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOD_CHAIN_ENTRY_STATUSES, patSatisfied } from '../../src/lib/sod-approval-rules';

const src = readFileSync(new URL('../../src/services/service-order/sod.sync.service.ts', import.meta.url), 'utf8');

test('PAT results reach finished orders, which carry sltsStatus INSTALL_CLOSED (27 Nov 2026: 782 HO-approved orders still showed waiting PAT)', () => {
    assert.ok(SOD_CHAIN_ENTRY_STATUSES.includes('INSTALL_CLOSED'));
    assert.doesNotMatch(src, /sltsStatus: 'COMPLETED'/, 'no PAT update may match only sltsStatus COMPLETED');
    assert.ok((src.match(/sltsStatus: \{ in: \[\.\.\.SOD_CHAIN_ENTRY_STATUSES\] \}/g) ?? []).length >= 2);
});

test('an HO approval passes all three PAT stages, so the order counts as PAT OK', () => {
    assert.match(src, /data: \{ hoPatStatus: 'PAT_PASSED', opmcPatStatus: 'PAT_PASSED', sltsPatStatus: 'PAT_PASSED', isInvoicable: false \}/);
    assert.equal(patSatisfied({ sltsPatStatus: 'PAT_PASSED', opmcPatStatus: 'PAT_PASSED', hoPatStatus: 'PAT_PASSED' }), true);
    assert.equal(patSatisfied({ sltsPatStatus: 'PASSED', opmcPatStatus: 'PASSED', hoPatStatus: 'PAT_PASSED' }), false, 'PASSED is not accepted');
    assert.doesNotMatch(src, /PatStatus = 'PASSED'/, 'the sync never writes the unaccepted PASSED value');
});

test('an older OPMC result never overrides a newer HO approval', () => {
    assert.match(src, /EXCLUDED\."statusDate" >= "SLTPATStatus"\."statusDate"/);
    assert.match(src, /if \(match && order\.hoPatStatus !== 'PAT_PASSED'\)/);
});
