import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    lateDays, lateBucket, fulfilmentPct, vendorScore, VENDOR_SCORE_WEIGHTS, deadStockBucket, daysOfCover, waitingFor,
    type ProcurementReport, type InventoryHealth, type VendorScorecard,
} from '../../src/lib/supply-chain-shared';
import { buildSupplyChainExceptions } from '../../src/services/procurement/supply-chain-exceptions';
import { weekKey } from '../../src/services/notification/supply-chain-alerts.service';
import { effectiveInventoryMinLevel, isInventoryReorderNeeded } from '../../src/lib/inventory-dashboard-metrics';

const now = new Date('2026-11-14T08:00:00Z');

test('lateDays: only strictly past dates count, no date means not late', () => {
  assert.equal(lateDays(null, now), null);
  assert.equal(lateDays('2026-11-14T23:00:00Z', now), null);
  assert.equal(lateDays('2026-11-13T08:00:00Z', now), 1);
  assert.equal(lateDays('2026-10-14T08:00:00Z', now), 31);
});

test('lateBucket boundaries', () => {
  assert.equal(lateBucket(1), '1-7');
  assert.equal(lateBucket(7), '1-7');
  assert.equal(lateBucket(8), '8-14');
  assert.equal(lateBucket(30), '15-30');
  assert.equal(lateBucket(31), '30+');
});

test('fulfilmentPct is capped and null without an order quantity', () => {
  assert.equal(fulfilmentPct(50, 100), 50);
  assert.equal(fulfilmentPct(150, 100), 100);
  assert.equal(fulfilmentPct(0, 0), null);
  assert.equal(fulfilmentPct(-5, 100), 0);
});

test('vendor score weights add up to 100 and missing criteria are re-weighted, not zeroed', () => {
  assert.equal(Object.values(VENDOR_SCORE_WEIGHTS).reduce((a, b) => a + b, 0), 100);
  assert.equal(vendorScore({ onTimePct: 100, rejectPct: 0, priceVariancePct: null, avgLeadDays: 10 }), 100);
  assert.equal(vendorScore({ onTimePct: null, rejectPct: null, priceVariancePct: null, avgLeadDays: null }), null);
  // only on-time known: the score is the on-time percentage
  assert.equal(vendorScore({ onTimePct: 80, rejectPct: null, priceVariancePct: null, avgLeadDays: null }), 80);
  // 20% rejects wipes out the quality component
  const bad = vendorScore({ onTimePct: 100, rejectPct: 20, priceVariancePct: null, avgLeadDays: null })!;
  assert.ok(bad < 100 && bad > 50);
});

test('deadStockBucket and daysOfCover', () => {
  assert.equal(deadStockBucket(10), null);
  assert.equal(deadStockBucket(30), '30-90');
  assert.equal(deadStockBucket(90), '90-180');
  assert.equal(deadStockBucket(200), '180+');
  assert.equal(deadStockBucket(null), 'never moved');
  assert.equal(daysOfCover(1000, 900, 90), 100);
  assert.equal(daysOfCover(1000, 0, 90), null);
});

test('waitingFor walks the approval stages in order and stops once released', () => {
  const d = new Date();
  assert.equal(waitingFor(null, null, null, null, null), 'Awaiting ARM');
  assert.equal(waitingFor(d, null, null, null, null), 'Awaiting stores manager');
  assert.equal(waitingFor(d, d, d, null, null), 'Awaiting manager');
  assert.equal(waitingFor(d, d, d, d, null), 'Awaiting release');
  assert.equal(waitingFor(d, d, d, d, d), null);
});

test('reorder uses the canonical rule: store minimum, else item minimum, against available stock', () => {
  assert.equal(effectiveInventoryMinLevel({ quantity: 5, minLevel: 0, itemMinLevel: 10 }), 10);
  assert.equal(effectiveInventoryMinLevel({ quantity: 5, minLevel: 3, itemMinLevel: 10 }), 3);
  assert.equal(isInventoryReorderNeeded({ quantity: 12, allocatedQuantity: 5, minLevel: 0, itemMinLevel: 10 }), true);
  assert.equal(isInventoryReorderNeeded({ quantity: 50, allocatedQuantity: 0, minLevel: 0, itemMinLevel: 10 }), false);
});

test('weekKey returns the Monday of the week', () => {
  assert.equal(weekKey(new Date('2026-11-14T08:00:00Z')), '2026-11-09'); // Saturday
  assert.equal(weekKey(new Date('2026-11-09T00:00:00Z')), '2026-11-09'); // Monday
  assert.equal(weekKey(new Date('2026-11-15T23:00:00Z')), '2026-11-09'); // Sunday
});

