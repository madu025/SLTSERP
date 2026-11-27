import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the Procurement tab follows the company purchase flow, one station per step, in order', () => {
    const ui = read('src/app/dashboard/components/ProcurementSection.tsx');
    const steps = ['Stores Manager review', 'OSP Manager approval', 'Documents to Procurement', 'Waiting for the PO', 'Waiting for the GRN', 'Waiting for the voucher', 'Waiting for HO payment', 'Paid this month'];
    const at = steps.map((s) => ui.indexOf(`label: '${s}'`));
    assert.ok(at.every((i) => i > 0), 'every step has a station');
    assert.deepEqual([...at].sort((a, b) => a - b), at, 'the stations are in the order the requests travel');
    assert.doesNotMatch(ui, /lowStock|Stock Outage/, 'stock shortages belong to the Inventory tab');
});

test('each count reads the step it names', () => {
    const svc = read('src/services/core/dashboard.service.ts');
    assert.match(svc, /workflowStage: 'STORES_MANAGER_APPROVAL'/);
    assert.match(svc, /workflowStage: \{ in: \['OSP_MANAGER_APPROVAL', 'HOS_APPROVAL'\] \}/);
    assert.match(svc, /procurementDocsSubmittedAt: null/, 'approved requests whose documents have not reached Procurement');
    assert.match(svc, /procurementDocsSubmittedAt: \{ not: null \}, procurementStatus: \{ not: 'COMPLETED' \}/, 'only requests Procurement can act on wait for a PO');
    assert.match(svc, /supplierInvoiceId: \{ in: invoiceIds \}/, 'vouchers are read for the vendor invoices of store purchase orders');
    assert.doesNotMatch(svc, /completedPOs/, 'a fully ordered request is not counted as fulfilled before its goods arrive');
});
