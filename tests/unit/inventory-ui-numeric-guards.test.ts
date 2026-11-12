import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(path, 'utf8');

// Prisma Decimal columns reach the browser as strings, so adding them with `+` concatenates ("0" + "50" = "050").
test('procurement and inventory screens add quantities as numbers', () => {
  const orders = source('src/app/procurement/orders/page.tsx');
  const grn = source('src/app/inventory/grn/page.tsx');
  assert.match(orders, /\(Number\(item\.requestedQty\) \|\| 0\)/);
  assert.doesNotMatch(orders, /\+ \(item\.requestedQty \|\| 0\)/);
  assert.match(grn, /acc \+ \(Number\(item\.receivedQty\) \|\| 0\)/);
  assert.match(grn, /acc \+ \(Number\(item\.requestedQty\) \|\| 0\)/);
  assert.doesNotMatch(grn, /acc \+ \(item\.(received|requested)Qty \|\| 0\)/);
  assert.match(source('src/app/procurement/approvals/page.tsx'), /sum \+ \(Number\(item\.requestedQty\) \|\| 0\)/);
  assert.match(source('src/app/inventory/issues/page.tsx'), /sum \+ \(Number\(item\.quantity\) \|\| 0\)/);
});

test('procurement summary tiles count every stage, not only the open tab', () => {
  const orders = source('src/app/procurement/orders/page.tsx');
  assert.match(orders, /queryKey: \["procurement-orders", "counts"\]/);
  assert.match(orders, /stageCounts\?\.pending/);
  assert.match(orders, /stageCounts\?\.inProgress/);
  assert.match(orders, /stageCounts\?\.ready/);
});

test('MRN list shows both the return destination and the supplier name', () => {
  const page = source('src/app/inventory/admin/mrns/page.tsx');
  assert.match(page, /\[mrn\.returnTo, mrn\.supplier\]\.filter\(Boolean\)/);
  assert.match(page, /\[selectedMRN\.returnTo, selectedMRN\.supplier\]\.filter\(Boolean\)/);
});

test('cardex quantities are added numerically', () => {
  const cardex = source('src/app/inventory/reports/cardex/page.tsx');
  assert.match(cardex, /acc \+ Number\(curr\.quantity\)/);
});
