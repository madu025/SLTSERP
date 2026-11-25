import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The public invoice page (/public/invoices/<id>) needs no sign-in, so it must not be a way to collect contractor data:
 * it opens by the invoice id only (never by the predictable invoice number) and does not carry bank or phone details.
 */
const service = fs.readFileSync('src/services/invoice/public.invoice.service.ts', 'utf8');

test('the public invoice opens by id only, never by invoice number', () => {
    assert.ok(!/where:\s*\{\s*invoiceNumber/.test(service), 'no lookup by invoice number');
    assert.ok(service.includes('[0-9a-f]{8}-'), 'the id must be a uuid');
});

test('the public invoice carries no bank account or phone number of the contractor', () => {
    for (const field of ['bankAccountNumber', 'bankName', 'bankBranch', 'contactNumber']) {
        assert.ok(!service.includes(field), `${field} must not be selected for the public page`);
    }
});
