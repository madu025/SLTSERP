import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { monthRange, planState, reconciliationBlocker, reconciliationDifference, reconciliationStatus, unrequestedAmount } from '../../src/lib/ho-monthly-rules';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('month range', () => {
  const r = monthRange('2026-11');
  assert.equal(r?.start.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(r?.end.toISOString().slice(0, 10), '2026-11-30');
  assert.equal(monthRange('2026-02')?.end.toISOString().slice(0, 10), '2026-02-28');
  assert.equal(monthRange('2026-13'), null);
  assert.equal(monthRange('nope'), null);
});

test('what is still to request and where a payable stands', () => {
  assert.equal(unrequestedAmount(1000, 400), 600);
  assert.equal(unrequestedAmount(1000, 1200), 0);
  assert.equal(planState(1000, 0, 0), 'NOT_REQUESTED');
  assert.equal(planState(1000, 400, 0), 'REQUESTED');
  assert.equal(planState(1000, 1000, 1000), 'WITH_HEAD_OFFICE');
  assert.equal(planState(1000, 1000, 0), 'REQUESTED');
});

test('reconciliation: difference, status and the rules for recording', () => {
  assert.equal(reconciliationDifference(5000, 4800), 200);
  assert.equal(reconciliationStatus(0), 'RECONCILED');
  assert.equal(reconciliationStatus(0.004), 'RECONCILED');
  assert.equal(reconciliationStatus(200), 'DIFFERENCE');
  assert.equal(reconciliationBlocker(null, 200, ''), 'NOTE_REQUIRED_WHEN_THERE_IS_A_DIFFERENCE');
  assert.equal(reconciliationBlocker(null, 200, 'timing: HO paid on the 30th'), null);
  assert.equal(reconciliationBlocker(null, 0, ''), null);
  assert.equal(reconciliationBlocker('RECONCILED', 0, 'x'), 'MONTH_ALREADY_RECONCILED');
  assert.equal(reconciliationBlocker('DIFFERENCE', 0, ''), null, 'a month with a difference can be corrected');
});

test('wiring: routes, guards, migration, menu, legacy contractor invoice sync', () => {
  assert.match(read('src/app/api/finance/ho/reconciliation/route.ts'), /FINANCE_HO_SUBMIT/);
  assert.match(read('src/app/api/finance/ho/monthly/route.ts'), /FINANCE_READ/);
  assert.match(read('prisma/migrations/20261201000000_head_office_reconciliation/migration.sql'), /CREATE TABLE IF NOT EXISTS "HoReconciliation"/);
  const menu = read('src/config/sidebar-menu.ts');
  assert.match(menu, /\/finance\/ho-monthly/);
  const pv = read('src/services/finance/payment-voucher.service.ts');
  assert.match(pv, /BOM_INVOICING_REF:\$\{bomInvoiceId\}/);
  assert.match(pv, /paidSoFar\._sum\.amount/);
  assert.doesNotMatch(read('src/app/finance/ar/aging/page.tsx'), /api\/finance\/ar\/receipts/);
});
