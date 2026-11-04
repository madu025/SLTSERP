import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareMaterial, hasDeviation } from '../../src/lib/sod-material-deviation';

const A = 'item-a';
const B = 'item-b';

test('equal SLT and manual quantities are a match, F1/G1 count as used', () => {
  const lines = compareMaterial(
    [{ itemId: A, label: 'DW', quantity: 100 }],
    [{ itemId: A, usageType: 'USED_F1', quantity: 60 }, { itemId: A, usageType: 'USED_G1', quantity: 40 }],
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].type, 'MATCH');
  assert.equal(hasDeviation(lines), false);
});

test('manual quantity different from SLT is a quantity mismatch with the signed difference', () => {
  const [l] = compareMaterial([{ itemId: A, label: 'DW', quantity: 100 }], [{ itemId: A, usageType: 'USED', quantity: 130 }]);
  assert.equal(l.type, 'QTY_MISMATCH');
  assert.equal(l.difference, 30);
});

test('SLT reported but nothing entered, and entered but not reported', () => {
  const lines = compareMaterial([{ itemId: A, label: 'ONT', quantity: 1 }], [{ itemId: B, usageType: 'USED', quantity: 2 }]);
  assert.equal(lines.find((l) => l.itemId === A)?.type, 'NOT_ENTERED');
  assert.equal(lines.find((l) => l.itemId === B)?.type, 'NOT_REPORTED');
});

test('wastage is shown beside the line but never counted as used', () => {
  const [l] = compareMaterial(
    [{ itemId: A, label: 'DW', quantity: 100 }],
    [{ itemId: A, usageType: 'USED', quantity: 100 }, { itemId: A, usageType: 'WASTAGE', quantity: 8 }],
  );
  assert.equal(l.type, 'MATCH');
  assert.equal(l.wastageQty, 8);
});

test('an SLT item with no inventory mapping is reported as UNMAPPED, duplicates of one item are summed', () => {
  const lines = compareMaterial(
    [{ itemId: null, label: 'MYSTERY', quantity: 3 }, { itemId: A, label: 'DW', quantity: 50 }, { itemId: A, label: 'DW', quantity: 50 }],
    [{ itemId: A, usageType: 'USED', quantity: 100 }],
  );
  assert.equal(lines.find((l) => l.type === 'UNMAPPED')?.label, 'MYSTERY');
  assert.equal(lines.find((l) => l.itemId === A)?.type, 'MATCH');
});
