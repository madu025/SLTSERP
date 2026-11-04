import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SOD_STANDARD_MATRIX_CONFIG, matrixItemAllowsWastage, wastageKeyFor, WASTAGE_KEY_SUFFIX } from '../../src/config/sod-matrix-config';
import { serviceOrderPatchSchema } from '../../src/lib/validations/service-order.schema';

test('plain consumables get a wastage field; drop wire, wastage row and poles do not', () => {
  const allowed = SOD_STANDARD_MATRIX_CONFIG.filter(matrixItemAllowsWastage).map((i) => i.key);
  for (const key of ['DW_RT', 'IN_W_SINGLE_PAIR', 'CABLE_TIE', 'SINGLE_ROSETTE']) assert.ok(allowed.includes(key), key);
  for (const key of ['F1', 'G1', 'FDW_WASTAGE', 'PLC_5_6_CE', 'POLE_NUMBER']) assert.ok(!allowed.includes(key), key);
  assert.equal(wastageKeyFor('CABLE_TIE'), 'CABLE_TIE' + WASTAGE_KEY_SUFFIX);
});

test('the SOD PATCH accepts material quantity as a number (staff form) or a string (contractor app)', () => {
  const base = { id: '00000000-0000-0000-0000-000000000001', materialUsage: [{ itemId: 'x', usageType: 'USED' }] };
  const num = serviceOrderPatchSchema.safeParse({ ...base, materialUsage: [{ ...base.materialUsage[0], quantity: 5 }] });
  const str = serviceOrderPatchSchema.safeParse({ ...base, materialUsage: [{ ...base.materialUsage[0], quantity: '5' }] });
  assert.ok(num.success, JSON.stringify(num.success ? '' : num.error.issues));
  assert.ok(str.success);
  if (num.success) assert.equal(num.data.materialUsage?.[0].quantity, '5');
});
