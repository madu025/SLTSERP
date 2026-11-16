import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canConfirm, nextStage, isConfirmStage, STAGE_PERMISSION, CONFIRM_STAGES } from '../../src/lib/invoice-confirm-rules';
import { RBAC_PERMISSION_CODES } from '../../src/config/rbac-permissions';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('chain order: coordinator, QC, engineer, area manager', () => {
  assert.equal(nextStage('AREA_COORDINATOR', true), 'QC_OFFICER');
  assert.equal(nextStage('QC_OFFICER', true), 'AREA_ENGINEER');
  assert.equal(nextStage('AREA_ENGINEER', true), 'AREA_MANAGER');
  assert.equal(nextStage('AREA_MANAGER', true), 'CONFIRMED');
});

test('engineer stage is skipped when the area has no engineer or officer', () => {
  assert.equal(nextStage('QC_OFFICER', false), 'AREA_MANAGER');
});

test('one person cannot confirm two stages, but may repeat the same stage', () => {
  assert.equal(canConfirm('u1', [{ userId: 'u1', stage: 'AREA_COORDINATOR' }], 'QC_OFFICER'), false);
  assert.equal(canConfirm('u2', [{ userId: 'u1', stage: 'AREA_COORDINATOR' }], 'QC_OFFICER'), true);
  assert.equal(canConfirm('u1', [{ userId: 'u1', stage: 'QC_OFFICER' }], 'QC_OFFICER'), true);
});

test('every stage has a catalogued permission', () => {
  for (const s of CONFIRM_STAGES) assert.ok((RBAC_PERMISSION_CODES as string[]).includes(STAGE_PERMISSION[s]), s);
  assert.ok(isConfirmStage('QC_OFFICER'));
  assert.ok(!isConfirmStage('CONFIRMED'));
});

test('wiring: new invoices start at the coordinator, SF audit waits for the chain, migration seeds permissions', () => {
  assert.match(read('src/services/invoice/invoice.generator.service.ts'), /confirmStage: 'AREA_COORDINATOR'/);
  assert.match(read('src/services/invoice/invoice.service.ts'), /confirmStage !== 'CONFIRMED'/);
  const m = read('prisma/migrations/20261203000000_invoice_area_confirmation/migration.sql');
  assert.match(m, /"confirmStage" TEXT NOT NULL DEFAULT 'CONFIRMED'/);
  for (const s of CONFIRM_STAGES) assert.ok(m.includes(STAGE_PERMISSION[s]), s);
  assert.match(read('src/app/api/invoices/confirmations/route.ts'), /INVOICE_CONFIRM_MANAGER/);
});

test('the confirmations page is reachable by confirmers who do not hold sod.invoice', async () => {
  const { resolvePageCapability } = await import('../../src/config/page-capabilities');
  assert.equal(resolvePageCapability('/invoices/confirmations'), 'dashboard.read');
  assert.equal(resolvePageCapability('/invoices'), 'sod.invoice');
});
