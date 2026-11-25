import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { safeEqual } from '../../src/lib/safe-equal';

const read = (f: string) => fs.readFileSync(f, 'utf8');

test('safeEqual: equal secrets match, anything else (including empty or missing) does not', () => {
    assert.ok(safeEqual('abc123', 'abc123'));
    assert.ok(!safeEqual('abc123', 'abc124'));
    assert.ok(!safeEqual('abc', 'abc123'));
    assert.ok(!safeEqual('', ''), 'an empty secret never matches');
    assert.ok(!safeEqual(null, 'x'));
    assert.ok(!safeEqual('x', undefined));
});

test('cron and extension secrets are compared in constant time, never with ===', () => {
    assert.ok(read('src/lib/cron-auth.ts').includes('safeEqual(supplied, expected)'));
    for (const f of ['src/app/api/invoices/import-bom/csv/route.ts', 'src/app/api/invoices/slt-registry/route.ts', 'src/app/api/invoices/slt-registry/download-sync/route.ts', 'src/app/api/service-orders/extension-push/route.ts']) {
        const s = read(f);
        assert.ok(s.includes('safeEqual('), f);
        assert.ok(!/=== extensionSecret/.test(s), f + ': no plain comparison with the extension secret');
    }
});

test('creating a bank needs the finance write capability', () => {
    const s = read('src/app/api/banks/route.ts');
    assert.ok(/permissions: \[RBAC_PERMISSIONS\.FINANCE_WRITE\]/.test(s));
});

test('the public staff lookup does not write to the database', () => {
    const s = read('src/services/hr/staff.service.ts');
    const fn = s.slice(s.indexOf('findPublicStaffByEmployeeId'));
    const body = fn.slice(0, fn.indexOf('static async', 40) > 0 ? fn.indexOf('static async', 40) : fn.length);
    assert.ok(!/iTAsset\.update\(/.test(body), 'no asset update inside a public lookup');
});
