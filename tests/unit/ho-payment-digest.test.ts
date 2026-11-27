import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hoPaymentDigest, hoPaymentDigestKey, vendorPaymentState } from '../../src/lib/ho-payment-digest';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';
import { CANONICAL_BOOTSTRAP_ROLE_GRANTS, MODULE_DESIGNATION_GRANTS } from '../../src/config/rbac-bootstrap';
import { NOTIFICATION_AUDIENCES } from '../../src/services/notification/notification-audiences';
import { resolvePageCapability } from '../../src/config/page-capabilities';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('a voucher with HO is pending, partly paid or completed by what HO paid on it', () => {
    assert.equal(vendorPaymentState(60000, 0), 'PENDING');
    assert.equal(vendorPaymentState(60000, 20000), 'PARTLY_PAID');
    assert.equal(vendorPaymentState(60000, 60000), 'COMPLETED');
    assert.equal(vendorPaymentState(60000, 59999.996), 'COMPLETED', 'a rounding cent is not a balance');
});

test('100 payments in a day are one notice: totals, completed, partly paid and what is still to pay', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ pvNumber: `PV-${i}`, vendor: 'V', amount: 1000, reference: `TT-${i}`, voucherPaid: i < 80, remaining: i < 80 ? 0 : 500 }));
    const d = hoPaymentDigest(many);
    assert.match(d.title, /100 payments, Rs\. 100,000\.00/);
    assert.match(d.message, /on 100 vendor vouchers today/);
    assert.match(d.message, /Completed: 80\./);
    assert.match(d.message, /Partly paid: 20 \(Rs\. 10,000\.00 still to pay\)/);
    assert.match(d.message, /Latest: PV-99, V, Rs\. 1,000\.00 \(TT-99\), Rs\. 500\.00 still to pay/);
});

test('a voucher paid in two parts on the same day counts once, in its latest state', () => {
    const d = hoPaymentDigest([
        { pvNumber: 'PV-1', vendor: 'V', amount: 20000, reference: 'TT-1', voucherPaid: false, remaining: 14800 },
        { pvNumber: 'PV-1', vendor: 'V', amount: 14800, reference: 'TT-2', voucherPaid: true, remaining: 0 },
    ]);
    assert.match(d.message, /on 1 vendor voucher today\. Completed: 1\./);
    assert.doesNotMatch(d.message, /Partly paid/);
});

test('the notice is one row per person per day that updates and shows unread again (no push per payment)', () => {
    assert.equal(hoPaymentDigestKey('2026-11-27'), 'ho-vendor-payments:2026-11-27');
    const svc = read('src/services/procurement/ho-payment.service.ts');
    assert.match(svc, /dedupKey: hoPaymentDigestKey\(day\), reopen: true/);
    assert.match(svc, /audience: 'OSP_VENDOR_PAYMENTS'/);
    assert.doesNotMatch(svc, /Part payment made by HO/, 'no notice per payment any more');
    assert.match(read('src/repositories/notification.repository.ts'), /opts\?\.reopen \? \{ isRead: false \}/);
});

test('the OSP Account Manager, OSP Manager and Head of Section get the notice and see Vendor Payment Status', () => {
    assert.ok(NOTIFICATION_AUDIENCES.OSP_VENDOR_PAYMENTS);
    const audience = CANONICAL_BOOTSTRAP_ROLE_GRANTS[RBAC_PERMISSIONS.NOTIFICATION_OSP_VENDOR_PAYMENTS] ?? [];
    assert.deepEqual([...audience].sort(), ['HEAD_OF_SECTION', 'OSP_MANAGER']);
    assert.ok(MODULE_DESIGNATION_GRANTS[RBAC_PERMISSIONS.NOTIFICATION_OSP_VENDOR_PAYMENTS]?.includes('OSP_ACCOUNT_MANAGER_FINANCE_MANAGER'));
    const see = CANONICAL_BOOTSTRAP_ROLE_GRANTS[RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ] ?? [];
    for (const r of ['OSP_MANAGER', 'HEAD_OF_SECTION', 'FINANCE_MANAGER']) assert.ok(see.includes(r as never), `${r} sees the page`);
    assert.equal(resolvePageCapability('/procurement/vendor-payments'), RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ);
    assert.match(read('src/app/api/procurement/vendor-payments/route.ts'), /permissions: \[RBAC_PERMISSIONS\.PROCUREMENT_PV_CHAIN_READ\]/);
});
