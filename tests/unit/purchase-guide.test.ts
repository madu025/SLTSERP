import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GuideService, pageTrail } from '../../src/services/guides/guide.service';
import { RBAC_PERMISSIONS } from '../../src/config/rbac-permissions';
import { resolvePageCapability } from '../../src/config/page-capabilities';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const everyone = new Set<string>(Object.values(RBAC_PERMISSIONS));
const first = (q: string, perms: Set<string> = everyone) => GuideService.lookup(q, perms).sections[0];

test('purchase questions find the right step', () => {
    assert.equal(first('how do I raise a material request').id, 'request');
    assert.equal(first('record a purchase order with credit days').id, 'po');
    assert.equal(first('receive goods grn with the oracle grn number').id, 'grn');
    assert.equal(first('raise the payment voucher for a vendor invoice').id, 'voucher');
    assert.equal(first('record signed by all three and send documents to ho').id, 'signatures');
    assert.equal(first('record a part payment ho made with cheque reference').id, 'ho-payment');
    assert.equal(first('how much is still to pay, vendor payment status').id, 'payment-status');
});

test('the steps of the HO Account Executive are withheld from a Stores Officer', () => {
    const storesOfficer = new Set<string>([RBAC_PERMISSIONS.INVENTORY_READ, RBAC_PERMISSIONS.INVENTORY_WRITE]);
    const s = first('record a part payment ho made with cheque reference', storesOfficer);
    assert.equal(s.id, 'ho-payment');
    assert.ok(s.blocked, 'the steps are not taught to someone who cannot do them');
});

test('every step of the purchase guide points at a real sidebar entry', () => {
    for (const p of ['/inventory/requests', '/procurement/approvals', '/procurement/orders', '/inventory/grn', '/finance/ho-payments', '/procurement/payment-approvals', '/procurement/vendor-payments']) {
        assert.ok(pageTrail(p), `${p} is in the sidebar`);
    }
});

test('Help is open to every office user and lists the guides', () => {
    assert.equal(resolvePageCapability('/help'), RBAC_PERMISSIONS.DASHBOARD_READ);
    assert.equal(pageTrail('/help'), 'Help');
    const page = read('src/app/help/page.tsx');
    assert.match(page, /GUIDES/);
    assert.match(page, /You can do this/);
});

test('every screenshot the purchase guide shows exists and has a caption', async () => {
    const { existsSync } = await import('node:fs');
    const { PURCHASE_GUIDE } = await import('../../src/content/guides/purchase.guide');
    const images = PURCHASE_GUIDE.sections.flatMap((s) => s.images ?? []);
    assert.ok(images.length >= 12, 'one screenshot per step');
    for (const im of images) {
        assert.ok(existsSync(new URL(`../../public${im.src}`, import.meta.url)), `${im.src} is in public/`);
        assert.ok(im.caption.length > 10, `${im.src} has a caption`);
    }
});