const procurement = (over: Partial<ProcurementReport['store']> = {}, project: Partial<ProcurementReport['project']> = {}, latePos: ProcurementReport['latePos'] = []): ProcurementReport => ({
  asOf: now.toISOString(),
  store: { openPos: 0, late: 0, noDeliveryDate: 0, lateBuckets: [], waiting: [], leadTime: { avgDays: null, medianDays: null, p90Days: null, completed: 0 }, leadTimeMonthly: [], sourceMix: [], ...over },
  project: { funnel: [], late: 0, pendingApproval: { count: 0, oldestDays: null }, fulfilmentPct: null, ...project },
  latePos,
});
const health = (totals: Partial<InventoryHealth['totals']> = {}, extra: Partial<InventoryHealth> = {}): InventoryHealth => ({
  asOf: now.toISOString(), showValues: true, stores: [], reorder: [], dead: [], deadTop: [], turnover: [], expiring: [], neverCountedStores: 0, notes: [],
  totals: { value: 0, skus: 0, belowReorder: 0, stockOut: 0, overAllocated: 0, deadValue: 0, deadSkus: 0, ...totals }, ...extra,
});

test('supply chain exceptions: nothing wrong means no exceptions', () => {
  assert.deepEqual(buildSupplyChainExceptions(procurement(), health(), { asOf: '', months: 12, rows: [], unlinked: [], totalSpend: 0 }), []);
  assert.deepEqual(buildSupplyChainExceptions(null, null, null), []);
});

test('supply chain exceptions: late POs, stock-outs, expiry and weak vendors are flagged with the right severity', () => {
  const late = [{ id: '1', poNumber: 'PO-1', vendor: 'V', system: 'STORE' as const, expectedDelivery: '2026-09-01', daysLate: 60, bucket: '30+' as const, amount: 1, href: '/' }];
  const vendors: VendorScorecard = { asOf: '', months: 12, totalSpend: 10, unlinked: [], rows: [
    { vendorId: 'a', name: 'Weak Ltd', orders: 5, spend: 10, onTimePct: 20, rejectPct: 10, priceVariancePct: null, avgLeadDays: 40, score: 30, lowVolume: false },
    { vendorId: 'b', name: 'New Co', orders: 1, spend: 5, onTimePct: 0, rejectPct: 0, priceVariancePct: null, avgLeadDays: 1, score: null, lowVolume: true },
  ] };
  const ex = buildSupplyChainExceptions(
    procurement({ late: 1 }, {}, late),
    health({ stockOut: 2, belowReorder: 5, deadSkus: 3, deadValue: 2_500_000 }, { expiring: [{ batch: 'b', item: 'i', expiry: '2026-11-01', daysLeft: -13, quantity: 1 }] }),
    vendors,
  );
  const by = Object.fromEntries(ex.map((e) => [e.id, e.severity]));
  assert.equal(by['sc-late-po'], 'critical');
  assert.equal(by['sc-stockout'], 'critical');
  assert.equal(by['sc-reorder'], 'warning');
  assert.equal(by['sc-dead-stock'], 'warning');
  assert.equal(by['sc-expired'], 'critical');
  assert.equal(by['sc-vendor-a'], 'warning');
  assert.equal(by['sc-vendor-b'], undefined, 'thin volume is never flagged');
});

test('supply chain wiring: services, job, pages and permissions', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8');
  for (const [route, perm] of [
    ['src/app/api/procurement/performance/route.ts', 'PROCUREMENT_READ'],
    ['src/app/api/procurement/vendors/scorecard/route.ts', 'PROCUREMENT_READ'],
    ['src/app/api/inventory/health/route.ts', 'INVENTORY_READ'],
  ]) assert.match(read(route), new RegExp(perm));
  assert.match(read('src/app/api/inventory/health/route.ts'), /INVENTORY_COST_READ/, 'values only with the cost capability');
  assert.match(read('src/services/service-order/sod.sync.service.ts'), /SUPPLY_CHAIN_ALERTS/);
  assert.match(read('src/services/service-order/sync/types.ts'), /SUPPLY_CHAIN_ALERTS/);
  assert.match(read('src/workers/system.worker.ts'), /SUPPLY_CHAIN_ALERTS/);
  assert.doesNotMatch(read('src/services/procurement/procurement-performance.service.ts'), /z\.string\(\)\.uuid\(\)/);
  // the PO row's own status never moves: lateness must come from the request's procurement status
  assert.match(read('src/services/procurement/procurement-performance.service.ts'), /procurementStatus/);
  // fulfilment counts accepted units only
  assert.match(read('src/services/project/project-goods-receipt.service.ts'), /acceptedQty/);
});
