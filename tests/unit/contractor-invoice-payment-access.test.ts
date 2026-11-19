import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sodInvoiceIdOf, areaAllows, SOD_INVOICE_REF } from '../../src/lib/payment-voucher-access';
import { claimMonthLabel, retentionPercent, approvalLine } from '../../src/lib/contractor-claim-display';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');
const INV = '01a1f46c-2d26-ae22-4cfe-34df55d1bdbf';

test('a contractor invoice voucher is recognised by its description, any other voucher is not', () => {
    assert.equal(sodInvoiceIdOf(`${SOD_INVOICE_REF}${INV}`), INV);
    assert.equal(sodInvoiceIdOf(`${SOD_INVOICE_REF}${INV} extra text`), INV);
    assert.equal(sodInvoiceIdOf('Payment of a vendor invoice'), null);
    assert.equal(sodInvoiceIdOf(`${SOD_INVOICE_REF}not-a-uuid`), null);
    assert.equal(sodInvoiceIdOf(null), null);
});

test('a contractor invoice follows the contractor area: company-wide sees all, otherwise the area must be the user\'s', () => {
    assert.equal(areaAllows(undefined, null), true);
    assert.equal(areaAllows(['a1', 'a2'], 'a2'), true);
    assert.equal(areaAllows(['a1'], 'a2'), false);
    assert.equal(areaAllows(['a1'], null), false, 'a contractor without an area is not inside anybody\'s area');
    assert.equal(areaAllows([], 'a1'), false);
});

test('the claim says the month it bills, and the share it holds back from the amounts', () => {
    assert.equal(claimMonthLabel({ month: 6, year: 2026, date: '2026-11-19' }), 'June 2026');
    assert.equal(claimMonthLabel({ date: '2026-11-19T10:00:00' }), 'November 2026');
    assert.equal(claimMonthLabel({}), '');
    assert.equal(retentionPercent(271100, 27110), 10);
    assert.equal(retentionPercent(100, 5), 5);
    assert.equal(retentionPercent(0, 5), 0);
});

test('the first timeline line says what the invoice waits for instead of claiming it is audited', () => {
    assert.deepEqual(approvalLine('PENDING_SF_AUDIT', 'CONTRACTOR'), { title: 'Area approval in progress', detail: 'Waiting for you' });
    assert.equal(approvalLine('PENDING_SF_AUDIT', 'AREA_MANAGER').detail, 'Waiting for the Area Manager');
    assert.equal(approvalLine('PENDING_SF_AUDIT', 'CONFIRMED').title, 'Waiting for audit');
    assert.equal(approvalLine('APPROVED', 'CONFIRMED', true).title, 'Audited & approved');
    assert.equal(approvalLine('CANCELLED', 'CANCELLED').title, 'Cancelled');
});

test('wiring: payments, the list and the run use the contractor area, and OSP Quality verifies several at once', () => {
    assert.ok(read('src/services/finance/ho-monthly.service.ts').includes('projectId: null, contractor: { opmcId: { in: scope } }'));
    const run = read('src/services/finance/ho-run.service.ts');
    assert.ok(run.includes('assertContractorAreaAccess') && !run.includes("assertVoucherAccess(null, userId)"));
    for (const route of ['src/app/api/finance/payment-vouchers/[id]/route.ts', 'src/app/api/finance/payment-vouchers/[id]/status/route.ts', 'src/app/api/projects/payment-vouchers/route.ts']) {
        assert.ok(read(route).includes('voucher.description'), `${route} passes the voucher description`);
    }
    assert.ok(read('src/services/finance/payment-voucher.service.ts').includes('sodVoucherIdsInScope'));
    assert.ok(read('src/services/contractor-portal/finance.service.ts').includes('claimMonthLabel(inv)'));
    assert.ok(read('src/app/contractor/finance/page.tsx').includes('approvalLine(') && !read('src/app/contractor/finance/page.tsx').includes('20% Retention Held'));
    assert.ok(read('src/app/finance/sf-audit/queue/page.tsx').includes('Verify selected'));
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
