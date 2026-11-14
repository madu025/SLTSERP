import type { HealthException } from '@/services/core/company-health.service';
import type { InventoryHealth, ProcurementReport, VendorScorecard } from '@/lib/supply-chain-shared';
import { MIN_ORDERS_FOR_VENDOR_RANKING } from '@/lib/supply-chain-shared';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Management exceptions for the supply chain, built from the three reports so the Company Health tab, the 07:45
 * digest and the pages always agree. Any input may be null when the caller lacks that module's capability.
 */
export function buildSupplyChainExceptions(p: ProcurementReport | null, h: InventoryHealth | null, v: VendorScorecard | null): HealthException[] {
    const ex: HealthException[] = [];

    if (p) {
        const late = p.store.late + p.project.late;
        if (late > 0) {
            const veryLate = p.latePos.some((x) => (x.daysLate ?? 0) > 30);
            ex.push({ id: 'sc-late-po', severity: veryLate ? 'critical' : 'warning', area: 'Procurement', title: 'Purchase orders past their delivery date', detail: `${late} open purchase order(s) are late${veryLate ? ', some by more than 30 days' : ''}`, href: '/procurement/performance' });
        }
        const waitingOld = p.store.waiting.filter((w) => (w.oldestDays ?? 0) >= 7);
        if (waitingOld.length > 0) {
            const count = waitingOld.reduce((a, w) => a + w.count, 0);
            ex.push({ id: 'sc-request-wait', severity: 'warning', area: 'Procurement', title: 'Stock requests stuck in approval', detail: `${count} request(s) have been waiting at one approval stage for a week or more`, href: '/procurement/performance' });
        }
        if ((p.project.pendingApproval.oldestDays ?? 0) >= 7) {
            ex.push({ id: 'sc-po-approval', severity: 'warning', area: 'Procurement', title: 'Project purchase orders waiting for approval', detail: `${p.project.pendingApproval.count} purchase order(s) waiting, the oldest for ${p.project.pendingApproval.oldestDays} days`, href: '/procurement/performance' });
        }
    }

    if (h) {
        if (h.totals.stockOut > 0) {
            ex.push({ id: 'sc-stockout', severity: 'critical', area: 'Inventory', title: 'Items out of stock', detail: `${h.totals.stockOut} store item(s) have no available stock and a reorder level set`, href: '/inventory/health' });
        }
        const low = h.totals.belowReorder - h.totals.stockOut;
        if (low > 0) {
            ex.push({ id: 'sc-reorder', severity: 'warning', area: 'Inventory', title: 'Items below reorder level', detail: `${low} store item(s) are at or below their reorder level`, href: '/inventory/health' });
        }
        if (h.totals.deadSkus > 0 && h.totals.deadValue !== null && h.totals.deadValue > 0) {
            ex.push({ id: 'sc-dead-stock', severity: h.totals.deadValue >= 1_000_000 ? 'warning' : 'info', area: 'Inventory', title: 'Dead stock', detail: `${h.totals.deadSkus} stock line(s) worth ${fmt(h.totals.deadValue)} have not moved for 30 days or more`, href: '/inventory/health' });
        }
        const expired = h.expiring.filter((e) => e.daysLeft < 0).length;
        const soon = h.expiring.length - expired;
        if (expired > 0) ex.push({ id: 'sc-expired', severity: 'critical', area: 'Inventory', title: 'Expired batches still in stock', detail: `${expired} batch(es) are past their expiry date and still on hand`, href: '/inventory/health' });
        else if (soon > 0) ex.push({ id: 'sc-expiring', severity: 'warning', area: 'Inventory', title: 'Batches expiring within 30 days', detail: `${soon} batch(es) expire within 30 days`, href: '/inventory/health' });
        if (h.neverCountedStores > 0) {
            ex.push({ id: 'sc-never-counted', severity: 'info', area: 'Inventory', title: 'Stores never stock-counted', detail: `${h.neverCountedStores} store(s) have no completed cycle count`, href: '/inventory/health' });
        }
    }

    if (v) {
        const weak = v.rows.filter((r) => r.score !== null && r.score < 60 && r.orders >= MIN_ORDERS_FOR_VENDOR_RANKING).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3);
        for (const r of weak) {
            ex.push({ id: `sc-vendor-${r.vendorId}`, severity: 'warning', area: 'Procurement', title: `${r.name} is under-performing`, detail: `Score ${r.score}: ${r.onTimePct ?? 'n/a'}% on time, ${r.rejectPct ?? 'n/a'}% rejected over ${r.orders} orders`, href: '/procurement/vendors' });
        }
    }
    return ex;
}
