import { prisma } from '@/lib/prisma';
import { InventoryHealthService } from '@/services/inventory/inventory-health.service';
import { NotificationService } from './index';

/** Monday of the week containing `d` (UTC), as YYYY-MM-DD: one reminder per store per week. */
export function weekKey(d: Date): string {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
}

/**
 * Daily supply-chain pass for the people who can act on it: each store manager is told once a week which of their
 * stores have items below reorder level or out of stock. Company-level exceptions (late purchase orders, dead stock,
 * weak vendors, expiry) reach management through the Company Health digest, so they are not repeated here.
 * Notification only: it never changes stock or orders.
 */
export class SupplyChainAlertService {
    static async run(now: Date = new Date()): Promise<{ stores: number; notified: number }> {
        const health = await InventoryHealthService.getReport(null, false, now);
        const flagged = health.stores.filter((s) => s.belowReorder > 0);
        if (flagged.length === 0) return { stores: 0, notified: 0 };

        const managers = await prisma.inventoryStore.findMany({ where: { id: { in: flagged.map((s) => s.storeId) }, managerId: { not: null } }, select: { id: true, managerId: true } });
        const managerOf = new Map(managers.map((m) => [m.id, m.managerId as string]));

        let notified = 0;
        for (const s of flagged) {
            const userId = managerOf.get(s.storeId);
            if (!userId) continue;
            const result = await NotificationService.send({
                userId,
                title: `${s.stockOut > 0 ? '⛔' : '⚠️'} ${s.belowReorder} item(s) below reorder level at ${s.name}`,
                message: `${s.stockOut} out of stock, ${s.belowReorder - s.stockOut} low. Open Inventory health for the list.`,
                type: 'INVENTORY',
                priority: s.stockOut > 0 ? 'HIGH' : 'MEDIUM',
                link: '/inventory/health',
                metadata: { source: 'supply-chain-alerts', storeId: s.storeId },
                dedupKey: `sc-reorder:${s.storeId}:${weekKey(now)}`,
            });
            if (result) notified++;
        }
        return { stores: flagged.length, notified };
    }
}
